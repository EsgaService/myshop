export type WebhookPurchaseDecision =
  | { ok: true }
  | { ok: false; reason: "book_not_found" | "book_unavailable" | "currency_mismatch" | "amount_mismatch" };

/**
 * Gate before a gateway-confirmed payment becomes a purchase. The gateway is trusted for the
 * signature only: the price, currency and sellability come from our database (never the event).
 */
export function decideWebhookPurchase(input: {
  book: { status: "draft" | "published" | "archived"; priceCents: number; currency: string } | null;
  event: { amountCents: number; currency: string };
  sellerCanSell: boolean;
}): WebhookPurchaseDecision {
  const { book, event } = input;
  if (!book) return { ok: false, reason: "book_not_found" };
  if (book.status !== "published" || !input.sellerCanSell) return { ok: false, reason: "book_unavailable" };
  if (event.currency !== book.currency) return { ok: false, reason: "currency_mismatch" };
  if (event.amountCents < book.priceCents) return { ok: false, reason: "amount_mismatch" };
  return { ok: true };
}
