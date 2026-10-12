export type ProductGroup<B, U> = { book: B; uploads: U[] };

/**
 * Groups the seller's active uploads under their product, oldest upload first (that is the order
 * the recipes end up in). Uploads without a product, or pointing to an unknown one (legacy in-flight
 * rows created before products existed), are returned as `orphans`.
 */
export function groupUploadsByProduct<B extends { id: string }, U extends { book_id: string | null; created_at: string }>(
  books: B[],
  uploads: U[],
): { groups: ProductGroup<B, U>[]; orphans: U[] } {
  const byBook = new Map<string, U[]>(books.map((b) => [b.id, []]));
  const orphans: U[] = [];
  for (const upload of uploads) {
    const bucket = upload.book_id ? byBook.get(upload.book_id) : undefined;
    if (bucket) bucket.push(upload);
    else orphans.push(upload);
  }
  const oldestFirst = (a: U, b: U) => Date.parse(a.created_at) - Date.parse(b.created_at);
  return {
    groups: books.map((book) => ({ book, uploads: byBook.get(book.id)!.sort(oldestFirst) })),
    orphans: orphans.sort(oldestFirst),
  };
}
