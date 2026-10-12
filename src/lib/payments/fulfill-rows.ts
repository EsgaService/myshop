import { SELLER_PLAN } from "@/lib/seller/decide-subscription";

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
 * Arguments of the `grant_subscription_period` RPC. The amount is always the server constant:
 * client or gateway supplied amounts are never used for the plan price (R6). The period itself
 * (contiguous start, anchored end) is computed in SQL under a per-seller lock.
 */
export function subscriptionGrantArgs(input: GrantSubscriptionInput) {
  return {
    p_seller: input.sellerId,
    p_provider: input.provider,
    p_provider_ref: input.providerRef,
    p_amount_cents: SELLER_PLAN.amountCents,
    p_currency: SELLER_PLAN.currency,
  };
}
