import type { CSSProperties } from "react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { getBookBySlugs } from "@/lib/data/queries";

type Params = Promise<{ seller: string; book: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { seller, book: bookSlug } = await params;
  const book = await getBookBySlugs(seller, bookSlug);
  return book ? { title: book.title, description: book.tagline ?? undefined } : {};
}

export default async function BookLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { seller, book: bookSlug } = await params;
  const book = await getBookBySlugs(seller, bookSlug);

  // Missing or unavailable books render their own state inside the app chrome (no branding).
  if (!book) {
    return (
      <>
        <LandingHeader />
        {children}
      </>
    );
  }

  const vars = {
    "--brand-primary": book.primary_color,
    "--brand-secondary": book.secondary_color,
    "--brand-bg": book.background_color,
    "--brand-text": book.text_color,
    "--brand-font": `"${book.font}", system-ui, sans-serif`,
  } as CSSProperties;

  return (
    <>
      <LandingHeader />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(book.font).replace(/%20/g, "+")}:wght@400;600;700&display=swap`} />
      <div style={vars} className="min-h-[calc(100dvh-57px)] bg-book-surface text-book-ink [font-family:var(--brand-font)]">
        {children}
      </div>
    </>
  );
}
