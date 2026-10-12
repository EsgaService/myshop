import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { getStore } from "@/lib/data/queries";

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }) {
  const store = await getStore((await params).store);
  return store ? { title: store.name, description: store.tagline ?? undefined } : {};
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();

  const vars = {
    "--brand-primary": store.primary_color,
    "--brand-secondary": store.secondary_color,
    "--brand-bg": store.background_color,
    "--brand-text": store.text_color,
    "--brand-font": `"${store.font}", system-ui, sans-serif`,
  } as CSSProperties;

  return (
    <>
      <SiteHeader currentSlug={store.slug} />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(store.font).replace(/%20/g, "+")}:wght@400;600;700&display=swap`} />
      <div style={vars} className="min-h-[calc(100dvh-57px)] bg-surface text-ink [font-family:var(--brand-font)]">
        {children}
      </div>
    </>
  );
}
