import { isUuid } from "@/lib/ids";

/** Temp object in the private `seller-image-uploads` bucket: `{seller_id}/{file_id}`. */
export function customTempPath(sellerId: string, fileId: string): string {
  return `${sellerId}/${fileId}`;
}

/** Whether a client-supplied temp path is exactly `{this seller}/{uuid}` (no traversal, no other seller). */
export function isOwnTempPath(sellerId: string, path: unknown): path is string {
  if (typeof path !== "string") return false;
  const parts = path.split("/");
  return parts.length === 2 && parts[0] === sellerId && isUuid(parts[1]);
}

/** Final objects in the public `recipe-photos` bucket for a validated custom image. */
export function customImagePaths(sellerId: string, fileId: string): { storagePath: string; thumbPath: string } {
  return {
    storagePath: `${sellerId}/custom/${fileId}.webp`,
    thumbPath: `${sellerId}/custom/${fileId}-t.webp`,
  };
}
