import { NextResponse } from "next/server";
import { getCurrentUser, getStore, hasPurchased } from "@/lib/data/queries";
import { getPaymentProvider, PaymentsDisabledError } from "@/lib/payments";
import { grantPurchase } from "@/lib/payments/fulfill";

export async function POST(request: Request, { params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

  const store = await getStore(slug);
  if (!store) return NextResponse.json({ error: "Tienda no encontrada." }, { status: 404 });

  if (await hasPurchased(store.id)) {
    return NextResponse.json({ ok: true, redirectTo: `/${slug}/recetario` });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await request.json();
  } catch {
    // Empty body is fine for gateways that do not need payer data.
  }

  try {
    const provider = getPaymentProvider();
    // Price and currency always come from the database, never from the client.
    const result = await provider.createCheckout({
      kind: "purchase",
      userId: user.id,
      subjectId: store.id,
      amountCents: store.price_cents,
      currency: store.currency,
      payer: { name: typeof payload.name === "string" ? payload.name : undefined, email: user.email },
      extra: payload,
      returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${slug}/recetario`,
    });

    if (result.status === "redirect") {
      return NextResponse.json({ ok: true, redirectTo: result.url });
    }

    await grantPurchase({
      userId: user.id,
      bookId: store.id, // legacy books reuse stores.id (batch 6.5 moves this route to /api/pay/book/[bookId])
      provider: provider.id,
      providerRef: result.providerRef,
      amountCents: store.price_cents,
      currency: store.currency,
    });
    return NextResponse.json({ ok: true, redirectTo: `/${slug}/recetario` });
  } catch (e) {
    if (e instanceof PaymentsDisabledError) {
      return NextResponse.json({ error: "Los pagos no están habilitados en este entorno." }, { status: 403 });
    }
    console.error("checkout failed", e);
    return NextResponse.json({ error: "No pudimos procesar el pago. Inténtalo de nuevo." }, { status: 500 });
  }
}
