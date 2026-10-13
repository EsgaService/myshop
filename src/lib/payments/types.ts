/**
 * Payment port. Adapters (mock, Wompi, ...) implement
 * this interface. Fulfillment (writing the purchase row) is NOT done by the
 * adapter: it is done by server code that trusts either a synchronous `paid`
 * result from a trusted adapter or a verified webhook event.
 */
export type PaymentKind = "purchase" | "subscription";

export type CheckoutInput = {
  kind: PaymentKind;
  userId: string;
  /** bookId for purchases, sellerId for subscriptions. */
  subjectId: string;
  amountCents: number;
  currency: string;
  payer: { name?: string; email?: string };
  /** Adapter-specific opaque data (e.g. mock card fields). Never persisted. */
  extra?: Record<string, unknown>;
  /** Absolute URLs for hosted-checkout gateways. */
  returnUrl?: string;
};

export type CheckoutResult =
  /** Payment already confirmed (mock, or gateways with synchronous confirmation). */
  | { status: "paid"; providerRef: string }
  /** Hosted checkout: send the browser to `url`; access is granted later via webhook. */
  | { status: "redirect"; providerRef: string; url: string };

export type PaymentEvent = {
  type: "payment.succeeded" | "payment.failed" | "payment.refunded";
  kind: PaymentKind;
  /** bookId for purchases, sellerId for subscriptions. */
  subjectId: string;
  providerRef: string;
  userId: string;
  amountCents: number;
  currency: string;
  /** Gateway-side transaction id, kept for support and reconciliation. */
  providerTransactionId?: string;
  /** The real gateway status behind the event (a voided payment is not the same as a declined one). */
  gatewayStatus?: "approved" | "declined" | "voided" | "error";
};

/**
 * Result of verifying and interpreting a gateway webhook.
 * - `invalid`: the request is not authentic (bad signature, malformed body).
 * - `ignored`: authentic but nothing to do (pending, unrelated event, unknown reference). Answer 200.
 * - `rejected`: authentic but must not be fulfilled (amount, currency or environment mismatch).
 * - `event`: authentic and consistent with our own checkout record.
 */
export type WebhookOutcome =
  | { status: "invalid" }
  | { status: "ignored"; reason: string }
  | { status: "rejected"; reason: string }
  | { status: "event"; event: PaymentEvent };

export interface PaymentProvider {
  readonly id: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /**
   * Verify the signature and interpret a gateway webhook. Must answer `invalid` when the
   * request is not authentic. Not needed by synchronous adapters like the mock.
   */
  parseWebhook?(request: { headers: Headers; rawBody: string }): Promise<WebhookOutcome>;
}

export class PaymentsDisabledError extends Error {
  constructor(message = "This payment provider is not enabled in the current environment") {
    super(message);
    this.name = "PaymentsDisabledError";
  }
}
