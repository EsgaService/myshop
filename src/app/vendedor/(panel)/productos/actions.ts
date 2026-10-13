"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireSeller } from "@/lib/auth/guards";
import { parseBookDetails } from "@/lib/books/book-details-schema";
import { decideDeleteProduct, deleteProductErrorMessage } from "@/lib/books/decide-delete-product";
import { classifyMoveRpcError, decideMoveUpload, moveUploadErrorMessage } from "@/lib/books/decide-move-upload";
import { classifyRemoveRpcError, decideRemoveUpload, removeUploadErrorMessage } from "@/lib/books/decide-remove-upload";
import { decidePublish, mustRevertPublish, publishErrorMessage } from "@/lib/books/decide-publish";
import { decideRetry, retryErrorMessage } from "@/lib/books/decide-retry";
import { parsePriceCop, priceErrorMessage, resolveOptionalPrice, resolvePublishPrice } from "@/lib/books/price";
import { parseProductName, productNameErrorMessage } from "@/lib/books/product-name";
import { productSlugCandidates } from "@/lib/books/product-slug";
import { requestUploadCore, type RequestUploadResult } from "@/lib/books/request-upload-core";
import {
  batchLimitMessage,
  checkUpload,
  decideBatchUpload,
  holdsUploadSlot,
  UPLOAD_TOKEN_TTL_MS,
} from "@/lib/books/upload-limit";
import { cleanupUploadImages, resetCoverIfFromUpload } from "@/lib/images/cleanup";
import { createCleanupDeps } from "@/lib/images/image-store";
import { runIngestionWorker } from "@/lib/ingestion/worker";
import { createPdfUploadUrl, getPdfSize, removePdf } from "@/lib/ingestion/storage";
import { getSellerAccess } from "@/lib/seller/access";
import { getOwnedBook, getOwnedUpload } from "@/lib/seller/owned";
import { createAdminClient } from "@/lib/supabase/admin";

export type BookActionState = {
  status: "idle" | "saved" | "error";
  message?: string;
  errors?: Record<string, string>;
  /** Lets the UI show the subscribe call to action next to the message. */
  code?: "subscription_required";
};

export type SimpleResult = { ok: true } | { ok: false; message: string; code?: "subscription_required" };

const NOT_FOUND = "No encontramos ese recetario en tu tienda.";
const GENERIC = "No pudimos completar la acción. Inténtalo de nuevo.";

/** Uploading and retrying run the paid AI pipeline: only sellers who can sell (active plan) may trigger it. */
async function hasActivePlan(seller: { id: string; is_platform: boolean }): Promise<boolean> {
  return (await getSellerAccess(seller.id, seller.is_platform)).canSell;
}

function revalidateProducts() {
  revalidatePath("/vendedor", "layout");
}

/** Runs the ingestion worker after the response is sent; failures are logged, never thrown at the user. */
function kickWorker() {
  after(async () => {
    try {
      await runIngestionWorker();
    } catch (error) {
      console.error("ingestion worker failed", error);
    }
  });
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

/**
 * Uploads that hold one of the seller's 12 slots. Removed pending uploads keep their slot while
 * their signed upload token can still be used.
 */
async function countHeldSlots(sellerId: string): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - UPLOAD_TOKEN_TTL_MS).toISOString();
  const { data, error } = await createAdminClient()
    .from("book_uploads")
    .select("status,removed_at")
    .eq("seller_id", sellerId)
    .or(`removed_at.is.null,removed_at.gt.${cutoff}`);
  if (error) throw new Error(`upload count failed: ${error.message}`);
  return (data ?? []).filter((row) => holdsUploadSlot(row as { status: string; removed_at: string | null }, now)).length;
}

/**
 * Pre-check for a multi-file upload: the whole batch is rejected before any file is uploaded when it
 * does not fit in the remaining slots. The DB trigger stays the race-safe backstop per file.
 */
export async function checkBatchCapacity(count: number): Promise<SimpleResult> {
  const { seller } = await requireSeller();
  const requested = typeof count === "number" && Number.isInteger(count) ? count : 0;
  const verdict = decideBatchUpload({ slotsHeld: await countHeldSlots(seller.id), requested });
  if (verdict.ok) return { ok: true };
  if (verdict.reason === "empty_batch") return { ok: false, message: "Elige al menos un PDF." };
  return { ok: false, message: batchLimitMessage(verdict.remaining) };
}

/** Step 1: validate + record the upload and hand back a signed URL; the browser uploads straight to storage. */
export async function requestUpload(input: {
  name: string;
  size: number;
  mime: string;
  bookId: string;
}): Promise<RequestUploadResult> {
  const { seller } = await requireSeller();
  const name = typeof input?.name === "string" ? input.name : "";
  const size = typeof input?.size === "number" ? input.size : 0;
  const mime = typeof input?.mime === "string" ? input.mime : "";
  const bookId = typeof input?.bookId === "string" ? input.bookId : "";
  const admin = createAdminClient();

  return requestUploadCore(
    { name, size, mime, bookId },
    {
      sellerId: seller.id,
      newId: randomUUID,
      hasActiveSubscription: () => hasActivePlan(seller),
      async isBookUsable(id) {
        const book = await getOwnedBook(seller.id, id);
        return book !== null && book.status !== "archived";
      },
      countActive: () => countHeldSlots(seller.id),
      async insertUpload(row) {
        const { error } = await admin.from("book_uploads").insert(row);
        if (!error) return { ok: true };
        return { ok: false, limit: error.message.includes("upload_limit_reached") };
      },
      createSignedUrl: createPdfUploadUrl,
    },
  );
}

/** Step 2: after the browser finished uploading, verify the object and enqueue the ingestion job. */
export async function confirmUpload(uploadId: string): Promise<SimpleResult> {
  const { seller } = await requireSeller();
  const upload = await getOwnedUpload(seller.id, uploadId);
  if (!upload) return { ok: false, message: "No encontramos ese archivo." };
  if (upload.status !== "pending") return { ok: true }; // already confirmed: idempotent
  if (!(await hasActivePlan(seller))) {
    return { ok: false, message: retryErrorMessage("subscription_required"), code: "subscription_required" };
  }

  const size = await getPdfSize(upload.storage_path);
  if (size === null) return { ok: false, message: "No encontramos el archivo subido. Inténtalo de nuevo." };

  const admin = createAdminClient();
  const verdict = checkUpload({ activeCount: 0, size, mime: "application/pdf", name: "upload.pdf" });
  if (!verdict.ok) {
    await removePdf(upload.storage_path).catch((e) => console.error("could not remove rejected PDF", e));
    await admin.from("book_uploads").update({ status: "failed", error: "El PDF supera el tamaño máximo de 20 MB." }).eq("id", upload.id);
    revalidateProducts();
    return { ok: false, message: "El PDF supera el tamaño máximo de 20 MB." };
  }

  const marked = await admin.from("book_uploads").update({ status: "uploaded", size_bytes: size }).eq("id", upload.id).eq("seller_id", seller.id);
  if (marked.error) return { ok: false, message: GENERIC };
  const job = await admin.from("ingestion_jobs").upsert({ upload_id: upload.id }, { onConflict: "upload_id", ignoreDuplicates: true });
  if (job.error) return { ok: false, message: GENERIC };

  kickWorker();
  revalidateProducts();
  return { ok: true };
}

/** Requeues a failed job from scratch. Needs an active plan and is capped per upload (each run re-bills the AI). */
export async function retryIngestion(uploadId: string): Promise<SimpleResult> {
  const { seller } = await requireSeller();
  const upload = await getOwnedUpload(seller.id, uploadId);
  if (!upload) return { ok: false, message: "No encontramos ese archivo." };

  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("ingestion_jobs")
    .select("id,manual_retries")
    .eq("upload_id", upload.id)
    .eq("status", "failed")
    .maybeSingle();
  if (jobError) return { ok: false, message: GENERIC };
  if (!job) return { ok: false, message: "Este archivo no se puede reintentar." };

  const manualRetries = job.manual_retries as number;
  const decision = decideRetry({ hasActiveSubscription: await hasActivePlan(seller), manualRetries });
  if (!decision.ok) {
    return {
      ok: false,
      message: retryErrorMessage(decision.reason),
      code: decision.reason === "subscription_required" ? "subscription_required" : undefined,
    };
  }

  // Compare-and-set on the counter so concurrent clicks cannot exceed the cap.
  const { data, error } = await admin
    .from("ingestion_jobs")
    .update({
      status: "queued",
      attempts: 0,
      run_after: new Date().toISOString(),
      locked_at: null,
      last_error: null,
      manual_retries: manualRetries + 1,
    })
    .eq("id", job.id)
    .eq("status", "failed")
    .eq("manual_retries", manualRetries)
    .select("id");
  if (error) return { ok: false, message: GENERIC };
  if (!data || data.length === 0) return { ok: false, message: "Este archivo no se puede reintentar." };

  await admin.from("book_uploads").update({ status: "uploaded", error: null }).eq("id", upload.id);
  kickWorker();
  revalidateProducts();
  return { ok: true };
}

/**
 * Removes a PDF from its product and frees its slot. Unfinished or failed PDFs have no content, so they are
 * soft-removed directly. A ready PDF goes through `remove_upload_from_book`, which deletes only its recipes
 * and sections atomically under the product lock; purchases are never touched. PDFs still being processed
 * cannot be removed, and the last ready PDF of a published product is protected.
 */
export async function removeUpload(uploadId: string): Promise<SimpleResult> {
  const { seller } = await requireSeller();
  const upload = await getOwnedUpload(seller.id, uploadId);
  if (!upload) return { ok: false, message: "No encontramos ese archivo." };

  const admin = createAdminClient();
  const book = upload.book_id ? await getOwnedBook(seller.id, upload.book_id) : null;
  const [job, others] = await Promise.all([
    admin.from("ingestion_jobs").select("status").eq("upload_id", upload.id).maybeSingle(),
    upload.book_id
      ? admin
          .from("book_uploads")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", seller.id)
          .eq("book_id", upload.book_id)
          .eq("status", "ready")
          .is("removed_at", null)
          .neq("id", upload.id)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (job.error || others.error) return { ok: false, message: GENERIC };

  const decision = decideRemoveUpload({
    bookStatus: book?.status ?? "draft",
    uploadStatus: upload.status,
    jobStatus: (job.data?.status as "queued" | "processing" | "succeeded" | "failed" | undefined) ?? null,
    otherReadyCount: others.count ?? 0,
  });
  if (!decision.ok) return { ok: false, message: removeUploadErrorMessage(decision.reason) };

  if (upload.status === "ready") {
    const { error } = await admin.rpc("remove_upload_from_book", { p_seller: seller.id, p_upload: upload.id });
    if (error) {
      const failure = classifyRemoveRpcError(error);
      if (failure === "unknown") console.error("remove_upload_from_book failed", error);
      if (failure === "rpc_missing" || failure === "last_ready_pdf") {
        return { ok: false, message: removeUploadErrorMessage(failure) };
      }
      return { ok: false, message: failure === "not_found" ? "No encontramos ese archivo." : GENERIC };
    }
  } else {
    const { data: removed, error } = await admin
      .from("book_uploads")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", upload.id)
      .eq("seller_id", seller.id)
      .neq("status", "ready")
      .is("removed_at", null)
      .select("id");
    if (error) return { ok: false, message: GENERIC };
    if (!removed || removed.length === 0) {
      return {
        ok: false,
        message: "Este PDF cambió de estado mientras lo eliminabas. Actualiza la página e inténtalo de nuevo.",
      };
    }
  }

  // After the commit: a leftover object is only a leak, never a broken product.
  await removePdf(upload.storage_path).catch((e) => console.error("could not remove PDF object", e));
  await cleanupUploadImages({ id: upload.id, sellerId: seller.id, bookId: upload.book_id }, createCleanupDeps()).catch((e) =>
    console.error("could not clean up PDF images", e),
  );
  revalidateProducts();
  return { ok: true };
}

export type MoveUploadResult =
  | { ok: true; sourceEmpty: boolean }
  | { ok: false; message: string; code?: "subscription_required" };

/**
 * Moves a READY PDF (and only its recipes and sections) to another product of the same seller through
 * `move_upload_to_book`, which re-checks every guard under the product locks. Purchases are never touched.
 * `sourceEmpty` tells the UI the origin product has no PDF left (it can be deleted if it is a draft).
 */
export async function moveUpload(uploadId: string, targetBookId: string): Promise<MoveUploadResult> {
  const { seller } = await requireSeller();
  const upload = await getOwnedUpload(seller.id, uploadId);
  if (!upload) return { ok: false, message: "No encontramos ese archivo." };
  if (!(await hasActivePlan(seller))) {
    return { ok: false, message: retryErrorMessage("subscription_required"), code: "subscription_required" };
  }

  const [source, target] = await Promise.all([
    upload.book_id ? getOwnedBook(seller.id, upload.book_id) : Promise.resolve(null),
    getOwnedBook(seller.id, targetBookId),
  ]);
  if (!source || !target) return { ok: false, message: NOT_FOUND };

  const admin = createAdminClient();
  const { count, error: countError } = await admin
    .from("book_uploads")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", seller.id)
    .eq("book_id", source.id)
    .eq("status", "ready")
    .is("removed_at", null)
    .neq("id", upload.id);
  if (countError) return { ok: false, message: GENERIC };

  const decision = decideMoveUpload({
    uploadStatus: upload.status,
    uploadRemoved: false, // getOwnedUpload only returns active uploads
    sourceId: source.id,
    sourceStatus: source.status,
    sourceIsLegacy: source.legacy_store_id !== null,
    targetId: target.id,
    targetIsLegacy: target.legacy_store_id !== null,
    targetIsArchived: target.status === "archived",
    otherReadyCount: count ?? 0,
  });
  if (!decision.ok) return { ok: false, message: moveUploadErrorMessage(decision.reason) };

  const { data, error } = await admin.rpc("move_upload_to_book", {
    p_seller: seller.id,
    p_upload: upload.id,
    p_target: target.id,
  });
  if (error) {
    const failure = classifyMoveRpcError(error);
    if (failure === "unknown") console.error("move_upload_to_book failed", error);
    if (failure === "not_found") return { ok: false, message: "No encontramos ese archivo." };
    if (failure === "unknown") return { ok: false, message: GENERIC };
    return { ok: false, message: moveUploadErrorMessage(failure) };
  }

  // The source product must not keep a cover that came from the moved PDF (its images stay keyed by upload).
  await resetCoverIfFromUpload({ id: upload.id, sellerId: seller.id, bookId: source.id }, createCleanupDeps()).catch((e) =>
    console.error("could not reset cover after move", e),
  );
  revalidateProducts();
  return { ok: true, sourceEmpty: (data as { source_empty?: boolean } | null)?.source_empty === true };
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

const SLUG_ATTEMPTS = 10;
const PG_UNIQUE_VIOLATION = "23505";

export type CreateProductResult = { ok: true; bookId: string } | { ok: false; message: string; code?: "subscription_required" };

/**
 * Creates an empty draft product by name and an optional price (blank = no price yet); PDFs are attached to
 * it afterwards. A filled price is validated like any other price.
 */
export async function createProduct(name: string, price?: string | null): Promise<CreateProductResult> {
  const { seller } = await requireSeller();
  const parsed = parseProductName(name);
  if (!parsed.ok) return { ok: false, message: productNameErrorMessage(parsed.reason) };
  const parsedPrice = resolveOptionalPrice(typeof price === "string" ? price : null);
  if (!parsedPrice.ok) return { ok: false, message: priceErrorMessage(parsedPrice.reason) };
  if (!(await hasActivePlan(seller))) {
    return { ok: false, message: retryErrorMessage("subscription_required"), code: "subscription_required" };
  }

  const admin = createAdminClient();
  for (const slug of productSlugCandidates(parsed.value, SLUG_ATTEMPTS)) {
    const { data, error } = await admin
      .from("books")
      .insert({ seller_id: seller.id, slug, title: parsed.value, status: "draft", price_cents: parsedPrice.cents ?? 0 })
      .select("id")
      .single();
    if (!error && data) {
      revalidateProducts();
      return { ok: true, bookId: data.id as string };
    }
    if (error?.code !== PG_UNIQUE_VIOLATION) return { ok: false, message: GENERIC };
  }
  return { ok: false, message: "Ya tienes productos con un nombre muy parecido. Prueba con otro nombre." };
}

/** Deletes an empty draft without purchases. `purchases.book_id` is `on delete restrict` as the backstop. */
export async function deleteProduct(bookId: string): Promise<SimpleResult> {
  const { seller } = await requireSeller();
  const book = await getOwnedBook(seller.id, bookId);
  if (!book || book.legacy_store_id !== null) return { ok: false, message: NOT_FOUND };

  const admin = createAdminClient();
  const [purchases, uploads] = await Promise.all([
    admin.from("purchases").select("id", { count: "exact", head: true }).eq("book_id", book.id),
    admin
      .from("book_uploads")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", seller.id)
      .eq("book_id", book.id)
      .is("removed_at", null),
  ]);
  if (purchases.error || uploads.error) return { ok: false, message: GENERIC };

  const decision = decideDeleteProduct({
    status: book.status,
    hasPurchases: (purchases.count ?? 0) > 0,
    activeUploadCount: uploads.count ?? 0,
  });
  if (!decision.ok) return { ok: false, message: deleteProductErrorMessage(decision.reason) };

  const { error } = await admin.from("books").delete().eq("id", book.id).eq("seller_id", seller.id);
  if (error) return { ok: false, message: GENERIC };
  revalidateProducts();
  return { ok: true };
}

export async function updateBookDetails(_prev: BookActionState, formData: FormData): Promise<BookActionState> {
  const { seller } = await requireSeller();
  const book = await getOwnedBook(seller.id, formData.get("bookId"));
  if (!book) return { status: "error", message: NOT_FOUND };

  const parsed = parseBookDetails(Object.fromEntries(formData.entries()));
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const { error } = await createAdminClient().from("books").update(parsed.value).eq("id", book.id).eq("seller_id", seller.id);
  if (error) return { status: "error", message: GENERIC };
  revalidateProducts();
  return { status: "saved" };
}

/** The price is parsed and bounded server-side; the client value is only a string the seller typed. */
export async function setBookPrice(_prev: BookActionState, formData: FormData): Promise<BookActionState> {
  const { seller } = await requireSeller();
  const book = await getOwnedBook(seller.id, formData.get("bookId"));
  if (!book) return { status: "error", message: NOT_FOUND };

  const parsed = parsePriceCop(String(formData.get("price") ?? ""));
  if (!parsed.ok) return { status: "error", message: priceErrorMessage(parsed.reason) };

  const { error } = await createAdminClient().from("books").update({ price_cents: parsed.cents }).eq("id", book.id).eq("seller_id", seller.id);
  if (error) return { status: "error", message: GENERIC };
  revalidateProducts();
  return { status: "saved", message: "Precio guardado." };
}

export async function publishBook(_prev: BookActionState, formData: FormData): Promise<BookActionState> {
  const { seller } = await requireSeller();
  const book = await getOwnedBook(seller.id, formData.get("bookId"));
  if (!book) return { status: "error", message: NOT_FOUND };

  const access = await getSellerAccess(seller.id, seller.is_platform);
  const admin = createAdminClient();
  const { count: readyPdfCount, error: countError } = await admin
    .from("book_uploads")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", seller.id)
    .eq("book_id", book.id)
    .eq("status", "ready")
    .is("removed_at", null);
  if (countError) return { status: "error", message: GENERIC };

  // The price field on screen wins over the stored one: validate it here and save it with the publication.
  const submittedPrice = formData.get("price");
  const price = resolvePublishPrice({
    storedCents: book.price_cents,
    submitted: typeof submittedPrice === "string" ? submittedPrice : null,
  });
  if (!price.ok) return { status: "error", message: priceErrorMessage(price.reason) };

  const decision = decidePublish({
    status: book.status,
    priceCents: price.cents,
    canPublish: access.canPublish,
    readyPdfCount: readyPdfCount ?? 0,
    isLegacy: book.legacy_store_id !== null,
  });
  if (!decision.ok) {
    return {
      status: "error",
      message: publishErrorMessage(decision.reason),
      code: decision.reason === "subscription_required" ? "subscription_required" : undefined,
    };
  }
  if (book.status === "published") {
    if (price.changed) {
      const { error } = await admin.from("books").update({ price_cents: price.cents }).eq("id", book.id).eq("seller_id", seller.id);
      if (error) return { status: "error", message: GENERIC };
      revalidateProducts();
    }
    return { status: "saved" };
  }

  const { error } = await admin
    .from("books")
    .update({ status: "published", published_at: new Date().toISOString(), price_cents: price.cents })
    .eq("id", book.id)
    .eq("seller_id", seller.id);
  if (error) return { status: "error", message: GENERIC };

  // A removal of the last ready PDF may have committed between the pre-check and the update.
  const isLegacy = book.legacy_store_id !== null;
  if (!isLegacy) {
    const { count: readyAfter, error: recountError } = await admin
      .from("book_uploads")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", seller.id)
      .eq("book_id", book.id)
      .eq("status", "ready")
      .is("removed_at", null);
    if (recountError) console.error("publish re-count failed", recountError);
    else if (mustRevertPublish({ readyPdfCountAfter: readyAfter ?? 0, isLegacy })) {
      const { error: revertError } = await admin
        .from("books")
        .update({ status: "draft", published_at: null })
        .eq("id", book.id)
        .eq("seller_id", seller.id)
        .eq("status", "published");
      if (revertError) console.error("publish revert failed", revertError);
      revalidateProducts();
      return { status: "error", message: publishErrorMessage("no_ready_pdf") };
    }
  }
  revalidateProducts();
  return { status: "saved", message: "Recetario publicado." };
}

export async function unpublishBook(_prev: BookActionState, formData: FormData): Promise<BookActionState> {
  const { seller } = await requireSeller();
  const book = await getOwnedBook(seller.id, formData.get("bookId"));
  if (!book) return { status: "error", message: NOT_FOUND };
  if (book.status !== "published") return { status: "saved" };

  const { error } = await createAdminClient()
    .from("books")
    .update({ status: "draft", published_at: null })
    .eq("id", book.id)
    .eq("seller_id", seller.id);
  if (error) return { status: "error", message: GENERIC };
  revalidateProducts();
  return { status: "saved", message: "Recetario despublicado." };
}
