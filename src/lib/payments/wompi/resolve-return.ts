import "server-only";
import { adminCheckoutStore } from "../checkout-store";
import { createRateLimiter } from "../rate-limit";
import { fulfillPaymentEvent } from "../fulfillment";
import { fetchWompiTransaction } from "./client";
import { parseWompiConfig } from "./config";
import { reconcileWompiTransaction, type ReconcileResult } from "./reconcile";

// 20 lookups per user per minute, per server instance: enough for the auto-refresh, not for id guessing.
const limiter = createRateLimiter({ max: 20, windowMs: 60_000 });

/** Production wiring of the return-page reconciliation (Wompi API + checkout store + fulfillment). */
export async function resolveWompiReturn(input: { transactionId: string; userId: string }): Promise<ReconcileResult> {
  if (process.env.PAYMENTS_MODE !== "wompi") return { state: "unknown" };
  const parsed = parseWompiConfig(process.env);
  if (!parsed.ok) return { state: "unknown" };
  const { config } = parsed;
  return reconcileWompiTransaction(
    {
      configEnvironment: config.environment,
      store: adminCheckoutStore,
      allow: (userId) => limiter.hit(userId),
      fetchTransaction: (id) => fetchWompiTransaction({ config, id }),
      apply: (event) => fulfillPaymentEvent(event, "wompi"),
    },
    input,
  );
}
