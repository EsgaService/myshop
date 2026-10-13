import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookHero } from "@/components/books/BookHero";
import { BookUnavailable } from "@/components/books/BookUnavailable";
import { resolveCoverUrl } from "@/lib/books/cover-url";
import { loadTeaserPhotoUrl } from "@/lib/books/load-teaser-photo";
import { Notice } from "@/components/ui/Notice";
import { avisoMessage } from "@/lib/auth/screens";
import { loadBookContext } from "@/lib/access/load-book-context";
import { formatPrice } from "@/lib/format";

export default async function BookLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ seller: string; book: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const [{ seller: sellerSlug, book: bookSlug }, { aviso }] = await Promise.all([params, searchParams]);
  const ctx = await loadBookContext(sellerSlug, bookSlug, "landing");
  if (ctx.kind === "missing") notFound();
  if (ctx.kind === "unavailable") return <BookUnavailable />;
  if (ctx.decision.kind === "redirect") redirect(ctx.decision.to);

  const { book, role, input } = ctx;
  const sample = book.teaser.sample;
  const samplePhoto = await loadTeaserPhotoUrl(book.id, sample?.title);
  const notice = role ? avisoMessage(aviso, role) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {notice && <Notice>{notice}</Notice>}
      <BookHero
        title={book.title}
        tagline={book.tagline}
        sellerSlug={book.seller.slug}
        sellerName={book.seller.store_name}
        coverUrl={resolveCoverUrl(book.cover_url)}
      />

      <section className="mt-8 space-y-3 text-lg leading-relaxed">
        {book.description && <p>{book.description}</p>}
        {(book.teaser.intro ?? []).map((p, i) => (
          <p key={i} className="text-base opacity-80">{p}</p>
        ))}
      </section>

      {sample && (
        <section className="mt-8 rounded-2xl border border-black/10 bg-white/60 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--brand-primary)" }}>Receta de muestra</p>
          <h2 className="mt-1 text-2xl font-bold">{sample.title}</h2>
          {samplePhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={samplePhoto} alt={sample.title} loading="lazy" decoding="async" className="mt-4 aspect-[4/3] w-full rounded-xl object-cover" />
          )}
          <h3 className="mt-4 font-semibold">Ingredientes</h3>
          <ul className="mt-1 list-disc pl-5">
            {sample.ingredients.map((i, k) => <li key={k}>{i}</li>)}
          </ul>
          <p className="mt-4 text-sm opacity-70">Compra el recetario para ver los pasos y todas las demás recetas.</p>
        </section>
      )}

      <section className="mt-10 rounded-2xl p-6 text-center" style={{ background: "var(--brand-secondary)", color: "#111" }}>
        <p className="text-sm font-semibold uppercase tracking-wide">Acceso completo</p>
        <p className="mt-1 text-4xl font-extrabold">{formatPrice(book.price_cents, book.currency)}</p>
        <div className="mt-4 flex flex-col items-center gap-3">
          {input.viewer === "seller" ? (
            <p className="max-w-sm text-sm">
              {input.isOwner
                ? `Vista previa de tu producto (${book.status === "published" ? "publicado" : "borrador"}). Las cuentas de vendedor no pueden comprar.`
                : "Las cuentas de vendedor no pueden comprar recetarios."}
            </p>
          ) : !input.sellable ? (
            <p className="max-w-sm text-sm">Este recetario no está disponible para la venta por ahora.</p>
          ) : (
            <>
              {/* Anonymous visitors are sent to the buyer sign-in by the checkout route, keeping this path as `next`. */}
              <Link
                href={input.paths.checkout}
                className="inline-flex items-center justify-center rounded-full bg-book-primary px-8 py-3 font-semibold text-white"
              >
                Comprar
              </Link>
              {input.viewer === "anon" && <p className="text-sm">Inicia sesión con Google para continuar con la compra.</p>}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
