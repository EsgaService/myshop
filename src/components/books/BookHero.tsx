import Link from "next/link";
import { CoverImage } from "./CoverImage";

type BookHeroProps = {
  title: string;
  tagline?: string | null;
  sellerSlug: string;
  sellerName: string;
  /** Resolved cover URL (see `resolveCoverUrl`); null renders the branded placeholder. */
  coverUrl: string | null;
};

/** Product page header: the cover as an <img> under a contrast gradient, or the brand color when there is none. */
export function BookHero({ title, tagline, sellerSlug, sellerName, coverUrl }: BookHeroProps) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl p-8 text-center text-white shadow-lg"
      style={{ background: "var(--brand-primary)" }}
    >
      {coverUrl && <CoverImage src={coverUrl} />}
      <div className="relative">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {tagline && <p className="mt-2 text-lg opacity-90">{tagline}</p>}
        <p className="mt-3 text-sm opacity-80">
          Por <Link href={`/${sellerSlug}`} className="underline underline-offset-2">{sellerName}</Link>
        </p>
      </div>
    </section>
  );
}
