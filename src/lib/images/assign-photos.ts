import type { RecipeMatch } from "./match-recipes";
import type { Placement } from "./types";

export type PhotoAssignment = { recipeId: string; sourcePage: number; placement: Placement };

const area = (p: Placement) => p.bbox.w * p.bbox.h;
const centerY = (p: Placement) => p.bbox.y + p.bbox.h / 2;

/**
 * Gives each matched recipe the best unused image inside its page range (R1.5).
 * Order of preference: title page first, then the nearest later page. On a page that carries a
 * single title the largest image wins; when several titles share the page, the image whose
 * vertical center is nearest to the title wins. An image is never reused.
 */
export function assignPhotos(matches: RecipeMatch[], kept: Placement[]): PhotoAssignment[] {
  const titlesPerPage = new Map<number, number>();
  for (const m of matches) {
    if (m.titlePage !== null) titlesPerPage.set(m.titlePage, (titlesPerPage.get(m.titlePage) ?? 0) + 1);
  }

  const used = new Set<Placement>();
  const out: PhotoAssignment[] = [];

  for (const m of matches) {
    if (m.titlePage === null || m.range === null) continue;
    const [start, end] = m.range;
    const titlePage = m.titlePage;
    const shared = (titlesPerPage.get(titlePage) ?? 0) > 1;

    const best = kept
      .filter((p) => !used.has(p) && p.page >= start && p.page <= end)
      .sort((a, b) => {
        if (a.page !== b.page) {
          const pa = a.page - titlePage;
          const pb = b.page - titlePage;
          if (pa !== pb) return pa - pb;
        }
        if (shared && a.page === titlePage && m.titleY !== null) {
          const da = Math.abs(centerY(a) - m.titleY);
          const db = Math.abs(centerY(b) - m.titleY);
          if (da !== db) return da - db;
        }
        return area(b) - area(a) || a.opIndex - b.opIndex;
      })[0];

    if (best) {
      used.add(best);
      out.push({ recipeId: m.recipeId, sourcePage: titlePage, placement: best });
    }
  }
  return out;
}
