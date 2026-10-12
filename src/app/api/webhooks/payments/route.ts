import { NextResponse } from "next/server";
import { getPaymentProvider, PaymentsDisabledError } from "@/lib/payments";
import { grantPurchase } from "@/lib/payments/fulfill";

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
    await grantPurchase({
      userId: event.userId,
      storeId: event.storeId,
      provider: provider.id,
      providerRef: event.providerRef,
      amountCents: event.amountCents,
      currency: event.currency,
    });
  }
  return NextResponse.json({ ok: true });
}
