export type CleanupDeps = {
  /** Sets cover_url to null (and cover_source back to 'auto') when the book cover lives under the prefix. */
  resetCoverUnderPrefix(bookId: string, prefix: string): Promise<void>;
  listImagePaths(uploadId: string): Promise<string[]>;
  deleteImageRows(uploadId: string): Promise<void>;
  removeObjects(paths: string[]): Promise<void>;
};

export type CleanupUpload = { id: string; sellerId: string; bookId: string | null };

/** Storage folder holding every image extracted from an upload (full size and thumbs). */
export function uploadImagePrefix(sellerId: string, uploadId: string): string {
  return `${sellerId}/${uploadId}/`;
}

async function bestEffort(label: string, step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch (error) {
    console.error(`image cleanup: ${label} failed`, error);
  }
}

/**
 * After a PDF is removed (R1.7): its cover reference, rows and objects go. Runs after the database
 * commit, so every step is best effort: a leftover object is a leak, never a broken product.
 */
export async function cleanupUploadImages(upload: CleanupUpload, deps: CleanupDeps): Promise<void> {
  await resetCoverIfFromUpload(upload, deps);
  let paths: string[] = [];
  await bestEffort("list", async () => {
    paths = await deps.listImagePaths(upload.id);
  });
  await bestEffort("rows", () => deps.deleteImageRows(upload.id));
  if (paths.length > 0) await bestEffort("objects", () => deps.removeObjects(paths));
}

/** After a PDF moves to another product (R1.7): the source cover pointing to it is nulled, images stay keyed by upload. */
export async function resetCoverIfFromUpload(upload: CleanupUpload, deps: CleanupDeps): Promise<void> {
  if (!upload.bookId) return;
  const bookId = upload.bookId;
  await bestEffort("cover", () => deps.resetCoverUnderPrefix(bookId, uploadImagePrefix(upload.sellerId, upload.id)));
}
