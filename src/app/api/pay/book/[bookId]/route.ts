import { NextResponse } from "next/server";
import { bookPaths } from "@/lib/books/share-links";
import { getBookById, getCurrentUser, getProfile, hasPurchasedBook } from "@/lib/data/queries";
import { getPaymentProvider, PaymentsDisabledError } from "@/lib/payments";
import { decidePurchase } from "@/lib/payments/decide-purchase";
import { grantPurchase } from "@/lib/payments/fulfill";
import { resolveSiteOrigin } from "@/lib/payments/site-origin";
import { getSellerAccess } from "@/lib/seller/access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  if (!UUID.test(bookId)) return NextResponse.json({ error: "Recetario no encontrado." }, { status: 404 });

  const user = await getCurrentUser();
  const profile = user ? await getProfile() : null;
  const book = user && profile?.role === "buyer" ? await getBookById(bookId) : null;

  const decision = decidePurchase({
    role: user ? (profile?.role ?? null) : null,
    book,
    sellerAccess: book ? await getSellerAccess(book.seller_id, book.seller.is_platform) : { canPublish: false, isListed: false, canSell: false },
    alreadyOwned: book ? await hasPurchasedBook(book.id) : false,
  });
  if (decision.kind === "deny") return NextResponse.json({ error: decision.error }, { status: decision.status });
  if (!user || !book) return NextResponse.json({ error: "Recetario no encontrado." }, { status: 404 });

  const paths = bookPaths(book.seller.slug, book.slug);
  if (decision.kind === "already-owned") return NextResponse.json({ ok: true, redirectTo: paths.book });

  let payload: Record<string, unknown> = {};
  try {
    payload = await request.json();
  } catch {
    // Empty body is fine for gateways that do not need payer data.
  }

  try {
    const provider = getPaymentProvider();
    // Configured site URL; outside production the request origin is an acceptable fallback.
    const origin = resolveSiteOrigin({
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      requestOrigin: new URL(request.url).origin,
      nodeEnv: process.env.NODE_ENV,
    });
    // Price and currency always come from the database, never from the client.
    const result = await provider.createCheckout({
      kind: "purchase",
      userId: user.id,
      subjectId: book.id,
      amountCents: book.price_cents,
      currency: book.currency,
      payer: { name: typeof payload.name === "string" ? payload.name : undefined, email: user.email },
      extra: payload,
      returnUrl: `${origin ?? ""}${paths.book}`,
    });

    if (result.status === "redirect") {
      return NextResponse.json({ ok: true, redirectTo: result.url });
    }

    await grantPurchase({
      userId: user.id,
      bookId: book.id,
      provider: provider.id,
      providerRef: result.providerRef,
      amountCents: book.price_cents,
      currency: book.currency,
    });
    return NextResponse.json({ ok: true, redirectTo: paths.book });
  } catch (e) {
    if (e instanceof PaymentsDisabledError) {
      console.error("checkout refused", e.message);
      return NextResponse.json({ error: "Los pagos no están habilitados en este entorno." }, { status: 403 });
    }
    console.error("checkout failed", e);
    return NextResponse.json({ error: "No pudimos procesar el pago. Inténtalo de nuevo." }, { status: 500 });
  }
}
