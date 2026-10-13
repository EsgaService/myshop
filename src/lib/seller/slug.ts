import { isReservedSlug } from "@/lib/routing/reserved-slugs";
import { slugify } from "@/lib/recipes/normalize-book";

const MAX_LENGTH = 40;
const FALLBACK = "tienda";

/** Derives a unique, non-reserved seller slug from a store name. */
export function toSellerSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(name).slice(0, MAX_LENGTH).replace(/-+$/, "") || FALLBACK;

  const isFree = (slug: string) => !used.has(slug) && !isReservedSlug(slug);
  if (isFree(base)) return base;

  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = base.slice(0, MAX_LENGTH - suffix.length).replace(/-+$/, "") + suffix;
    if (isFree(candidate)) return candidate;
  }
}
