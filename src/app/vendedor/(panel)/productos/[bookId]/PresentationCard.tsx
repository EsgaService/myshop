"use client";

import { useState, type CSSProperties } from "react";
import { BookHero } from "@/components/books/BookHero";
import { BookCard } from "@/components/ui/BookCard";
import { Card } from "@/components/ui/Card";
import { toPreviewCard } from "@/lib/books/preview-card";
import { resolveCoverUrl } from "@/lib/books/cover-url";
import { BookDetailsForm, type BookDetailsValues } from "./BookDetailsForm";
import { CoverPicker, type CoverOption } from "./CoverPicker";

export type PresentationBook = {
  id: string;
  price_cents: number;
  currency: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  cover_url: string | null;
};

/**
 * "Presentación en el marketplace": details form, cover picker and a live preview rendered with the real
 * `BookCard` and `BookHero`. The preview shows unsaved edits; each part persists with its own save action.
 */
export function PresentationCard({
  book,
  sellerSlug,
  sellerName,
  initial,
  coverOptions,
}: {
  book: PresentationBook;
  sellerSlug: string;
  sellerName: string;
  initial: BookDetailsValues;
  coverOptions: CoverOption[];
}) {
  const [details, setDetails] = useState<BookDetailsValues>(initial);
  const [savedCover, setSavedCover] = useState<string | null>(book.cover_url);
  const [previewCover, setPreviewCover] = useState<string | null>(book.cover_url);

  const card = toPreviewCard({
    title: details.title,
    tagline: details.tagline,
    sellerName,
    priceCents: book.price_cents,
    currency: book.currency,
    primaryColor: book.primary_color,
    backgroundColor: book.background_color,
    textColor: book.text_color,
    coverUrl: previewCover,
  });
  const brandVars = {
    "--brand-primary": book.primary_color,
    "--brand-secondary": book.secondary_color,
    "--brand-bg": book.background_color,
    "--brand-text": book.text_color,
  } as CSSProperties;

  return (
    <Card className="space-y-8 p-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Presentación en el marketplace</h2>
        <p className="mt-1 text-sm text-fg-muted">Así verán tu recetario los compradores. La vista previa se actualiza mientras editas.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-8">
          <section aria-label="Detalles" className="space-y-4">
            <h3 className="font-display text-lg font-semibold">Detalles</h3>
            <BookDetailsForm bookId={book.id} initial={initial} onChange={setDetails} />
          </section>
          <section aria-label="Portada" className="space-y-4">
            <h3 className="font-display text-lg font-semibold">Portada</h3>
            <CoverPicker
              bookId={book.id}
              options={coverOptions}
              savedPath={savedCover}
              onPreview={setPreviewCover}
              onSaved={(path) => {
                setSavedCover(path);
                setPreviewCover(path);
              }}
            />
          </section>
        </div>

        <aside aria-label="Vista previa" className="space-y-4 lg:sticky lg:top-6 lg:self-start" style={brandVars}>
          <p className="font-mono text-[11px] uppercase tracking-wider text-fg-muted">Vista previa</p>
          <div className="pointer-events-none select-none" aria-hidden>
            <p className="mb-2 text-xs text-fg-muted">En el marketplace</p>
            <BookCard book={card} />
          </div>
          <div className="pointer-events-none select-none" aria-hidden>
            <p className="mb-2 text-xs text-fg-muted">En la página del producto</p>
            <BookHero title={card.title} tagline={card.tagline} sellerSlug={sellerSlug} sellerName={sellerName} coverUrl={resolveCoverUrl(previewCover)} />
          </div>
        </aside>
      </div>
    </Card>
  );
}
