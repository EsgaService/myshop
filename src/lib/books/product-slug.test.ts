import { describe, expect, it } from "vitest";
import { productSlugCandidates } from "./product-slug";

describe("productSlugCandidates (R1.1)", () => {
  it("starts with the slugified name followed by numbered fallbacks", () => {
    expect(productSlugCandidates("Cocteles de Verano", 4)).toEqual([
      "cocteles-de-verano",
      "cocteles-de-verano-2",
      "cocteles-de-verano-3",
      "cocteles-de-verano-4",
    ]);
  });

  it("strips accents and symbols", () => {
    expect(productSlugCandidates("Ñoquis & Más!", 2)).toEqual(["noquis-mas", "noquis-mas-2"]);
  });

  it("falls back to a generic slug when the name has no usable characters", () => {
    expect(productSlugCandidates("!!!", 2)).toEqual(["recetario", "recetario-2"]);
  });

  it("keeps every candidate within the length cap, including the suffix", () => {
    const candidates = productSlugCandidates("a".repeat(200), 12);
    expect(candidates).toHaveLength(12);
    for (const slug of candidates) {
      expect(slug.length).toBeLessThanOrEqual(60);
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(candidates).size).toBe(12);
    expect(candidates[11]!.endsWith("-12")).toBe(true);
  });
});
