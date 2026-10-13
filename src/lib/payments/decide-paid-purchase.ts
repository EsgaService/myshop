export type PaidPurchaseDecision = { ok: true } | { ok: false; reason: "book_not_found" | "book_archived" };

/**
 * Gate before a confirmed payment becomes a purchase. The amount was fixed at checkout creation from our
 * database and verified against the gateway, so the live price is NOT compared again: the buyer already
 * paid what was agreed. Only a truly impossible fulfillment (book gone or archived) is refused.
 */
export function decidePaidPurchase(input: { book: { status: "draft" | "published" | "archived" } | null }): PaidPurchaseDecision {
  if (!input.book) return { ok: false, reason: "book_not_found" };
  if (input.book.status === "archived") return { ok: false, reason: "book_archived" };
  return { ok: true };
}
