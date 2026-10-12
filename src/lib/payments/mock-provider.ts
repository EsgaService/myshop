import { randomUUID } from "node:crypto";
import { PaymentsDisabledError, type CheckoutInput, type CheckoutResult, type PaymentProvider } from "./types";

/**
 * Development-only adapter: confirms any payment. It refuses to run unless
 * PAYMENTS_MODE is exactly "mock", so it can never grant access in production.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock";

  constructor(private readonly mode: string | undefined = process.env.PAYMENTS_MODE) {}

  async createCheckout(_input: CheckoutInput): Promise<CheckoutResult> {
    if (this.mode !== "mock") {
      throw new PaymentsDisabledError("Mock payments are disabled (set PAYMENTS_MODE=mock for development)");
    }
    return { status: "paid", providerRef: `mock_${randomUUID()}` };
  }
}
