import { describe, expect, it } from "vitest";
import { MAX_PRICE_CENTS, MIN_PRICE_CENTS, parsePriceCop, validatePriceCents } from "./price";

describe("parsePriceCop (R9)", () => {
  it("parses thousand-separated COP amounts into cents", () => {
    expect(parsePriceCop("19.900")).toEqual({ ok: true, cents: 1_990_000 });
    expect(parsePriceCop("19900")).toEqual({ ok: true, cents: 1_990_000 });
    expect(parsePriceCop("$ 19.900")).toEqual({ ok: true, cents: 1_990_000 });
    expect(parsePriceCop(" 1.000.000 ")).toEqual({ ok: true, cents: 100_000_000 });
  });

  it("accepts the bounds", () => {
    expect(parsePriceCop("5.000")).toEqual({ ok: true, cents: MIN_PRICE_CENTS });
    expect(parsePriceCop("1000000")).toEqual({ ok: true, cents: MAX_PRICE_CENTS });
  });

  it("rejects zero, negative, fractional and non-numeric input", () => {
    for (const raw of ["0", "-5000", "19.5", "19,5", "abc", "", "  ", "1e6", "19..900", "NaN", "5.00"]) {
      expect(parsePriceCop(raw)).toMatchObject({ ok: false });
    }
  });

  it("rejects values below the minimum and above the maximum", () => {
    expect(parsePriceCop("4.999")).toEqual({ ok: false, reason: "too_low" });
    expect(parsePriceCop("1.000.001")).toEqual({ ok: false, reason: "too_high" });
  });

  it("reports invalid for malformed input", () => {
    expect(parsePriceCop("abc")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("validatePriceCents (R9)", () => {
  it("accepts integers within bounds", () => {
    expect(validatePriceCents(1_990_000)).toEqual({ ok: true, cents: 1_990_000 });
  });
  it("rejects fractional, non-finite, out of range and non-number values", () => {
    expect(validatePriceCents(1.5)).toEqual({ ok: false, reason: "invalid" });
    expect(validatePriceCents(Number.NaN)).toEqual({ ok: false, reason: "invalid" });
    expect(validatePriceCents("100" as unknown as number)).toEqual({ ok: false, reason: "invalid" });
    expect(validatePriceCents(0)).toEqual({ ok: false, reason: "too_low" });
    expect(validatePriceCents(-1)).toEqual({ ok: false, reason: "too_low" });
    expect(validatePriceCents(MAX_PRICE_CENTS + 1)).toEqual({ ok: false, reason: "too_high" });
  });
});
