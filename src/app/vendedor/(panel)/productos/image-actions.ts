"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireSeller } from "@/lib/auth/guards";
import { photoUrl } from "@/lib/format";
import { orderByPageProximity } from "@/lib/images/candidate-order";
import { choiceErrorMessage } from "@/lib/images/choice-error-message";
import { customImagePaths, customTempPath, isOwnTempPath } from "@/lib/images/custom-image-paths";
import { decideCover, decidePhotoChoice } from "@/lib/images/decide-photo-choice";
import type { ImageRef } from "@/lib/images/decide-photo-choice";
import { encodeCustomImage } from "@/lib/images/encode-custom-image";
import { parseImageChoice } from "@/lib/images/parse-image-choice";
import {
  customImageErrorMessage,
  CUSTOM_IMAGE_MAX_BYTES,
  CUSTOM_IMAGE_QUOTA,
  validateCustomImage,
} from "@/lib/images/validate-custom-image";
import { isUuid } from "@/lib/ids";
import { runIngestionWorker } from "@/lib/ingestion/worker";
import { getOwnedBook, getOwnedUpload } from "@/lib/seller/owned";
import { createAdminClient } from "@/lib/supabase/admin";

export type ImageActionResult = { ok: true; coverUrl?: string | null } | { ok: false; message: string };

const NOT_FOUND = "No encontramos ese recetario en tu tienda.";
const GENERIC = "No pudimos completar la acción. Inténtalo de nuevo.";
const TEMP_BUCKET = "seller-image-uploads";
const PHOTO_BUCKET = "recipe-photos";

type ImageRow = {
  id: string;
  seller_id: string;
  kind: "pdf" | "custom";
  upload_id: string | null;
  book_id: string | null;
  recipe_id: string | null;
  storage_path: string;
  thumb_path: string;
};

const IMAGE_COLUMNS = "id,seller_id,kind,upload_id,book_id,recipe_id,storage_path,thumb_path";

function toRef(row: ImageRow): ImageRef {
  return {
    id: row.id,
    sellerId: row.seller_id,
    kind: row.kind,
    uploadId: row.upload_id,
    bookId: row.book_id,
    recipeId: row.recipe_id,
  };
}

/** Looks the image up by id AND seller: another seller's image is simply "not found". */
async function loadOwnedImage(sellerId: string, imageId: string): Promise<ImageRow | null> {
  const { data, error } = await createAdminClient()
    .from("book_images")
    .select(IMAGE_COLUMNS)
    .eq("id", imageId)
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (error) throw new Error(`image lookup failed: ${error.message}`);
  return (data as ImageRow | null) ?? null;
}

/** Ready, active uploads of a product: the only source of valid PDF candidates. */
async function loadActiveUploadIds(sellerId: string, bookId: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("book_uploads")
    .select("id")
    .eq("seller_id", sellerId)
    .eq("book_id", bookId)
    .eq("status", "ready")
    .is("removed_at", null);
  if (error) throw new Error(`upload lookup failed: ${error.message}`);
  return (data ?? []).map((r) => r.id as string);
}

async function countCustomImages(sellerId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("book_images")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", sellerId)
    .eq("kind", "custom");
  if (error) throw new Error(`custom count failed: ${error.message}`);
  return count ?? 0;
}

function revalidateProducts() {
  revalidatePath("/vendedor", "layout");
}

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

/**
 * Sets or clears the product cover. The choice is one of the product's PDF candidates, a custom image
 * already uploaded for this product, or "clear". `cover_source` records the seller's decision so
 * re-extraction never overwrites it.
 */
export async function setCover(bookId: string, rawChoice: unknown): Promise<ImageActionResult> {
  const { seller } = await requireSeller();
  const book = await getOwnedBook(seller.id, bookId);
  if (!book) return { ok: false, message: NOT_FOUND };

  const choice = parseImageChoice(rawChoice);
  if (!choice || choice.type === "remove") return { ok: false, message: GENERIC };

  const image = choice.type === "clear" ? null : await loadOwnedImage(seller.id, choice.imageId);
  const decision = decideCover({
    sellerId: seller.id,
    book: { id: book.id, sellerId: seller.id },
    activeUploadIds: await loadActiveUploadIds(seller.id, book.id),
    choice: choice.type === "clear" ? { type: "clear" } : { type: choice.type, image: image ? toRef(image) : null },
  });
  if (!decision.ok) return { ok: false, message: choiceErrorMessage(decision.reason) };

  const coverUrl = image && decision.imageId ? image.storage_path : null;
  const { error } = await createAdminClient()
    .from("books")
    .update({ cover_url: coverUrl, cover_source: decision.coverSource })
    .eq("id", book.id)
    .eq("seller_id", seller.id);
  if (error) return { ok: false, message: GENERIC };
  revalidateProducts();
  return { ok: true, coverUrl };
}

// ---------------------------------------------------------------------------
// Custom uploads (signed upload to a private temp bucket, validated + re-encoded on confirm)
// ---------------------------------------------------------------------------

export type RequestImageUploadResult =
  | { ok: true; path: string; token: string }
  | { ok: false; message: string };

/** Step 1: cheap size/quota pre-check, then a signed upload URL for the private temp bucket. */
export async function requestImageUpload(input: { size: number }): Promise<RequestImageUploadResult> {
  const { seller } = await requireSeller();
  const size = typeof input?.size === "number" ? input.size : 0;
  if (!Number.isFinite(size) || size <= 0) return { ok: false, message: "El archivo está vacío." };
  if (size > CUSTOM_IMAGE_MAX_BYTES) return { ok: false, message: customImageErrorMessage("too_large") };
  if ((await countCustomImages(seller.id)) >= CUSTOM_IMAGE_QUOTA) {
    return { ok: false, message: customImageErrorMessage("quota_reached") };
  }

  const path = customTempPath(seller.id, randomUUID());
  const { data, error } = await createAdminClient().storage.from(TEMP_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: GENERIC };
  return { ok: true, path, token: data.token };
}

type StoredImage = { row: ImageRow };

/**
 * Validates the temp object (magic bytes, size, quota), re-encodes it to WebP into the public photo bucket and
 * records it as a `custom` book image. The temp object is always removed.
 */
async function storeCustomImage(
  sellerId: string,
  tempPath: string,
  target: { bookId?: string; recipeId?: string },
): Promise<{ ok: true; stored: StoredImage } | { ok: false; message: string }> {
  const admin = createAdminClient();
  const dropTemp = () => admin.storage.from(TEMP_BUCKET).remove([tempPath]).catch(() => undefined);

  const { data: blob, error: downloadError } = await admin.storage.from(TEMP_BUCKET).download(tempPath);
  if (downloadError || !blob) return { ok: false, message: "No encontramos la imagen subida. Inténtalo de nuevo." };
  const bytes = new Uint8Array(await blob.arrayBuffer());

  const verdict = validateCustomImage({
    head: bytes.subarray(0, 16),
    sizeBytes: bytes.length,
    existingCustomCount: await countCustomImages(sellerId),
  });
  if (!verdict.ok) {
    await dropTemp();
    return { ok: false, message: customImageErrorMessage(verdict.reason) };
  }

  let encoded;
  try {
    encoded = await encodeCustomImage(bytes);
  } catch {
    await dropTemp();
    return { ok: false, message: "No pudimos leer esa imagen. Prueba con otro archivo." };
  }

  const { storagePath, thumbPath } = customImagePaths(sellerId, randomUUID());
  const photos = admin.storage.from(PHOTO_BUCKET);
  const full = await photos.upload(storagePath, encoded.full, { contentType: "image/webp" });
  const thumb = await photos.upload(thumbPath, encoded.thumb, { contentType: "image/webp" });
  const cleanupObjects = () => photos.remove([storagePath, thumbPath]).catch(() => undefined);
  if (full.error || thumb.error) {
    await cleanupObjects();
    await dropTemp();
    return { ok: false, message: GENERIC };
  }

  const { data: row, error: insertError } = await admin
    .from("book_images")
    .insert({
      seller_id: sellerId,
      kind: "custom",
      book_id: target.bookId ?? null,
      recipe_id: target.recipeId ?? null,
      width: encoded.width,
      height: encoded.height,
      storage_path: storagePath,
      thumb_path: thumbPath,
    })
    .select(IMAGE_COLUMNS)
    .single();
  await dropTemp();
  if (insertError || !row) {
    await cleanupObjects();
    return { ok: false, message: GENERIC };
  }
  return { ok: true, stored: { row: row as ImageRow } };
}

/** Removes the target's earlier custom images (rows free the 300 quota; objects are best effort). */
async function dropReplacedCustomImages(sellerId: string, keepId: string | null, column: "book_id" | "recipe_id", targetId: string) {
  const admin = createAdminClient();
  let query = admin
    .from("book_images")
    .select("id,storage_path,thumb_path")
    .eq("seller_id", sellerId)
    .eq("kind", "custom")
    .eq(column, targetId);
  if (keepId) query = query.neq("id", keepId);
  const { data } = await query;
  const old = (data ?? []) as { id: string; storage_path: string; thumb_path: string }[];
  if (old.length === 0) return;
  await admin.from("book_images").delete().in("id", old.map((r) => r.id)).eq("seller_id", sellerId);
  await admin.storage.from(PHOTO_BUCKET).remove(old.flatMap((r) => [r.storage_path, r.thumb_path])).catch(() => undefined);
}

/** Step 2 for the cover: validate, re-encode, store and set the uploaded image as the product cover. */
export async function confirmCoverUpload(bookId: string, tempPath: string): Promise<ImageActionResult> {
  const { seller } = await requireSeller();
  const book = await getOwnedBook(seller.id, bookId);
  if (!book) return { ok: false, message: NOT_FOUND };
  if (!isUuid(bookId) || !isOwnTempPath(seller.id, tempPath)) return { ok: false, message: GENERIC };

  const stored = await storeCustomImage(seller.id, tempPath, { bookId: book.id });
  if (!stored.ok) return stored;
  const { row } = stored.stored;

  const decision = decideCover({
    sellerId: seller.id,
    book: { id: book.id, sellerId: seller.id },
    activeUploadIds: [],
    choice: { type: "custom", image: toRef(row) },
  });
  if (!decision.ok) return { ok: false, message: choiceErrorMessage(decision.reason) };

  const { error } = await createAdminClient()
    .from("books")
    .update({ cover_url: row.storage_path, cover_source: decision.coverSource })
    .eq("id", book.id)
    .eq("seller_id", seller.id);
  if (error) return { ok: false, message: GENERIC };

  await dropReplacedCustomImages(seller.id, row.id, "book_id", book.id);
  revalidateProducts();
  return { ok: true, coverUrl: row.storage_path };
}

// ---------------------------------------------------------------------------
// Recipe photos
// ---------------------------------------------------------------------------

type OwnedRecipe = {
  id: string;
  bookId: string;
  bookSellerId: string;
  uploadId: string | null;
  sourcePage: number | null;
};

/** Loads a recipe with the owner of its product. The decider (not this lookup) holds the ownership rule. */
async function loadRecipe(recipeId: unknown): Promise<OwnedRecipe | null> {
  if (!isUuid(recipeId)) return null;
  const admin = createAdminClient();
  const { data: recipe, error } = await admin
    .from("recipes")
    .select("id,book_id,upload_id,source_page")
    .eq("id", recipeId)
    .maybeSingle();
  if (error) throw new Error(`recipe lookup failed: ${error.message}`);
  if (!recipe) return null;
  const { data: book, error: bookError } = await admin.from("books").select("seller_id").eq("id", recipe.book_id as string).maybeSingle();
  if (bookError) throw new Error(`book lookup failed: ${bookError.message}`);
  if (!book) return null;
  return {
    id: recipe.id as string,
    bookId: recipe.book_id as string,
    bookSellerId: book.seller_id as string,
    uploadId: (recipe.upload_id as string | null) ?? null,
    sourcePage: (recipe.source_page as number | null) ?? null,
  };
}

export type RecipeCandidate = { id: string; page: number; thumbUrl: string; label: string };
export type ListRecipeCandidatesResult =
  | { ok: true; items: RecipeCandidate[]; total: number }
  | { ok: false; message: string };

const CANDIDATE_PAGE = 24;

/**
 * Lazy candidates for one recipe: images of the PDF it came from, nearest pages first, `CANDIDATE_PAGE` at a
 * time. Recipes of legacy uploads without a PDF fall back to every active PDF of the product.
 */
export async function listRecipeCandidates(recipeId: string, offset = 0): Promise<ListRecipeCandidatesResult> {
  const { seller } = await requireSeller();
  const recipe = await loadRecipe(recipeId);
  if (!recipe || recipe.bookSellerId !== seller.id) return { ok: false, message: choiceErrorMessage("not_owner") };

  const active = await loadActiveUploadIds(seller.id, recipe.bookId);
  const uploadIds = recipe.uploadId ? active.filter((id) => id === recipe.uploadId) : active;
  if (uploadIds.length === 0) return { ok: true, items: [], total: 0 };

  const { data, error } = await createAdminClient()
    .from("book_images")
    .select("id,page,ordinal,thumb_path")
    .eq("seller_id", seller.id)
    .eq("kind", "pdf")
    .in("upload_id", uploadIds);
  if (error) return { ok: false, message: GENERIC };

  const rows = (data ?? []) as { id: string; page: number; ordinal: number; thumb_path: string }[];
  const ordered = orderByPageProximity(rows, recipe.sourcePage);
  const start = Number.isInteger(offset) && offset > 0 ? offset : 0;
  return {
    ok: true,
    total: ordered.length,
    items: ordered.slice(start, start + CANDIDATE_PAGE).map((r) => ({
      id: r.id,
      page: r.page,
      thumbUrl: photoUrl(r.thumb_path) ?? "",
      label: `p. ${r.page}`,
    })),
  };
}

export type RecipePhotoResult = { ok: true; photoPath: string | null } | { ok: false; message: string };

/** Picks one of the recipe's PDF images, one of its own uploads, or removes the photo (`photo_source` = none). */
export async function setRecipePhoto(recipeId: string, rawChoice: unknown): Promise<RecipePhotoResult> {
  const { seller } = await requireSeller();
  const recipe = await loadRecipe(recipeId);
  if (!recipe) return { ok: false, message: choiceErrorMessage("not_owner") };
  const choice = parseImageChoice(rawChoice);
  if (!choice || choice.type === "clear") return { ok: false, message: GENERIC };

  const image = choice.type === "remove" ? null : await loadOwnedImage(seller.id, choice.imageId);
  const decision = decidePhotoChoice({
    sellerId: seller.id,
    recipe: { id: recipe.id, bookSellerId: recipe.bookSellerId },
    activeUploadIds: await loadActiveUploadIds(seller.id, recipe.bookId),
    choice: choice.type === "remove" ? { type: "remove" } : { type: choice.type, image: image ? toRef(image) : null },
  });
  if (!decision.ok) return { ok: false, message: choiceErrorMessage(decision.reason) };

  const photoPath = image && decision.imageId ? image.storage_path : null;
  const { error } = await createAdminClient()
    .from("recipes")
    .update({ photo_path: photoPath, photo_source: decision.photoSource })
    .eq("id", recipe.id)
    .eq("book_id", recipe.bookId);
  if (error) return { ok: false, message: GENERIC };
  // The recipe no longer uses its own upload: free it from the 300 image quota.
  if (decision.photoSource !== "custom") await dropReplacedCustomImages(seller.id, null, "recipe_id", recipe.id);
  revalidateProducts();
  return { ok: true, photoPath };
}

/** Step 2 for a recipe: validate, re-encode, store and set the uploaded image as the recipe photo. */
export async function confirmRecipeImageUpload(recipeId: string, tempPath: string): Promise<RecipePhotoResult> {
  const { seller } = await requireSeller();
  const recipe = await loadRecipe(recipeId);
  if (!recipe || recipe.bookSellerId !== seller.id) return { ok: false, message: choiceErrorMessage("not_owner") };
  if (!isOwnTempPath(seller.id, tempPath)) return { ok: false, message: GENERIC };

  const stored = await storeCustomImage(seller.id, tempPath, { recipeId: recipe.id });
  if (!stored.ok) return stored;
  const { row } = stored.stored;

  const decision = decidePhotoChoice({
    sellerId: seller.id,
    recipe: { id: recipe.id, bookSellerId: recipe.bookSellerId },
    activeUploadIds: [],
    choice: { type: "custom", image: toRef(row) },
  });
  if (!decision.ok) return { ok: false, message: choiceErrorMessage(decision.reason) };

  const { error } = await createAdminClient()
    .from("recipes")
    .update({ photo_path: row.storage_path, photo_source: decision.photoSource })
    .eq("id", recipe.id)
    .eq("book_id", recipe.bookId);
  if (error) return { ok: false, message: GENERIC };

  await dropReplacedCustomImages(seller.id, row.id, "recipe_id", recipe.id);
  revalidateProducts();
  return { ok: true, photoPath: row.storage_path };
}

// ---------------------------------------------------------------------------
// Per-PDF actions
// ---------------------------------------------------------------------------

/**
 * Queues the images of a finished PDF to be searched again (the sweep picks up `images_status = null`).
 * Re-extraction only touches recipes whose photo source is `auto`, so the seller's choices are kept (R3.4).
 */
export async function reextractUpload(uploadId: string): Promise<ImageActionResult> {
  const { seller } = await requireSeller();
  const upload = await getOwnedUpload(seller.id, uploadId);
  if (!upload || upload.status !== "ready") return { ok: false, message: "No encontramos ese archivo." };

  const { data, error } = await createAdminClient()
    .from("book_uploads")
    .update({ images_status: null, images_attempts: 0, images_error: null })
    .eq("id", upload.id)
    .eq("seller_id", seller.id)
    .in("images_status", ["done", "failed"])
    .select("id");
  if (error) return { ok: false, message: GENERIC };
  if (!data || data.length === 0) return { ok: false, message: "Este PDF ya está buscando sus imágenes." };

  after(async () => {
    try {
      await runIngestionWorker();
    } catch (e) {
      console.error("image sweep kick failed", e);
    }
  });
  revalidateProducts();
  return { ok: true };
}

/** Clears the "review images" notice of a PDF. Called by the editor on the client, never by a GET (R3.7). */
export async function markImagesReviewed(uploadId: string): Promise<ImageActionResult> {
  const { seller } = await requireSeller();
  const upload = await getOwnedUpload(seller.id, uploadId);
  if (!upload) return { ok: false, message: "No encontramos ese archivo." };

  const { error } = await createAdminClient()
    .from("book_uploads")
    .update({ images_review_pending: false })
    .eq("id", upload.id)
    .eq("seller_id", seller.id);
  if (error) return { ok: false, message: GENERIC };
  revalidateProducts();
  return { ok: true };
}
