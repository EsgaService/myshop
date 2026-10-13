import { decidePaidPurchase } from "./decide-paid-purchase";
import type { GrantPurchaseInput, GrantSubscriptionInput } from "./fulfill-rows";
import type { PaymentEvent } from "./types";

export type ApplyResult = { ok: true } | { ok: false; reason: string };

export type ApplyDeps = {
  grantPurchase(input: GrantPurchaseInput): Promise<void>;
  grantSubscriptionPeriod(input: GrantSubscriptionInput): Promise<void>;
  loadBookForWebhook(bookId: string): Promise<{ book: { status: "draft" | "published" | "archived" } | null }>;
};

/**
 * Turns a trusted payment event into access. Shared by the webhook and the return-page reconciliation,
 * so both paths enforce the same rules and write through the same idempotent grants.
 * The amount comes from the checkout record (server-computed at creation and verified against the gateway),
 * so a price change after checkout never strands a buyer who already paid; only a missing or archived book
 * is refused. Grants are idempotent per (user, book) and per provider reference.
 */
export async function applyPaymentEvent(event: PaymentEvent, providerId: string, deps: ApplyDeps): Promise<ApplyResult> {
  if (event.type !== "payment.succeeded") return { ok: true };

  if (event.kind === "subscription") {
    await deps.grantSubscriptionPeriod({ sellerId: event.subjectId, provider: providerId, providerRef: event.providerRef });
    return { ok: true };
  }

  const { book } = await deps.loadBookForWebhook(event.subjectId);
  const decision = decidePaidPurchase({ book });
  if (!decision.ok) {
    console.error("payment fulfillment refused", {
      reason: decision.reason,
      provider: providerId,
      providerRef: event.providerRef,
      bookId: event.subjectId,
      amountCents: event.amountCents,
      currency: event.currency,
    });
    return { ok: false, reason: decision.reason };
  }
  await deps.grantPurchase({
    userId: event.userId,
    bookId: event.subjectId,
    provider: providerId,
    providerRef: event.providerRef,
    amountCents: event.amountCents,
    currency: event.currency,
  });
  return { ok: true };
}
