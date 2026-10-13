import type { CheckoutRecord } from "../checkout-types";
import type { PaymentEvent } from "../types";
import type { WompiEnvironment } from "./config";
import { mapWompiStatus, type WompiTransaction } from "./events";

export type WompiTransactionDecision =
  | { kind: "event"; event: PaymentEvent }
  | { kind: "ignored"; reason: "unknown_reference" | "pending" }
  | { kind: "rejected"; reason: "environment_mismatch" | "amount_mismatch" | "currency_mismatch" };

/**
 * Gate between a Wompi transaction (from a verified webhook or from a trusted server-to-server fetch)
 * and a fulfillment. Who pays, for what and how much come from OUR checkout record; the gateway data is
 * only accepted when it agrees with it. `eventEnvironment` is undefined for API-fetched transactions
 * (the API base already pins the environment).
 */
export function decideWompiTransaction(input: {
  transaction: WompiTransaction;
  checkout: CheckoutRecord | null;
  configEnvironment: WompiEnvironment;
  eventEnvironment?: WompiEnvironment;
}): WompiTransactionDecision {
  const { transaction: tx, checkout } = input;
  if (!checkout || checkout.provider !== "wompi") return { kind: "ignored", reason: "unknown_reference" };
  if (input.eventEnvironment !== undefined && input.eventEnvironment !== input.configEnvironment) {
    return { kind: "rejected", reason: "environment_mismatch" };
  }
  const status = mapWompiStatus(tx.status);
  if (status === "pending") return { kind: "ignored", reason: "pending" };

  // Only an approval moves money, so only an approval has to match what we stored.
  if (status === "approved") {
    if (tx.currency !== checkout.currency) return { kind: "rejected", reason: "currency_mismatch" };
    if (tx.amountInCents !== checkout.amountCents) return { kind: "rejected", reason: "amount_mismatch" };
  }

  return {
    kind: "event",
    event: {
      type: status === "approved" ? "payment.succeeded" : status === "voided" ? "payment.refunded" : "payment.failed",
      kind: checkout.kind,
      subjectId: checkout.subjectId,
      providerRef: checkout.reference,
      userId: checkout.userId,
      amountCents: checkout.amountCents,
      currency: checkout.currency,
      providerTransactionId: tx.id,
      gatewayStatus: status,
    },
  };
}
