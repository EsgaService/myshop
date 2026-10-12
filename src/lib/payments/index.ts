import { MockPaymentProvider } from "./mock-provider";
import { PaymentsDisabledError, type PaymentProvider } from "./types";

/** Resolve the active provider from env. Add real gateways here later. */
export function getPaymentProvider(mode: string | undefined = process.env.PAYMENTS_MODE): PaymentProvider {
  if (mode === "mock") return new MockPaymentProvider(mode);
  // Future: if (mode === "dlocal") return new DLocalGoProvider(...)
  throw new PaymentsDisabledError("No payment provider is configured");
}

export * from "./types";
