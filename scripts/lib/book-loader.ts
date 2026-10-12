// Reads the pdf-bebidas folder layouts and turns them into a normalized Book,
// then renders that Book as idempotent SQL.
import fs from "node:fs";
import path from "node:path";
import { parseIngredient, parseYield, slugify, type Ingredient } from "../../src/lib/recipes/normalize-book";

export type Block = { tipo: string; [k: string]: unknown };
export type Section = { title: string; position: number; blocks: Block[] };
export type Category = { slug: string; name: string; description: string | null; position: number };
export type Recipe = {
  slug: string;
  title: string;
  position: number;
  categorySlug: string | null;
  photoPath: string | null;
  photoPeoplePath: string | null;
  yieldText: string | null;
  yieldServings: number;
  timeText: string | null;
  ingredients: Ingredient[];
  steps: string[];
  notes: string[];
  extras: Record<string, string>;
};
export type Book = {
  storeSlug: string;
  sections: Section[];
  categories: Category[];
  recipes: Recipe[];
  teaser: { intro: string[]; sample: { title: string; ingredients: string[]; steps: string[] } | null };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function readJson(file: string): Json {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadPhotos(dir: string): Record<string, { foto?: string; gente?: string }> {
  const out: Record<string, { foto?: string; gente?: string }> = {};
  for (const name of fs.readdirSync(dir)) {
    if (!/^fotos.*\.json$/.test(name)) continue;
    const data = readJson(path.join(dir, name));
    Object.assign(out, data.recetas ?? data);
  }
  return out;
}

const stripStepNumber = (s: string) => s.replace(/^\s*\d+[.)]\s*/, "").trim();
const lines = (s: unknown) =>
  String(s ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
const withPhoto = (storeSlug: string, file?: string) => (file ? `${storeSlug}/${file}` : null);

/** Supports `libro.json` (categorias[].recetas[]) and the older `recetas.json` (capitalized Spanish keys). */
export function loadBook(dir: string, storeSlug: string): Book {
  const photos = loadPhotos(dir);
  const libroFile = path.join(dir, "libro.json");
  const recetasFile = path.join(dir, "recetas.json");

  const sections: Section[] = [];
  const categories: Category[] = [];
  const recipes: Recipe[] = [];
  let pos = 0;

  const pushRecipe = (r: Omit<Recipe, "position" | "photoPath" | "photoPeoplePath">) => {
    const ph = photos[r.slug];
    recipes.push({
      ...r,
      position: pos++,
      photoPath: withPhoto(storeSlug, ph?.foto),
      photoPeoplePath: withPhoto(storeSlug, ph?.gente),
    });
  };

  if (fs.existsSync(libroFile)) {
    const j = readJson(libroFile);
    (j.secciones ?? []).forEach((s: Json, i: number) => sections.push({ title: s.titulo, position: i, blocks: s.bloques ?? [] }));
    (j.categorias ?? []).forEach((c: Json, ci: number) => {
      const cslug = c.slug || slugify(c.nombre);
      categories.push({ slug: cslug, name: c.nombre, description: c.desc ?? null, position: ci });
      for (const r of c.recetas ?? []) {
        const extras: Record<string, string> = {};
        for (const k of ["adelanta", "presentacion", "conservacion", "variacion", "variacion_titulo"]) if (r[k]) extras[k] = r[k];
        pushRecipe({
          slug: r.slug || slugify(r.titulo),
          title: r.titulo,
          categorySlug: cslug,
          yieldText: r.rinde ?? null,
          yieldServings: parseYield(r.rinde),
          timeText: r.tiempo ?? null,
          ingredients: (r.ingredientes ?? []).map((x: string) => parseIngredient(x)),
          steps: r.pasos ?? [],
          notes: r.notas ?? [],
          extras,
        });
      }
    });
  } else if (fs.existsSync(recetasFile)) {
    const j = readJson(recetasFile);
    const cats: Record<string, string> = j.categorias ?? {};
    Object.entries(cats).forEach(([name, desc], i) => categories.push({ slug: slugify(name), name, description: desc, position: i }));
    for (const r of j.recetas ?? []) {
      const extras: Record<string, string> = {};
      if (r["Qué se adelanta y qué se hace al servir"]) extras.adelanta = r["Qué se adelanta y qué se hace al servir"];
      if (r["Presentación"]) extras.presentacion = r["Presentación"];
      if (r["Conservación"]) extras.conservacion = r["Conservación"];
      if (r["Variación sin alcohol"]) {
        extras.variacion = r["Variación sin alcohol"];
        extras.variacion_titulo = "Sin alcohol";
      }
      pushRecipe({
        slug: slugify(r.titulo),
        title: r.titulo,
        categorySlug: r.categoria ? slugify(r.categoria) : null,
        yieldText: r.Rinde ?? null,
        yieldServings: parseYield(r.Rinde),
        timeText: r.Tiempo ?? null,
        ingredients: lines(r.Ingredientes).map((x) => parseIngredient(x)),
        steps: lines(r.Pasos).map(stripStepNumber),
        notes: [],
        extras,
      });
    }
  } else {
    throw new Error(`No libro.json or recetas.json found in ${dir}`);
  }

  const intro = (sections[0]?.blocks ?? [])
    .filter((b) => b.tipo === "p")
    .slice(0, 2)
    .map((b) => String(b.texto));
  const first = recipes[0];
  return {
    storeSlug,
    sections,
    categories,
    recipes,
    teaser: {
      intro,
      sample: first ? { title: first.title, ingredients: first.ingredients.map((i) => i.raw), steps: first.steps } : null,
    },
  };
}

// SQL emission ---------------------------------------------------------------
const lit = (v: string | null) => (v === null ? "null" : "'" + v.replace(/'/g, "''") + "'");
const json = (v: unknown) => lit(JSON.stringify(v)) + "::jsonb";

export function toSql(book: Book): string {
  const slug = lit(book.storeSlug);
  const sid = `(select id from public.stores where slug = ${slug})`;
  const out: string[] = [
    `-- Generated by scripts/import-book.ts for store ${book.storeSlug}. Safe to re-run.`,
    "begin;",
    `do $chk$ begin if ${sid} is null then raise exception 'Store not found: run supabase/seed.sql first'; end if; end $chk$;`,
    `update public.stores set teaser = ${json(book.teaser)} where slug = ${slug};`,
    `delete from public.book_sections where store_id = ${sid};`,
  ];
  for (const s of book.sections) {
    out.push(
      `insert into public.book_sections (store_id, position, title, blocks) values (${sid}, ${s.position}, ${lit(s.title)}, ${json(s.blocks)});`,
    );
  }
  for (const c of book.categories) {
    out.push(
      `insert into public.recipe_categories (store_id, slug, name, description, position) values (${sid}, ${lit(c.slug)}, ${lit(c.name)}, ${lit(c.description)}, ${c.position}) ` +
        `on conflict (store_id, slug) do update set name = excluded.name, description = excluded.description, position = excluded.position;`,
    );
  }
  for (const r of book.recipes) {
    const cat = r.categorySlug
      ? `(select id from public.recipe_categories where store_id = ${sid} and slug = ${lit(r.categorySlug)})`
      : "null";
    out.push(
      `insert into public.recipes (store_id, category_id, slug, title, position, photo_path, photo_people_path, yield_text, yield_servings, time_text, ingredients, steps, notes, extras) values ` +
        `(${sid}, ${cat}, ${lit(r.slug)}, ${lit(r.title)}, ${r.position}, ${lit(r.photoPath)}, ${lit(r.photoPeoplePath)}, ${lit(r.yieldText)}, ${r.yieldServings}, ${lit(r.timeText)}, ${json(r.ingredients)}, ${json(r.steps)}, ${json(r.notes)}, ${json(r.extras)}) ` +
        `on conflict (store_id, slug) do update set category_id = excluded.category_id, title = excluded.title, position = excluded.position, photo_path = excluded.photo_path, photo_people_path = excluded.photo_people_path, yield_text = excluded.yield_text, yield_servings = excluded.yield_servings, time_text = excluded.time_text, ingredients = excluded.ingredients, steps = excluded.steps, notes = excluded.notes, extras = excluded.extras;`,
    );
  }
  out.push("commit;", "");
  return out.join("\n");
}
