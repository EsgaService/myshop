import { slugify } from "@/lib/recipes/normalize-book";

const MAX_LENGTH = 60;
const FALLBACK = "recetario";

/**
 * Ordered slug candidates for a new product: the slugified name, then `-2`, `-3`, ...
 * The caller tries them in order until the (seller_id, slug) unique constraint accepts one.
 */
export function productSlugCandidates(name: string, count: number): string[] {
  const base = slugify(name).slice(0, MAX_LENGTH).replace(/-+$/, "") || FALLBACK;
  const candidates = [base];
  for (let n = 2; candidates.length < count; n++) {
    const suffix = `-${n}`;
    candidates.push(base.slice(0, MAX_LENGTH - suffix.length).replace(/-+$/, "") + suffix);
  }
  return candidates.slice(0, count);
}
