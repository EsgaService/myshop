import { describe, expect, it } from "vitest";
import { formatQty, scaleIngredient } from "./scale";

describe("formatQty", () => {
  it("drops trailing zeros", () => {
    expect(formatQty(2)).toBe("2");
    expect(formatQty(1.5)).toBe("1,5");
    expect(formatQty(0.333333)).toBe("0,33");
  });
});

describe("scaleIngredient", () => {
  it("scales numeric quantities", () => {
    expect(scaleIngredient({ raw: "45 ml de ron", qty: 45, rest: "ml de ron" }, 4)).toBe("180 ml de ron");
  });
  it("keeps the original text for non numeric quantities", () => {
    expect(scaleIngredient({ raw: "Hielo al gusto", qty: null, rest: "Hielo al gusto" }, 4)).toBe("Hielo al gusto");
  });
  it("keeps the original text when factor is 1", () => {
    expect(scaleIngredient({ raw: "1/2 limón", qty: 0.5, rest: "limón" }, 1)).toBe("1/2 limón");
  });
});
