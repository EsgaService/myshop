import { describe, expect, it } from "vitest";
import { MAX_PRODUCT_NAME_LENGTH, parseProductName } from "./product-name";

describe("parseProductName (R1.1)", () => {
  it("accepts a normal name", () => {
    expect(parseProductName("Cocteles de verano")).toEqual({ ok: true, value: "Cocteles de verano" });
  });

  it("trims and collapses inner whitespace", () => {
    expect(parseProductName("  Cocteles   de \t verano \n")).toEqual({ ok: true, value: "Cocteles de verano" });
  });

  it.each(["", "   ", "\n\t "])("rejects empty or whitespace-only names (%j)", (raw) => {
    expect(parseProductName(raw)).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects non-string input as empty", () => {
    expect(parseProductName(undefined)).toEqual({ ok: false, reason: "empty" });
    expect(parseProductName(42)).toEqual({ ok: false, reason: "empty" });
  });

  it("accepts exactly 120 characters and rejects 121", () => {
    expect(MAX_PRODUCT_NAME_LENGTH).toBe(120);
    const max = "a".repeat(120);
    expect(parseProductName(max)).toEqual({ ok: true, value: max });
    expect(parseProductName("a".repeat(121))).toEqual({ ok: false, reason: "too_long" });
  });

  it("measures the length after trimming and collapsing", () => {
    const padded = `  ${"a".repeat(120)}  `;
    expect(parseProductName(padded)).toEqual({ ok: true, value: "a".repeat(120) });
  });
});
