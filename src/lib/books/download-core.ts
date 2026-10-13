import { isUuid } from "@/lib/ids";
import { decideDownload } from "./decide-download";
import { DOWNLOAD_URL_TTL_SECONDS, downloadFileName } from "./pdf-download";

export type DownloadUpload = {
  book_id: string | null;
  seller_id: string;
  status: string;
  removed_at: string | null;
  original_name: string;
  storage_path: string;
};

export type DownloadDeps = {
  /** Verified session user, or null when anonymous. */
  getUserId(): Promise<string | null>;
  loadUpload(uploadId: string): Promise<DownloadUpload | null>;
  /** The user owns the seller account that owns the upload. */
  isOwner(userId: string, sellerId: string): Promise<boolean>;
  hasPurchase(userId: string, bookId: string): Promise<boolean>;
  /** Signed URL for the object, or null when it cannot be produced. */
  createSignedUrl(path: string, ttlSeconds: number, downloadName: string): Promise<string | null>;
};

export type DownloadResult = { kind: "redirect"; url: string } | { kind: "not_found" };

/**
 * Authorizes and signs one PDF download (R3.1). Every denial, malformed id or signing failure collapses
 * to `not_found`, so the route cannot be used to probe which books or uploads exist. The storage path is
 * only ever passed to `createSignedUrl`.
 */
export async function resolveDownload(deps: DownloadDeps, ids: { bookId: string; uploadId: string }): Promise<DownloadResult> {
  const notFound: DownloadResult = { kind: "not_found" };
  if (!isUuid(ids.bookId) || !isUuid(ids.uploadId)) return notFound;

  const userId = await deps.getUserId();
  if (!userId) return notFound;

  const upload = await deps.loadUpload(ids.uploadId);
  if (!upload) return notFound;

  const [isOwner, hasPurchase] = await Promise.all([
    deps.isOwner(userId, upload.seller_id),
    deps.hasPurchase(userId, ids.bookId),
  ]);

  const decision = decideDownload({
    isOwner,
    hasPurchase,
    upload: { bookMatches: upload.book_id === ids.bookId, status: upload.status, removed: upload.removed_at !== null },
  });
  if (!decision.ok) return notFound;

  const url = await deps.createSignedUrl(upload.storage_path, DOWNLOAD_URL_TTL_SECONDS, downloadFileName(upload.original_name));
  return url ? { kind: "redirect", url } : notFound;
}
