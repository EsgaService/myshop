import { NextResponse } from "next/server";
import { adminCheckoutStore } from "@/lib/payments/checkout-store";
import { fulfillPaymentEvent } from "@/lib/payments/fulfillment";
import { getPaymentProvider, PaymentsDisabledError } from "@/lib/payments";

/**
 * Webhook entry point for asynchronous gateways. Configure it in the Wompi dashboard (Events URL) as
 * `https://<domain>/api/webhooks/payments`, once for Sandbox and once for Production.
 *
 * The adapter verifies the checksum, confirms the transaction with the gateway API and checks it against our
 * own checkout record in `parseWebhook`; only then is access granted. Answers:
 * - 401 only for a bad checksum;
 * - 200 for everything that retrying cannot fix (irrelevant events, mismatches, a paid purchase that cannot be
 *   fulfilled: that one is flagged `approved_unfulfilled` for support to refund);
 * - 5xx (thrown) for transient failures, so Wompi retries at 30 min, 3 h and 24 h.
 * The mock adapter has no webhook: 501.
 */
export async function POST(request: Request) {
  let provider;
  try {
    provider = getPaymentProvider();
  } catch (e) {
    if (e instanceof PaymentsDisabledError) return NextResponse.json({ error: "disabled" }, { status: 503 });
    throw e;
  }
  if (!provider.parseWebhook) return NextResponse.json({ error: "not implemented" }, { status: 501 });

  const rawBody = await request.text();
  const outcome = await provider.parseWebhook({ headers: request.headers, rawBody });

  if (outcome.status === "invalid") return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  if (outcome.status === "ignored") return NextResponse.json({ ok: true, ignored: outcome.reason });
  if (outcome.status === "rejected") {
    console.error("payment webhook rejected", { provider: provider.id, reason: outcome.reason });
    return NextResponse.json({ ok: true, rejected: outcome.reason });
  }

  const { event } = outcome;
  const transactionId = event.providerTransactionId;
  if (!transactionId) return NextResponse.json({ ok: true, ignored: "no_transaction" });

  if (event.type === "payment.succeeded") {
    const applied = await fulfillPaymentEvent(event, provider.id);
    if (!applied.ok) {
      console.error("payment approved but not fulfilled: refund manually", { providerRef: event.providerRef, reason: applied.reason });
      await adminCheckoutStore.recordOutcome(event.providerRef, { status: "approved_unfulfilled", providerTransactionId: transactionId });
      return NextResponse.json({ ok: true, unfulfilled: applied.reason });
    }
    await adminCheckoutStore.recordOutcome(event.providerRef, { status: "approved", providerTransactionId: transactionId });
    return NextResponse.json({ ok: true });
  }

  // Declined, error or voided: record the real status. A voided payment after an approval keeps the access
  // (product decision) and is only flagged for manual review.
  await adminCheckoutStore.recordOutcome(event.providerRef, { status: event.gatewayStatus ?? "declined", providerTransactionId: transactionId });
  return NextResponse.json({ ok: true });
}
