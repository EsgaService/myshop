import Link from "next/link";
import { formatPrice } from "@/lib/format";

export type BookCardData = {
  href: string;
  title: string;
  tagline?: string | null;
  sellerName: string;
  priceCents: number;
  currency: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
};

export function BookCard({ book }: { book: BookCardData }) {
  return (
    <Link
      href={book.href}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative h-36 p-5" style={{ background: book.backgroundColor, color: book.textColor, borderBottom: `5px solid ${book.primaryColor}` }}>
        <p className="font-display text-xl font-semibold leading-tight" style={{ color: book.primaryColor }}>{book.title}</p>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-5">
        <p className="font-mono text-[11px] uppercase tracking-wider text-fg-muted">{book.sellerName}</p>
        {book.tagline && <p className="line-clamp-2 text-sm text-fg-muted">{book.tagline}</p>}
        <p className="mt-auto pt-4 font-mono text-sm font-semibold tabular-nums">{formatPrice(book.priceCents, book.currency)}</p>
      </div>
    </Link>
  );
}
