import { MockPaymentProvider } from "./mock-provider";
import { PaymentsDisabledError, type PaymentProvider } from "./types";

/**
 * Resolve the active provider from env. Add real gateways here later.
 * Fails closed: mock mode is refused in production (R19).
 */
export function getPaymentProvider(
  mode: string | undefined = process.env.PAYMENTS_MODE,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): PaymentProvider {
  if (mode === "mock") {
    if (nodeEnv === "production") {
      throw new PaymentsDisabledError("Mock payments are not allowed in production");
    }
    return new MockPaymentProvider(mode, nodeEnv);
  }
  // Future: if (mode === "dlocal") return new DLocalGoProvider(...)
  throw new PaymentsDisabledError("No payment provider is configured");
}

/** Non-throwing variant for pages: null means checkout is unavailable in this environment. */
export function tryGetPaymentProvider(
  mode: string | undefined = process.env.PAYMENTS_MODE,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): PaymentProvider | null {
  try {
    return getPaymentProvider(mode, nodeEnv);
  } catch (e) {
    if (e instanceof PaymentsDisabledError) return null;
    throw e;
  }
}

export * from "./types";
