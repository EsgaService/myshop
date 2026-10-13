import { describe, expect, it } from "vitest";
import {
  caretAfterFormat,
  formatPriceInput,
  MAX_PRICE_CENTS,
  MIN_PRICE_CENTS,
  parsePriceCop,
  priceErrorMessage,
  resolveOptionalPrice,
  resolvePublishPrice,
  validatePriceCents,
} from "./price";

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

describe("formatPriceInput", () => {
  it("keeps only digits and groups thousands with dots", () => {
    expect(formatPriceInput("40000")).toEqual({ display: "40.000", digits: "40000" });
    expect(formatPriceInput("1000000")).toEqual({ display: "1.000.000", digits: "1000000" });
    expect(formatPriceInput("999")).toEqual({ display: "999", digits: "999" });
  });

  it("re-formats already grouped text and strips anything that is not a digit", () => {
    expect(formatPriceInput("40.000")).toEqual({ display: "40.000", digits: "40000" });
    expect(formatPriceInput("$ 19.900,50")).toEqual({ display: "1.990.050", digits: "1990050" });
    expect(formatPriceInput("abc")).toEqual({ display: "", digits: "" });
    expect(formatPriceInput("-5000")).toEqual({ display: "5.000", digits: "5000" });
  });

  it("drops leading zeros and handles empty or nullish input", () => {
    expect(formatPriceInput("0005000")).toEqual({ display: "5.000", digits: "5000" });
    expect(formatPriceInput("000")).toEqual({ display: "", digits: "" });
    expect(formatPriceInput("")).toEqual({ display: "", digits: "" });
    expect(formatPriceInput(undefined as unknown as string)).toEqual({ display: "", digits: "" });
  });

  it("caps the length so the value stays a safe integer", () => {
    expect(formatPriceInput("1".repeat(30)).digits).toHaveLength(9);
  });

  it("produces text that parsePriceCop accepts", () => {
    expect(parsePriceCop(formatPriceInput("40000").display)).toEqual({ ok: true, cents: 4_000_000 });
  });
});

describe("caretAfterFormat", () => {
  it("places the caret after the same number of digits it had before formatting", () => {
    // typed "4" then "0000": raw "40000" with caret at 5 -> display "40.000", caret 6
    expect(caretAfterFormat("40.000", 5)).toBe(6);
    // caret after the first digit stays after it
    expect(caretAfterFormat("40.000", 1)).toBe(1);
    // caret after the 2nd digit sits before the dot
    expect(caretAfterFormat("40.000", 2)).toBe(2);
    expect(caretAfterFormat("40.000", 3)).toBe(4);
    expect(caretAfterFormat("", 0)).toBe(0);
  });
});

describe("priceErrorMessage", () => {
  it("explains each failure in Spanish", () => {
    expect(priceErrorMessage("too_low")).toBe("El precio mínimo es 5.000 COP.");
    expect(priceErrorMessage("too_high")).toBe("El precio máximo es 1.000.000 COP.");
    expect(priceErrorMessage("invalid")).toBe("Escribe un precio en pesos, sin decimales. Ejemplo: 19900");
  });
});

describe("resolveOptionalPrice", () => {
  it("treats a missing or blank field as no price", () => {
    expect(resolveOptionalPrice(null)).toEqual({ ok: true, cents: null });
    expect(resolveOptionalPrice("")).toEqual({ ok: true, cents: null });
    expect(resolveOptionalPrice("   ")).toEqual({ ok: true, cents: null });
  });
  it("validates a filled field", () => {
    expect(resolveOptionalPrice("40.000")).toEqual({ ok: true, cents: 4_000_000 });
    expect(resolveOptionalPrice("100")).toEqual({ ok: false, reason: "too_low" });
    expect(resolveOptionalPrice("abc")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("resolvePublishPrice", () => {
  it("uses the stored price when the field is missing or blank", () => {
    expect(resolvePublishPrice({ storedCents: 4_000_000, submitted: null })).toEqual({ ok: true, cents: 4_000_000, changed: false });
    expect(resolvePublishPrice({ storedCents: 4_000_000, submitted: " " })).toEqual({ ok: true, cents: 4_000_000, changed: false });
    expect(resolvePublishPrice({ storedCents: 0, submitted: "" })).toEqual({ ok: true, cents: 0, changed: false });
  });
  it("prefers the on-screen price and flags it when it differs", () => {
    expect(resolvePublishPrice({ storedCents: 0, submitted: "40.000" })).toEqual({ ok: true, cents: 4_000_000, changed: true });
    expect(resolvePublishPrice({ storedCents: 4_000_000, submitted: "40000" })).toEqual({ ok: true, cents: 4_000_000, changed: false });
    expect(resolvePublishPrice({ storedCents: 4_000_000, submitted: "50000" })).toEqual({ ok: true, cents: 5_000_000, changed: true });
  });
  it("rejects an invalid on-screen price instead of falling back to the stored one", () => {
    expect(resolvePublishPrice({ storedCents: 4_000_000, submitted: "12" })).toEqual({ ok: false, reason: "too_low" });
    expect(resolvePublishPrice({ storedCents: 4_000_000, submitted: "x" })).toEqual({ ok: false, reason: "invalid" });
  });
});
