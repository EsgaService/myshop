"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireSeller } from "@/lib/auth/guards";
import { parseBookDetails } from "@/lib/books/book-details-schema";
import { decidePublish, publishErrorMessage } from "@/lib/books/decide-publish";
import { decideRetry, retryErrorMessage } from "@/lib/books/decide-retry";
import { parsePriceCop } from "@/lib/books/price";
import { requestUploadCore, type RequestUploadResult } from "@/lib/books/request-upload-core";
import { checkUpload, holdsUploadSlot, UPLOAD_TOKEN_TTL_MS } from "@/lib/books/upload-limit";
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

/** Step 1: validate + record the upload and hand back a signed URL; the browser uploads straight to storage. */
export async function requestUpload(input: { name: string; size: number; mime: string }): Promise<RequestUploadResult> {
  const { seller } = await requireSeller();
  const name = typeof input?.name === "string" ? input.name : "";
  const size = typeof input?.size === "number" ? input.size : 0;
  const mime = typeof input?.mime === "string" ? input.mime : "";
  const admin = createAdminClient();

  return requestUploadCore(
    { name, size, mime },
    {
      sellerId: seller.id,
      newId: randomUUID,
      hasActiveSubscription: () => hasActivePlan(seller),
      async countActive() {
        // Removed pending uploads keep their slot while their signed upload token can still be used.
        const now = new Date();
        const cutoff = new Date(now.getTime() - UPLOAD_TOKEN_TTL_MS).toISOString();
        const { data, error } = await admin
          .from("book_uploads")
          .select("status,removed_at")
          .eq("seller_id", seller.id)
          .or(`removed_at.is.null,removed_at.gt.${cutoff}`);
        if (error) throw new Error(`upload count failed: ${error.message}`);
        return (data ?? []).filter((row) => holdsUploadSlot(row as { status: string; removed_at: string | null }, now)).length;
      },
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

/** Removes an unfinished or failed upload and frees its slot. Uploads that became a book are never removed here. */
export async function removeUpload(uploadId: string): Promise<SimpleResult> {
  const { seller } = await requireSeller();
  const upload = await getOwnedUpload(seller.id, uploadId);
  if (!upload) return { ok: false, message: "No encontramos ese archivo." };
  if (upload.book_id || (upload.status !== "pending" && upload.status !== "failed")) {
    return { ok: false, message: "Este archivo no se puede eliminar." };
  }

  const { error } = await createAdminClient()
    .from("book_uploads")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", upload.id)
    .eq("seller_id", seller.id);
  if (error) return { ok: false, message: GENERIC };

  await removePdf(upload.storage_path).catch((e) => console.error("could not remove PDF object", e));
  revalidateProducts();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

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
  if (!parsed.ok) {
    const message =
      parsed.reason === "too_low"
        ? "El precio mínimo es 5.000 COP."
        : parsed.reason === "too_high"
          ? "El precio máximo es 1.000.000 COP."
          : "Escribe un precio en pesos, sin decimales. Ejemplo: 19.900";
    return { status: "error", message };
  }

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
  const decision = decidePublish({ status: book.status, priceCents: book.price_cents, canPublish: access.canPublish });
  if (!decision.ok) {
    return {
      status: "error",
      message: publishErrorMessage(decision.reason),
      code: decision.reason === "subscription_required" ? "subscription_required" : undefined,
    };
  }
  if (book.status === "published") return { status: "saved" };

  const { error } = await createAdminClient()
    .from("books")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", book.id)
    .eq("seller_id", seller.id);
  if (error) return { status: "error", message: GENERIC };
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
