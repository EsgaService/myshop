import type { BookCardData } from "@/components/ui/BookCard";
import type { BookWithSeller } from "@/lib/data/types";
import { resolveCoverUrl } from "./cover-url";
import { bookPaths } from "./share-links";

/** Maps a book with its seller to the data a marketplace card needs. */
export function toBookCard(book: BookWithSeller): BookCardData {
  return {
    href: bookPaths(book.seller.slug, book.slug).landing,
    title: book.title,
    tagline: book.tagline,
    sellerName: book.seller.store_name,
    priceCents: book.price_cents,
    currency: book.currency,
    primaryColor: book.primary_color,
    backgroundColor: book.background_color,
    textColor: book.text_color,
    coverUrl: resolveCoverUrl(book.cover_url),
  };
}
