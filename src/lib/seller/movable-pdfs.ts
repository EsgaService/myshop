export type MovablePdf = { id: string; name: string; productId: string; productTitle: string };

/**
 * Ready PDFs of the seller that live in OTHER products and can be moved into `targetBookId`.
 * `products` are the seller's valid move endpoints (non-legacy, non-archived), so a PDF outside them
 * (no product, legacy or unknown product) is never offered. The server re-checks every move.
 * Order: products as listed, then oldest upload first.
 */
export function listMovablePdfs(input: {
  targetBookId: string;
  products: { id: string; title: string }[];
  uploads: { id: string; original_name: string; book_id: string | null; status: string; created_at: string }[];
}): MovablePdf[] {
  const order = new Map(input.products.map((p, i) => [p.id, i]));
  if (!order.has(input.targetBookId)) return [];
  const titles = new Map(input.products.map((p) => [p.id, p.title]));

  return input.uploads
    .filter((u) => u.status === "ready" && u.book_id !== null && u.book_id !== input.targetBookId && order.has(u.book_id))
    .sort((a, b) => order.get(a.book_id!)! - order.get(b.book_id!)! || Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((u) => ({ id: u.id, name: u.original_name, productId: u.book_id!, productTitle: titles.get(u.book_id!)! }));
}
