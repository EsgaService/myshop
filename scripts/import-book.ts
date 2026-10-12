/**
 * Import a recipe book folder into Supabase.
 *
 *   npm run import:book -- "<book folder>" --store micheladas            # writes supabase/seed-books/micheladas.sql
 *   npm run import:book -- "<book folder>" --store micheladas --apply    # upserts via service role key
 *
 * --apply needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadBook, toSql, type Book } from "./lib/book-loader";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function check<T extends { error: { message: string } | null }>(label: string, r: T): T {
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r;
}

async function apply(book: Book) {
  if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const found = check("find store", await db.from("stores").select("id").eq("slug", book.storeSlug).maybeSingle());
  if (!found.data) throw new Error(`Store "${book.storeSlug}" not found. Apply supabase/seed.sql first.`);
  const storeId = found.data.id as string;

  check("teaser", await db.from("stores").update({ teaser: book.teaser }).eq("id", storeId));
  check("clear sections", await db.from("book_sections").delete().eq("store_id", storeId));
  if (book.sections.length) {
    check(
      "sections",
      await db
        .from("book_sections")
        .insert(book.sections.map((s) => ({ store_id: storeId, position: s.position, title: s.title, blocks: s.blocks }))),
    );
  }

  const cats = check(
    "categories",
    await db
      .from("recipe_categories")
      .upsert(
        book.categories.map((c) => ({ store_id: storeId, slug: c.slug, name: c.name, description: c.description, position: c.position })),
        { onConflict: "store_id,slug" },
      )
      .select("id,slug"),
  ).data as { id: string; slug: string }[];
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  check(
    "recipes",
    await db.from("recipes").upsert(
      book.recipes.map((r) => ({
        store_id: storeId,
        category_id: r.categorySlug ? (catId.get(r.categorySlug) ?? null) : null,
        slug: r.slug,
        title: r.title,
        position: r.position,
        photo_path: r.photoPath,
        photo_people_path: r.photoPeoplePath,
        yield_text: r.yieldText,
        yield_servings: r.yieldServings,
        time_text: r.timeText,
        ingredients: r.ingredients,
        steps: r.steps,
        notes: r.notes,
        extras: r.extras,
      })),
      { onConflict: "store_id,slug" },
    ),
  );
}

async function main() {
  const dir = process.argv[2];
  const store = arg("store");
  if (!dir || dir.startsWith("--") || !store) {
    console.error('Usage: import-book "<book folder>" --store <slug> [--apply] [--out file.sql]');
    process.exit(1);
  }
  const book = loadBook(path.resolve(dir), store);
  console.log(`${store}: ${book.sections.length} sections, ${book.categories.length} categories, ${book.recipes.length} recipes`);

  if (process.argv.includes("--apply")) {
    await apply(book);
    console.log("Applied via service role.");
  } else {
    const out = path.resolve(arg("out") ?? `supabase/seed-books/${store}.sql`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, toSql(book));
    console.log(`Wrote ${out}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
