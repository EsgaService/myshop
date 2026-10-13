import type { CheckoutStore } from "./checkout-types";
import { lazyCheckoutStore } from "./lazy-checkout-store";
import { MockPaymentProvider } from "./mock-provider";
import { PaymentsDisabledError, type PaymentProvider } from "./types";
import { parseWompiConfig } from "./wompi/config";
import { WompiPaymentProvider } from "./wompi/provider";

/**
 * Resolve the active provider from env. Add real gateways here later (a per-seller gateway would
 * be another adapter resolved per seller; today the platform's single Wompi account collects everything).
 * Fails closed: mock mode and sandbox Wompi keys are refused in production (R19).
 */
export function getPaymentProvider(
  mode: string | undefined = process.env.PAYMENTS_MODE,
  nodeEnv: string | undefined = process.env.NODE_ENV,
  env: Record<string, string | undefined> = process.env,
  checkoutStore?: CheckoutStore,
): PaymentProvider {
  if (mode === "mock") {
    if (nodeEnv === "production") {
      throw new PaymentsDisabledError("Mock payments are not allowed in production");
    }
    return new MockPaymentProvider(mode, nodeEnv);
  }
  if (mode === "wompi") {
    const parsed = parseWompiConfig(env);
    if (!parsed.ok) throw new PaymentsDisabledError(`Wompi is not configured: ${parsed.error}`);
    if (nodeEnv === "production" && parsed.config.environment === "test") {
      throw new PaymentsDisabledError("Wompi sandbox keys are not allowed in production");
    }
    return new WompiPaymentProvider({ config: parsed.config, store: checkoutStore ?? lazyCheckoutStore() });
  }
  throw new PaymentsDisabledError("No payment provider is configured");
}

/** Non-throwing variant for pages: null means checkout is unavailable in this environment. */
export function tryGetPaymentProvider(
  mode: string | undefined = process.env.PAYMENTS_MODE,
  nodeEnv: string | undefined = process.env.NODE_ENV,
  env: Record<string, string | undefined> = process.env,
): PaymentProvider | null {
  try {
    return getPaymentProvider(mode, nodeEnv, env);
  } catch (e) {
    if (e instanceof PaymentsDisabledError) return null;
    throw e;
  }
}

export * from "./types";
