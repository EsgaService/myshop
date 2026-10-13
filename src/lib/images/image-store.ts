import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CleanupDeps } from "./cleanup";
import type { CoverSource } from "./choose-cover";
import type { CandidateRow, ImageStore, PhotoSource, UploadToProcess } from "./ports";

export const PHOTO_BUCKET = "recipe-photos";
const PDF_BUCKET = "seller-pdfs";
const UPDATE_CONCURRENCY = 10;
const ERROR_MAX_LENGTH = 500;

function check<T extends { error: { message: string } | null }>(label: string, result: T): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result;
}

/** Service-role persistence for image extraction. Callers must have authorized the work (sweep or seller action). */
export function createImageStore(): ImageStore {
  const admin = createAdminClient();

  return {
    async downloadPdf(storagePath) {
      const { data, error } = await admin.storage.from(PDF_BUCKET).download(storagePath);
      if (error || !data) throw new Error(`Could not download PDF: ${error?.message ?? "unknown"}`);
      return new Uint8Array(await data.arrayBuffer());
    },

    async listUploadRecipes(uploadId) {
      const { data } = check(
        "list recipes",
        await admin.from("recipes").select("id,title,photo_source").eq("upload_id", uploadId).order("position").order("id"),
      );
      return (data ?? []).map((r) => ({ id: r.id as string, title: r.title as string, photoSource: r.photo_source as PhotoSource }));
    },

    async getBookCover(bookId) {
      const { data } = check("read cover", await admin.from("books").select("cover_url,cover_source").eq("id", bookId).maybeSingle());
      return { coverUrl: (data?.cover_url as string | null) ?? null, coverSource: ((data?.cover_source as CoverSource | undefined) ?? "auto") };
    },

    async putImage(path, bytes) {
      check(
        "store image",
        await admin.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: true, cacheControl: "31536000" }),
      );
    },

    async replaceCandidates(upload: UploadToProcess, rows: CandidateRow[]) {
      if (rows.length > 0) {
        check(
          "save candidates",
          await admin.from("book_images").upsert(
            rows.map((r) => ({
              seller_id: upload.sellerId,
              kind: "pdf",
              upload_id: upload.id,
              book_id: null,
              ordinal: r.ordinal,
              page: r.page,
              width: r.width,
              height: r.height,
              area_ratio: r.areaRatio,
              image_key: r.imageKey,
              storage_path: r.storagePath,
              thumb_path: r.thumbPath,
            })),
            { onConflict: "upload_id,ordinal" },
          ),
        );
      }
      const stale = admin.from("book_images").delete().eq("upload_id", upload.id).eq("kind", "pdf");
      check(
        "delete stale candidates",
        await (rows.length > 0 ? stale.not("ordinal", "in", `(${rows.map((r) => r.ordinal).join(",")})`) : stale),
      );
    },

    async setRecipePhotos(updates) {
      for (let i = 0; i < updates.length; i += UPDATE_CONCURRENCY) {
        await Promise.all(
          updates.slice(i, i + UPDATE_CONCURRENCY).map(async (u) =>
            check(
              "update recipe photo",
              await admin
                .from("recipes")
                .update(u.photoPath ? { photo_path: u.photoPath, source_page: u.sourcePage } : { source_page: u.sourcePage })
                .eq("id", u.recipeId)
                .eq("photo_source", "auto"), // seller choices are never overwritten
            ),
          ),
        );
      }
    },

    async setCover(bookId, path) {
      check(
        "set cover",
        await admin.from("books").update({ cover_url: path }).eq("id", bookId).eq("cover_source", "auto").is("cover_url", null),
      );
    },

    async markDone(uploadId, reviewPending) {
      check(
        "mark images done",
        await admin
          .from("book_uploads")
          .update({ images_status: "done", images_error: null, images_at: new Date().toISOString(), images_review_pending: reviewPending })
          .eq("id", uploadId),
      );
    },

    async markFailed(uploadId, message) {
      check(
        "mark images failed",
        await admin
          .from("book_uploads")
          .update({ images_status: "failed", images_error: message.slice(0, ERROR_MAX_LENGTH), images_at: new Date().toISOString() })
          .eq("id", uploadId),
      );
    },
  };
}

/** Claims the next ready upload that still needs image extraction (SKIP LOCKED), or null. */
export async function claimNextImageUpload(): Promise<UploadToProcess | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_image_extraction");
  if (error) throw new Error(`Could not claim image extraction: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { id: string; seller_id: string; book_id: string | null; storage_path: string }
    | null
    | undefined;
  if (!row) return null;
  if (!row.book_id) {
    await createImageStore().markFailed(row.id, "upload has no product");
    return claimNextImageUpload();
  }
  return { id: row.id, sellerId: row.seller_id, bookId: row.book_id, storagePath: row.storage_path };
}

/** Service-role operations behind `cleanupUploadImages` / `resetCoverIfFromUpload`. */
export function createCleanupDeps(): CleanupDeps {
  const admin = createAdminClient();
  return {
    async resetCoverUnderPrefix(bookId, prefix) {
      check(
        "reset cover",
        await admin.from("books").update({ cover_url: null, cover_source: "auto" }).eq("id", bookId).like("cover_url", `${prefix}%`),
      );
    },
    async listImagePaths(uploadId) {
      const { data } = check("list images", await admin.from("book_images").select("storage_path,thumb_path").eq("upload_id", uploadId));
      return (data ?? []).flatMap((r) => [r.storage_path as string, r.thumb_path as string]);
    },
    async deleteImageRows(uploadId) {
      check("delete image rows", await admin.from("book_images").delete().eq("upload_id", uploadId));
    },
    async removeObjects(paths) {
      check("remove image objects", await admin.storage.from(PHOTO_BUCKET).remove(paths));
    },
  };
}
