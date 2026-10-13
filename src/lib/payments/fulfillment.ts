import "server-only";
import { applyPaymentEvent } from "./apply-payment-event";
import { grantPurchase, grantSubscriptionPeriod } from "./fulfill";
import { loadBookForWebhook } from "./load-webhook-book";
import type { PaymentEvent } from "./types";

/** Production wiring of applyPaymentEvent: the ONLY callers of the grants are fulfill.ts and this. */
export function fulfillPaymentEvent(event: PaymentEvent, providerId: string) {
  return applyPaymentEvent(event, providerId, { grantPurchase, grantSubscriptionPeriod, loadBookForWebhook });
}
