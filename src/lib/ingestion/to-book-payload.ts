import { parseIngredient, parseYield, slugify, type Ingredient } from "@/lib/recipes/normalize-book";
import type { AiBook } from "./ai-book-schema";

/**
 * Exact payload accepted by `public.create_book_from_ingestion(p_seller, p_upload, p_payload)`
 * (see the shape comment in migration 20261012120000_marketplace_schema.sql).
 */
export type BookPayload = {
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  teaser: { intro: string[]; sample: { title: string; ingredients: string[]; steps: string[] } | null };
  categories: { slug: string; name: string; description: string | null; position: number }[];
  sections: { position: number; title: string; blocks: unknown[] }[];
  recipes: {
    category_slug: string | null;
    slug: string;
    title: string;
    position: number;
    yield_text: string | null;
    yield_servings: number;
    time_text: string | null;
    ingredients: Ingredient[];
    steps: string[];
    notes: string[];
    extras: Record<string, string>;
  }[];
};

const EXTRA_KEYS = ["adelanta", "presentacion", "conservacion", "variacion", "variacion_titulo"];

function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  used.add(slug);
  return slug;
}

export function toBookPayload(book: AiBook): BookPayload {
  const categorySlugs = new Set<string>();
  const categories: BookPayload["categories"] = [];
  const bySlugBase = new Map<string, string>(); // slugify(name) -> final unique slug

  const addCategory = (name: string, description: string | null) => {
    const base = slugify(name) || "categoria";
    const slug = uniqueSlug(base, categorySlugs);
    if (!bySlugBase.has(base)) bySlugBase.set(base, slug);
    categories.push({ slug, name, description, position: categories.length });
  };

  for (const c of book.categories) addCategory(c.name, c.description ?? null);

  const recipeSlugs = new Set<string>();
  const recipes: BookPayload["recipes"] = book.recipes.map((r, position) => {
    let category_slug: string | null = null;
    if (r.category) {
      const base = slugify(r.category) || "categoria";
      if (!bySlugBase.has(base)) addCategory(r.category, null);
      category_slug = bySlugBase.get(base) ?? null;
    }
    const extras: Record<string, string> = {};
    for (const k of EXTRA_KEYS) if (r.extras[k]) extras[k] = r.extras[k];

    return {
      category_slug,
      slug: uniqueSlug(slugify(r.title) || "receta", recipeSlugs),
      title: r.title,
      position,
      yield_text: r.yield ?? null,
      yield_servings: parseYield(r.yield),
      time_text: r.time ?? null,
      ingredients: r.ingredients.map((i) => parseIngredient(i)),
      steps: r.steps,
      notes: r.notes,
      extras,
    };
  });

  const sections = book.sections.map((s, position) => ({ position, title: s.title, blocks: s.blocks as unknown[] }));
  const intro = (book.sections[0]?.blocks ?? [])
    .flatMap((b) => (b.tipo === "p" ? [b.texto] : []))
    .slice(0, 2);
  const first = book.recipes[0];

  return {
    slug: slugify(book.title) || "recetario",
    title: book.title,
    tagline: book.tagline ?? null,
    description: book.description ?? null,
    teaser: {
      intro,
      sample: first ? { title: first.title, ingredients: first.ingredients, steps: first.steps } : null,
    },
    categories,
    sections,
    recipes,
  };
}
