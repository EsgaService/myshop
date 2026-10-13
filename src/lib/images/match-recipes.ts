import { normalizeTitle, titleSimilarity } from "./normalize-title";
import type { PageText } from "./types";

export const TITLE_SIMILARITY_MIN = 0.8;
/** A page that matches at least this share of the recipes (and 3+) is an index, never an anchor. */
const INDEX_PAGE_MIN_MATCHES = 3;
const INDEX_PAGE_MIN_SHARE = 0.3;

export type RecipeTitle = { id: string; title: string };

export type RecipeMatch = {
  recipeId: string;
  titlePage: number | null;
  /** y of the matched title line on its page (top-left origin). */
  titleY: number | null;
  /** [titlePage, nextTitlePage - 1] (inclusive), the last matched recipe goes up to the page count. */
  range: [number, number] | null;
};

type Hit = { page: number; y: number };

function lineMatchesTitle(line: string, title: string): boolean {
  const l = normalizeTitle(line);
  const t = normalizeTitle(title);
  if (l === "" || t === "") return false;
  if (` ${l} `.includes(` ${t} `)) return true;
  return titleSimilarity(l, t) >= TITLE_SIMILARITY_MIN;
}

/**
 * Anchors each recipe (given in PDF order) to the page that carries its title (R1.5).
 * Index pages are ignored, the walk never goes backwards, and unmatched recipes stay unmatched.
 */
export function matchRecipesToPages(recipes: RecipeTitle[], pages: PageText[], pageCount?: number): RecipeMatch[] {
  const lastPage = pageCount ?? pages.reduce((max, p) => Math.max(max, p.page), 0);

  const hitsByRecipe = recipes.map((r) => {
    const hits: Hit[] = [];
    for (const p of pages) {
      for (const line of p.lines) if (lineMatchesTitle(line.text, r.title)) hits.push({ page: p.page, y: line.y });
    }
    return hits;
  });

  const matchedRecipesPerPage = new Map<number, number>();
  for (const hits of hitsByRecipe) {
    for (const page of new Set(hits.map((h) => h.page))) {
      matchedRecipesPerPage.set(page, (matchedRecipesPerPage.get(page) ?? 0) + 1);
    }
  }
  const indexThreshold = Math.max(INDEX_PAGE_MIN_MATCHES, Math.ceil(recipes.length * INDEX_PAGE_MIN_SHARE));
  const indexPages = new Set([...matchedRecipesPerPage].filter(([, n]) => n >= indexThreshold).map(([page]) => page));

  let cursor: Hit = { page: 0, y: -Infinity };
  const anchors = recipes.map((r, i) => {
    const hit = hitsByRecipe[i]
      .filter((h) => !indexPages.has(h.page))
      .sort((a, b) => a.page - b.page || a.y - b.y)
      .find((h) => h.page > cursor.page || (h.page === cursor.page && h.y > cursor.y));
    if (hit) cursor = hit;
    return { recipeId: r.id, hit };
  });

  const matched = anchors.filter((a) => a.hit);
  return anchors.map((a) => {
    if (!a.hit) return { recipeId: a.recipeId, titlePage: null, titleY: null, range: null };
    const hit = a.hit;
    const next = matched[matched.indexOf(a) + 1]?.hit;
    const end = !next ? Math.max(lastPage, hit.page) : next.page === hit.page ? hit.page : next.page - 1;
    return { recipeId: a.recipeId, titlePage: hit.page, titleY: hit.y, range: [hit.page, end] as [number, number] };
  });
}
