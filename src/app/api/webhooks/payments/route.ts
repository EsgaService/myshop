import { NextResponse } from "next/server";
import { getPaymentProvider, PaymentsDisabledError } from "@/lib/payments";
import { decideWebhookPurchase } from "@/lib/payments/decide-webhook-purchase";
import { grantPurchase, grantSubscriptionPeriod } from "@/lib/payments/fulfill";
import { loadBookForWebhook } from "@/lib/payments/load-webhook-book";

/**
 * Webhook entry point for asynchronous gateways (dLocal Go, Mercado Pago, Stripe...).
 * The adapter verifies the signature in `parseWebhook`; only then is a purchase written.
 * The mock adapter has no webhook, so this returns 501 in mock mode.
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
  const event = await provider.parseWebhook({ headers: request.headers, rawBody });
  if (!event) return NextResponse.json({ error: "invalid signature" }, { status: 400 });

  if (event.type === "payment.succeeded") {
    if (event.kind === "subscription") {
      await grantSubscriptionPeriod({ sellerId: event.subjectId, provider: provider.id, providerRef: event.providerRef });
    } else {
      // The signature proves the gateway sent it, not that the amount matches our price.
      const { book, sellerCanSell } = await loadBookForWebhook(event.subjectId);
      const decision = decideWebhookPurchase({
        book,
        event: { amountCents: event.amountCents, currency: event.currency },
        sellerCanSell,
      });
      if (!decision.ok) {
        console.error("payment webhook refused", {
          reason: decision.reason,
          provider: provider.id,
          providerRef: event.providerRef,
          bookId: event.subjectId,
          amountCents: event.amountCents,
          currency: event.currency,
        });
        return NextResponse.json({ error: "payment mismatch", reason: decision.reason }, { status: 422 });
      }
      await grantPurchase({
        userId: event.userId,
        bookId: event.subjectId,
        provider: provider.id,
        providerRef: event.providerRef,
        amountCents: event.amountCents,
        currency: event.currency,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
