import type { ApplyResult } from "../apply-payment-event";
import type { CheckoutStore } from "../checkout-types";
import type { PaymentEvent, PaymentKind } from "../types";
import type { FetchTransactionResult } from "./client";
import type { WompiEnvironment } from "./config";
import { decideWompiTransaction } from "./decide-transaction";

export type ReconcileResult =
  | { state: "approved" | "pending" | "declined" | "problem" | "unfulfilled"; kind: PaymentKind; subjectId: string }
  | { state: "unknown" | "unavailable" };

export type ReconcileDeps = {
  configEnvironment: WompiEnvironment;
  store: CheckoutStore;
  /** Per-user guard against hammering the gateway API with arbitrary ids. */
  allow(userId: string): boolean;
  fetchTransaction(id: string): Promise<FetchTransactionResult>;
  apply(event: PaymentEvent): Promise<ApplyResult>;
};

/**
 * Return-page reconciliation. The `?id=` of the redirect proves nothing. Order of trust:
 * 1. our own record of this user's transaction (already settled by the webhook): no gateway call;
 * 2. only for a user who ever started a checkout, and within a rate limit, read the transaction from Wompi
 *    server-to-server, match it to OUR checkout (which must belong to the user) and fulfil through the same
 *    idempotent path as the webhook.
 */
export async function reconcileWompiTransaction(
  deps: ReconcileDeps,
  input: { transactionId: string; userId: string },
): Promise<ReconcileResult> {
  const known = await deps.store.findByUserAndTransaction(input.userId, input.transactionId);
  if (known?.status === "approved") return { state: "approved", kind: known.kind, subjectId: known.subjectId };
  if (known?.status === "approved_unfulfilled") return { state: "unfulfilled", kind: known.kind, subjectId: known.subjectId };

  if (!(await deps.store.userHasCheckouts(input.userId))) return { state: "unknown" };
  if (!deps.allow(input.userId)) return { state: "unavailable" };

  const fetched = await deps.fetchTransaction(input.transactionId);
  if (!fetched.ok) return { state: fetched.reason === "not_found" ? "unknown" : "unavailable" };
  const tx = fetched.transaction;

  const checkout = await deps.store.findByReference(tx.reference);
  if (!checkout || checkout.userId !== input.userId) return { state: "unknown" };
  const ref = { kind: checkout.kind, subjectId: checkout.subjectId };

  const decision = decideWompiTransaction({ transaction: tx, checkout, configEnvironment: deps.configEnvironment });
  if (decision.kind === "rejected") return { state: "problem", ...ref };
  if (decision.kind === "ignored") return { state: "pending", ...ref };

  const { event } = decision;
  if (event.type === "payment.succeeded") {
    const applied = await deps.apply(event);
    if (!applied.ok) {
      await deps.store.recordOutcome(checkout.reference, { status: "approved_unfulfilled", providerTransactionId: tx.id });
      return { state: "unfulfilled", ...ref };
    }
    await deps.store.recordOutcome(checkout.reference, { status: "approved", providerTransactionId: tx.id });
    return { state: "approved", ...ref };
  }

  await deps.store.recordOutcome(checkout.reference, { status: event.gatewayStatus ?? "declined", providerTransactionId: tx.id });
  return { state: "declined", ...ref };
}
