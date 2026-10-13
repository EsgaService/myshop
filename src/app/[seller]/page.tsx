import { notFound } from "next/navigation";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { BookCard } from "@/components/ui/BookCard";
import { bookPaths } from "@/lib/books/share-links";
import { getSellerBySlug, listPublishedBooksBySeller } from "@/lib/data/queries";

export async function generateMetadata({ params }: { params: Promise<{ seller: string }> }) {
  const seller = await getSellerBySlug((await params).seller);
  return seller ? { title: seller.store_name, description: seller.bio ?? undefined } : {};
}

export default async function SellerStorePage({ params }: { params: Promise<{ seller: string }> }) {
  const { seller: slug } = await params;
  const seller = await getSellerBySlug(slug);
  if (!seller) notFound();

  const books = await listPublishedBooksBySeller(seller.id);

  return (
    <>
      <LandingHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-wider text-fg-muted">Tienda</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{seller.store_name}</h1>
          {seller.bio && <p className="mt-2 max-w-2xl text-fg-muted">{seller.bio}</p>}
          {seller.city && <p className="mt-1 text-sm text-fg-muted">{seller.city}</p>}
        </header>

        {books.length === 0 ? (
          <p className="mt-10 rounded-card border border-dashed border-border-strong p-10 text-center text-fg-muted">
            Esta tienda no tiene recetarios disponibles por ahora.
          </p>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => (
              <li key={book.id}>
                <BookCard
                  book={{
                    href: bookPaths(seller.slug, book.slug).landing,
                    title: book.title,
                    tagline: book.tagline,
                    sellerName: seller.store_name,
                    priceCents: book.price_cents,
                    currency: book.currency,
                    primaryColor: book.primary_color,
                    backgroundColor: book.background_color,
                    textColor: book.text_color,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
