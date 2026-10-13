"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth/guards";
import { choiceErrorMessage } from "@/lib/images/choice-error-message";
import { customImagePaths, customTempPath, isOwnTempPath } from "@/lib/images/custom-image-paths";
import { decideCover } from "@/lib/images/decide-photo-choice";
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
import { getOwnedBook } from "@/lib/seller/owned";
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
async function dropReplacedCustomImages(sellerId: string, keepId: string, column: "book_id" | "recipe_id", targetId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("book_images")
    .select("id,storage_path,thumb_path")
    .eq("seller_id", sellerId)
    .eq("kind", "custom")
    .eq(column, targetId)
    .neq("id", keepId);
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
