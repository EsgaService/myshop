import type { PhotoSource } from "@/lib/images/describe-recipe-photo";
import { createClient } from "@/lib/supabase/server";

/** An image offered to the seller in a picker. URLs are public `recipe-photos` objects (see `photoUrl`). */
export type CandidateImage = {
  id: string;
  uploadId: string | null;
  page: number;
  ordinal: number;
  storagePath: string;
  thumbPath: string;
};

type CandidateRow = {
  id: string;
  upload_id: string | null;
  page: number | null;
  ordinal: number | null;
  storage_path: string;
  thumb_path: string;
};

const COLUMNS = "id,upload_id,page,ordinal,storage_path,thumb_path";
const PAGE_LIMIT = 600;

function toCandidate(row: CandidateRow): CandidateImage {
  return {
    id: row.id,
    uploadId: row.upload_id,
    page: row.page ?? 0,
    ordinal: row.ordinal ?? 0,
    storagePath: row.storage_path,
    thumbPath: row.thumb_path,
  };
}

/** Ready, active upload ids of a product, optionally restricted to one PDF. Runs under the seller's RLS. */
export async function listActiveUploadIds(sellerId: string, bookId: string, onlyUploadId?: string): Promise<string[]> {
  let query = (await createClient())
    .from("book_uploads")
    .select("id")
    .eq("seller_id", sellerId)
    .eq("book_id", bookId)
    .eq("status", "ready")
    .is("removed_at", null);
  if (onlyUploadId) query = query.eq("id", onlyUploadId);
  const { data } = await query;
  return (data ?? []).map((r) => r.id as string);
}

/** PDF candidates of the given uploads in PDF order (upload, then ordinal). */
export async function listPdfCandidates(sellerId: string, uploadIds: string[]): Promise<CandidateImage[]> {
  if (uploadIds.length === 0) return [];
  const { data } = await (await createClient())
    .from("book_images")
    .select(COLUMNS)
    .eq("seller_id", sellerId)
    .eq("kind", "pdf")
    .in("upload_id", uploadIds)
    .order("upload_id")
    .order("ordinal")
    .limit(PAGE_LIMIT);
  return ((data ?? []) as unknown as CandidateRow[]).map(toCandidate);
}

export type RecipePhotoItem = {
  id: string;
  title: string;
  photoPath: string | null;
  photoSource: PhotoSource;
  uploadId: string | null;
};

/** Recipes of a product in reading order, optionally only those that came from one PDF. Runs under the seller's RLS. */
export async function listRecipesForPhotos(bookId: string, uploadId?: string): Promise<RecipePhotoItem[]> {
  let query = (await createClient())
    .from("recipes")
    .select("id,title,photo_path,photo_source,upload_id")
    .eq("book_id", bookId);
  if (uploadId) query = query.eq("upload_id", uploadId);
  const { data } = await query.order("position");
  return ((data ?? []) as unknown as { id: string; title: string; photo_path: string | null; photo_source: PhotoSource; upload_id: string | null }[]).map(
    (r) => ({ id: r.id, title: r.title, photoPath: r.photo_path, photoSource: r.photo_source, uploadId: r.upload_id }),
  );
}

/** The seller's own uploaded images for one product cover or one recipe. */
export async function listCustomImages(
  sellerId: string,
  target: { bookId: string } | { recipeId: string },
): Promise<CandidateImage[]> {
  let query = (await createClient()).from("book_images").select(COLUMNS).eq("seller_id", sellerId).eq("kind", "custom");
  query = "bookId" in target ? query.eq("book_id", target.bookId) : query.eq("recipe_id", target.recipeId);
  const { data } = await query.order("created_at", { ascending: false });
  return ((data ?? []) as unknown as CandidateRow[]).map(toCandidate);
}
