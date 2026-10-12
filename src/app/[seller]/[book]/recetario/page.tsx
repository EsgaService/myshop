import { notFound, redirect } from "next/navigation";
import { BookUnavailable } from "@/components/books/BookUnavailable";
import { loadBookContext } from "@/lib/access/load-book-context";
import { getBook } from "@/lib/data/queries";
import { RecipeBook } from "./RecipeBook";

export default async function BookReaderPage({ params }: { params: Promise<{ seller: string; book: string }> }) {
  const { seller: sellerSlug, book: bookSlug } = await params;
  const ctx = await loadBookContext(sellerSlug, bookSlug, "book");
  if (ctx.kind === "missing") notFound();
  if (ctx.kind === "unavailable") return <BookUnavailable />;
  if (ctx.decision.kind === "redirect") redirect(ctx.decision.to);

  const { book } = ctx;
  // These queries run under the user's RLS: without a purchase (or ownership) they return nothing anyway.
  const { categories, sections, recipes } = await getBook(book.id);

  return (
    <RecipeBook storeSlug={book.seller.is_platform ? book.slug : `${book.seller.slug}/${book.slug}`} storeName={book.title} categories={categories} sections={sections} recipes={recipes} />
  );
}
