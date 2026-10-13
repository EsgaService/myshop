import type { CheckoutStatus } from "./checkout-types";

/**
 * Which stored statuses an outcome may overwrite. Encodes the state machine of `payment_checkouts`:
 * - approved is final except for a later VOIDED (kept for manual review, access is NOT revoked);
 * - approved_unfulfilled (paid, but access could not be granted) is a support flag, only voided/approved replace it;
 * - declined/error never downgrade a paid, unfulfilled or voided checkout.
 */
export function allowedPreviousStatuses(to: CheckoutStatus): CheckoutStatus[] {
  switch (to) {
    case "approved":
      return ["pending", "declined", "error", "approved_unfulfilled", "approved"];
    case "voided":
      return ["pending", "declined", "error", "approved", "approved_unfulfilled", "voided"];
    case "approved_unfulfilled":
      return ["pending", "declined", "error", "approved_unfulfilled"];
    case "declined":
    case "error":
      return ["pending", "declined", "error"];
    default:
      return [];
  }
}

/** A pending checkout needs at least this much validity left to be handed out again. */
export const REUSE_MIN_REMAINING_MS = 10 * 60 * 1000;

/** Whether an earlier checkout of the same user+subject can be reused instead of creating a second one. */
export function isReusableCheckout(record: { status: CheckoutStatus; expiresAt: string | null }, now: Date): boolean {
  if (record.status !== "pending" || !record.expiresAt) return false;
  const expires = Date.parse(record.expiresAt);
  return Number.isFinite(expires) && expires - now.getTime() >= REUSE_MIN_REMAINING_MS;
}
