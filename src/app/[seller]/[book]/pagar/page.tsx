import { notFound, redirect } from "next/navigation";
import { BookUnavailable } from "@/components/books/BookUnavailable";
import { loadBookContext } from "@/lib/access/load-book-context";
import { formatPrice } from "@/lib/format";
import { tryGetPaymentProvider } from "@/lib/payments";
import { PayForm } from "./PayForm";
import { WompiPayButton } from "./WompiPayButton";

export default async function CheckoutPage({ params }: { params: Promise<{ seller: string; book: string }> }) {
  const { seller: sellerSlug, book: bookSlug } = await params;
  const ctx = await loadBookContext(sellerSlug, bookSlug, "checkout");
  if (ctx.kind === "missing") notFound();
  if (ctx.kind === "unavailable") return <BookUnavailable />;
  if (ctx.decision.kind === "redirect") redirect(ctx.decision.to);

  const { book, email } = ctx;
  // Goes through the provider factory so mock mode is refused in production (R19).
  const provider = tryGetPaymentProvider();

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">{book.title}</h1>
      <p className="mt-1 text-3xl font-extrabold" style={{ color: "var(--brand-primary)" }}>
        {formatPrice(book.price_cents, book.currency)}
      </p>
      <p className="mt-2 text-sm opacity-70">Compra con la cuenta {email}.</p>

      {provider?.id === "mock" ? (
        <PayForm bookId={book.id} />
      ) : provider?.id === "wompi" ? (
        <WompiPayButton bookId={book.id} />
      ) : (
        <p className="mt-8 rounded-xl border border-black/10 p-4">Los pagos aún no están habilitados. Vuelve pronto.</p>
      )}
    </main>
  );
}
