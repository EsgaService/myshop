import { photoUrl } from "@/lib/format";

/**
 * Resolves `books.cover_url` to a URL safe to put in an `<img src>`.
 * Accepts absolute http(s) URLs or `recipe-photos` storage paths; anything else (other schemes, blanks) is rejected.
 */
export function resolveCoverUrl(coverUrl: string | null | undefined): string | null {
  const value = coverUrl?.trim();
  if (!value) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null;
  return photoUrl(value);
}
