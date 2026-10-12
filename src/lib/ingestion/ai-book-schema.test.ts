import { describe, expect, it } from "vitest";
import { AiBookSchema, parseAiBook } from "./ai-book-schema";

const valid = {
  title: "Cócteles de la casa",
  tagline: "Veinte tragos para tus reuniones",
  description: "Un recetario práctico.",
  sections: [{ title: "Introducción", blocks: [{ tipo: "p", texto: "Bienvenido." }] }],
  categories: [{ name: "Clásicos", description: "Los de siempre" }],
  recipes: [
    {
      title: "Margarita",
      category: "Clásicos",
      yield: "2 vasos",
      time: "5 min",
      ingredients: ["60 ml de tequila", "30 ml de limón"],
      steps: ["Agita con hielo.", "Sirve."],
      notes: ["Usa limón fresco."],
    },
  ],
};

describe("AiBookSchema (R13)", () => {
  it("accepts a well-formed book", () => {
    expect(parseAiBook(valid)).toMatchObject({ ok: true });
  });

  it("applies defaults for optional collections", () => {
    const r = parseAiBook({ title: "Solo título", recipes: [{ title: "A", ingredients: ["1 limón"], steps: ["Exprime."] }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.sections).toEqual([]);
      expect(r.data.categories).toEqual([]);
      expect(r.data.recipes[0].notes).toEqual([]);
    }
  });

  it("rejects non-object payloads", () => {
    for (const bad of [null, undefined, "text", 42, []]) {
      expect(parseAiBook(bad)).toMatchObject({ ok: false });
    }
  });

  it("rejects books without a title or without recipes", () => {
    expect(parseAiBook({ ...valid, title: "" })).toMatchObject({ ok: false });
    expect(parseAiBook({ ...valid, recipes: [] })).toMatchObject({ ok: false });
  });

  it("rejects recipes without ingredients or steps", () => {
    expect(parseAiBook({ ...valid, recipes: [{ title: "X", ingredients: [], steps: ["a"] }] })).toMatchObject({ ok: false });
    expect(parseAiBook({ ...valid, recipes: [{ title: "X", ingredients: ["a"], steps: [] }] })).toMatchObject({ ok: false });
  });

  it("rejects unknown block types", () => {
    expect(parseAiBook({ ...valid, sections: [{ title: "S", blocks: [{ tipo: "script", texto: "x" }] }] })).toMatchObject({ ok: false });
  });

  it("returns a readable error message on failure", () => {
    const r = parseAiBook({ ...valid, title: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/title/);
  });

  it("exposes the schema for JSON Schema generation", () => {
    expect(AiBookSchema).toBeDefined();
  });
});
