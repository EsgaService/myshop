import { decideSubscription, periodEndFor, SELLER_PLAN, type SubscriptionPeriod } from "@/lib/seller/decide-subscription";

/** Pure row builders for fulfillment (no I/O, unit-testable). */

export type GrantPurchaseInput = {
  userId: string;
  bookId: string;
  provider: string;
  providerRef: string;
  amountCents: number;
  currency: string;
};

export function buildPurchaseRow(input: GrantPurchaseInput, legacyStoreId: string | null) {
  return {
    user_id: input.userId,
    book_id: input.bookId,
    store_id: legacyStoreId,
    provider: input.provider,
    provider_ref: input.providerRef,
    amount_cents: input.amountCents,
    currency: input.currency,
  };
}

export type GrantSubscriptionInput = {
  sellerId: string;
  provider: string;
  providerRef: string;
};

/**
 * Next paid period for a seller. The amount is always the server constant:
 * client or gateway supplied amounts are never used for the plan price (R6).
 */
export function buildSubscriptionRow(input: GrantSubscriptionInput & { periods: readonly SubscriptionPeriod[]; now: Date }) {
  const { nextPeriodStart } = decideSubscription({ periods: input.periods, now: input.now });
  return {
    seller_id: input.sellerId,
    provider: input.provider,
    provider_ref: input.providerRef,
    amount_cents: SELLER_PLAN.amountCents,
    currency: SELLER_PLAN.currency,
    period_start: nextPeriodStart.toISOString(),
    period_end: periodEndFor(nextPeriodStart).toISOString(),
  };
}
