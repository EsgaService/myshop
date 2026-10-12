/**
 * Payment port. Adapters (mock, dLocal Go, Mercado Pago, Stripe...) implement
 * this interface. Fulfillment (writing the purchase row) is NOT done by the
 * adapter: it is done by server code that trusts either a synchronous `paid`
 * result from a trusted adapter or a verified webhook event.
 */
export type CheckoutInput = {
  userId: string;
  storeId: string;
  storeSlug: string;
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
  providerRef: string;
  userId: string;
  storeId: string;
  amountCents: number;
  currency: string;
};

export interface PaymentProvider {
  readonly id: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /**
   * Verify the signature and parse a gateway webhook. Must return null when the
   * request is not authentic. Not needed by synchronous adapters like the mock.
   */
  parseWebhook?(request: { headers: Headers; rawBody: string }): Promise<PaymentEvent | null>;
}

export class PaymentsDisabledError extends Error {
  constructor(message = "This payment provider is not enabled in the current environment") {
    super(message);
    this.name = "PaymentsDisabledError";
  }
}
