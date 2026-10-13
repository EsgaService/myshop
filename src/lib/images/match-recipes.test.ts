import { describe, expect, it } from "vitest";
import { matchRecipesToPages } from "./match-recipes";
import type { PageText } from "./types";

const page = (n: number, ...lines: (string | [string, number])[]): PageText => ({
  page: n,
  lines: lines.map((l, i) => (typeof l === "string" ? { text: l, y: 50 + i * 20 } : { text: l[0], y: l[1] })),
});

const recipes = [
  { id: "r1", title: "Margarita Clásica" },
  { id: "r2", title: "Mojito" },
  { id: "r3", title: "Daiquiri de Fresa" },
];

describe("matchRecipesToPages (R1.5)", () => {
  it("anchors each recipe on the page that carries its title, in PDF order", () => {
    const pages = [
      page(1, "Portada"),
      page(2, "MARGARITA CLASICA", "Ingredientes"),
      page(3, "Mojito", "Ingredientes"),
      page(4, "Daiquiri de Fresa"),
    ];
    const out = matchRecipesToPages(recipes, pages);
    expect(out.map((m) => [m.recipeId, m.titlePage])).toEqual([
      ["r1", 2],
      ["r2", 3],
      ["r3", 4],
    ]);
  });

  it("builds page ranges [titlePage, nextTitlePage - 1], the last one up to the page count", () => {
    const pages = [page(1, "Margarita Clásica"), page(3, "Mojito"), page(6, "Daiquiri de Fresa"), page(8, "Fin")];
    const out = matchRecipesToPages(recipes, pages, 9);
    expect(out.map((m) => m.range)).toEqual([
      [1, 2],
      [3, 5],
      [6, 9],
    ]);
  });

  it("ignores table-of-contents pages that list many titles", () => {
    const pages = [
      page(1, "Indice", "Margarita Clásica .... 3", "Mojito .... 4", "Daiquiri de Fresa .... 5"),
      page(3, "Margarita Clásica"),
      page(4, "Mojito"),
      page(5, "Daiquiri de Fresa"),
    ];
    const out = matchRecipesToPages(recipes, pages);
    expect(out.map((m) => m.titlePage)).toEqual([3, 4, 5]);
  });

  it("matches by token similarity when the page text is not an exact substring", () => {
    // Same tokens in a different order: not a substring, but token similarity is 1.
    const pages = [page(2, "Fresa de Daiquiri")];
    const out = matchRecipesToPages([{ id: "r3", title: "Daiquiri de Fresa" }], pages);
    expect(out[0].titlePage).toBe(2);
  });

  it("does not match titles that are only loosely similar", () => {
    const pages = [page(2, "Daiquiri de Mango Verde Tropical")];
    const out = matchRecipesToPages([{ id: "r3", title: "Daiquiri de Fresa" }], pages);
    expect(out[0].titlePage).toBeNull();
    expect(out[0].range).toBeNull();
  });

  it("leaves a recipe unmatched without breaking the walk, and keeps page order", () => {
    // r2 (Mojito) only appears BEFORE r1 in the PDF; r1 is on page 5, so r2 cannot go backwards.
    const pages = [page(2, "Mojito"), page(5, "Margarita Clásica"), page(7, "Daiquiri de Fresa")];
    const out = matchRecipesToPages(recipes, pages);
    expect(out.map((m) => [m.recipeId, m.titlePage])).toEqual([
      ["r1", 5],
      ["r2", null],
      ["r3", 7],
    ]);
  });

  it("returns every recipe unmatched when there is no text layer", () => {
    const out = matchRecipesToPages(recipes, [page(1), page(2)]);
    expect(out).toHaveLength(3);
    expect(out.every((m) => m.titlePage === null && m.titleY === null && m.range === null)).toBe(true);
  });

  it("gives recipes sharing a page a range of that page only, and records the title y", () => {
    const pages = [page(4, ["Margarita Clásica", 80], ["Mojito", 420]), page(5, "Daiquiri de Fresa")];
    const out = matchRecipesToPages(recipes, pages, 5);
    expect(out[0]).toMatchObject({ recipeId: "r1", titlePage: 4, titleY: 80, range: [4, 4] });
    expect(out[1]).toMatchObject({ recipeId: "r2", titlePage: 4, titleY: 420, range: [4, 4] });
    expect(out[2]).toMatchObject({ recipeId: "r3", titlePage: 5, range: [5, 5] });
  });
});
