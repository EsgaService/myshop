import { describe, expect, it } from "vitest";
import { parseIngredient, slugify, parseYield } from "./normalize-book";

describe("parseIngredient", () => {
  it("parses integer quantities", () => {
    expect(parseIngredient("45 ml de ron")).toEqual({ raw: "45 ml de ron", qty: 45, rest: "ml de ron" });
  });
  it("parses fractions and mixed numbers", () => {
    expect(parseIngredient("1/2 limón").qty).toBe(0.5);
    expect(parseIngredient("1 1/2 tazas de hielo").qty).toBe(1.5);
  });
  it("parses decimals with comma or dot", () => {
    expect(parseIngredient("2,5 cucharadas de azúcar").qty).toBe(2.5);
    expect(parseIngredient("0.5 l de agua").qty).toBe(0.5);
  });
  it("leaves ranges unscaled", () => {
    expect(parseIngredient("2 - 3 limones").qty).toBeNull();
    expect(parseIngredient("2-3 limones").qty).toBeNull();
  });
  it("returns null qty when there is no leading number", () => {
    expect(parseIngredient("Hielo al gusto")).toEqual({ raw: "Hielo al gusto", qty: null, rest: "Hielo al gusto" });
  });
});

describe("slugify", () => {
  it("strips accents and symbols", () => {
    expect(slugify("Piña colada (sin alcohol)")).toBe("pina-colada-sin-alcohol");
  });
});

describe("parseYield", () => {
  it("reads the leading number", () => {
    expect(parseYield("6 vasos (300 ml)")).toBe(6);
  });
  it("defaults to 1", () => {
    expect(parseYield("Una jarra")).toBe(1);
    expect(parseYield(undefined)).toBe(1);
  });
});
