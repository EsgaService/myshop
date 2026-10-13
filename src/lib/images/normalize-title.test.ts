import { describe, expect, it } from "vitest";
import { normalizeTitle, titleSimilarity, titleTokens } from "./normalize-title";

describe("normalizeTitle (R1.5)", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeTitle("Margarita Clásica")).toBe("margarita clasica");
  });

  it("collapses punctuation and whitespace", () => {
    expect(normalizeTitle("  Piña--Colada!!  (con  ron) ")).toBe("pina colada con ron");
  });

  it("keeps digits and treats ñ as n", () => {
    expect(normalizeTitle("15 Salsas de Año")).toBe("15 salsas de ano");
  });

  it("returns an empty string for punctuation only", () => {
    expect(normalizeTitle("...---")).toBe("");
  });
});

describe("titleTokens", () => {
  it("splits the normalized title into unique tokens", () => {
    expect(titleTokens("Dip de  dip de Queso")).toEqual(["dip", "de", "queso"]);
  });
});

describe("titleSimilarity (token Jaccard)", () => {
  it("is 1 for equal titles after normalization", () => {
    expect(titleSimilarity("Margarita Clásica", "MARGARITA CLASICA")).toBe(1);
  });

  it("is the Jaccard ratio for partial overlap", () => {
    // tokens {dip,queso} vs {dip,queso,crema}: 2 / 3
    expect(titleSimilarity("Dip queso", "Dip queso crema")).toBeCloseTo(2 / 3, 5);
  });

  it("is 0 when nothing is shared or a side is empty", () => {
    expect(titleSimilarity("Mojito", "Daiquiri")).toBe(0);
    expect(titleSimilarity("", "Daiquiri")).toBe(0);
  });
});
