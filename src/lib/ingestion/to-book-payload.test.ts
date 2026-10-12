import { describe, expect, it } from "vitest";
import { parseAiBook } from "./ai-book-schema";
import { toBookPayload } from "./to-book-payload";

function book(over: Record<string, unknown> = {}) {
  const r = parseAiBook({
    title: "Cócteles de la Casa",
    tagline: "Veinte tragos",
    description: "Desc",
    sections: [
      {
        title: "Introducción",
        blocks: [
          { tipo: "p", texto: "Primero." },
          { tipo: "h", texto: "Título" },
          { tipo: "p", texto: "Segundo." },
          { tipo: "p", texto: "Tercero." },
        ],
      },
    ],
    categories: [{ name: "Clásicos", description: "Los de siempre" }],
    recipes: [
      {
        title: "Margarita",
        category: "Clásicos",
        yield: "2 vasos",
        time: "5 min",
        ingredients: ["60 ml de tequila", "1/2 limón", "Sal al gusto"],
        steps: ["Agita.", "Sirve."],
        notes: ["Nota"],
        extras: { presentacion: "Con sal" },
      },
      { title: "Margarita", category: "Clásicos", ingredients: ["1 limón"], steps: ["Exprime."] },
      { title: "Sin categoría", ingredients: ["2 limones"], steps: ["Mezcla."] },
    ],
    ...over,
  });
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

describe("toBookPayload (R13)", () => {
  it("emits the create_book_from_ingestion payload shape", () => {
    const p = toBookPayload(book());
    expect(Object.keys(p).sort()).toEqual(["categories", "description", "recipes", "sections", "slug", "tagline", "teaser", "title"]);
    expect(p.slug).toBe("cocteles-de-la-casa");
    expect(p.title).toBe("Cócteles de la Casa");
    expect(p.categories).toEqual([{ slug: "clasicos", name: "Clásicos", description: "Los de siempre", position: 0 }]);
    expect(p.sections).toEqual([{ position: 0, title: "Introducción", blocks: expect.any(Array) }]);
  });

  it("maps recipes with parsed ingredients, yield, positions and category slugs", () => {
    const [r] = toBookPayload(book()).recipes;
    expect(r).toMatchObject({
      category_slug: "clasicos",
      slug: "margarita",
      title: "Margarita",
      position: 0,
      yield_text: "2 vasos",
      yield_servings: 2,
      time_text: "5 min",
      steps: ["Agita.", "Sirve."],
      notes: ["Nota"],
      extras: { presentacion: "Con sal" },
    });
    expect(r.ingredients).toEqual([
      { raw: "60 ml de tequila", qty: 60, rest: "ml de tequila" },
      { raw: "1/2 limón", qty: 0.5, rest: "limón" },
      { raw: "Sal al gusto", qty: null, rest: "Sal al gusto" },
    ]);
  });

  it("dedupes recipe slugs and keeps global positions", () => {
    const recipes = toBookPayload(book()).recipes;
    expect(recipes.map((r) => r.slug)).toEqual(["margarita", "margarita-2", "sin-categoria"]);
    expect(recipes.map((r) => r.position)).toEqual([0, 1, 2]);
  });

  it("uses null category_slug for recipes without category and defaults servings to 1", () => {
    const r = toBookPayload(book()).recipes[2];
    expect(r.category_slug).toBeNull();
    expect(r.yield_servings).toBe(1);
    expect(r.yield_text).toBeNull();
    expect(r.time_text).toBeNull();
  });

  it("creates missing categories referenced by recipes and dedupes category slugs", () => {
    const p = toBookPayload(
      book({
        categories: [{ name: "Clásicos" }, { name: "clasicos" }],
        recipes: [{ title: "A", category: "Postres", ingredients: ["1 limón"], steps: ["x"] }],
      }),
    );
    expect(p.categories.map((c) => c.slug)).toEqual(["clasicos", "clasicos-2", "postres"]);
    expect(p.recipes[0].category_slug).toBe("postres");
  });

  it("builds the teaser from the first paragraphs and the first recipe", () => {
    const { teaser } = toBookPayload(book());
    expect(teaser.intro).toEqual(["Primero.", "Segundo."]);
    expect(teaser.sample).toEqual({
      title: "Margarita",
      ingredients: ["60 ml de tequila", "1/2 limón", "Sal al gusto"],
      steps: ["Agita.", "Sirve."],
    });
  });

  it("falls back to a default slug when the title has no usable characters", () => {
    expect(toBookPayload(book({ title: "!!!" })).slug).toBe("recetario");
  });

  it("uses null for missing tagline and description", () => {
    const p = toBookPayload(book({ tagline: undefined, description: undefined }));
    expect(p.tagline).toBeNull();
    expect(p.description).toBeNull();
  });
});
