/** Prices are integer COP cents. Bounds are product assumptions (see design open questions). */
export const MIN_PRICE_CENTS = 5_000 * 100;
export const MAX_PRICE_CENTS = 1_000_000 * 100;

export type PriceResult = { ok: true; cents: number } | { ok: false; reason: "invalid" | "too_low" | "too_high" };

export function validatePriceCents(cents: number): PriceResult {
  if (typeof cents !== "number" || !Number.isSafeInteger(cents)) return { ok: false, reason: "invalid" };
  if (cents < MIN_PRICE_CENTS) return { ok: false, reason: "too_low" };
  if (cents > MAX_PRICE_CENTS) return { ok: false, reason: "too_high" };
  return { ok: true, cents };
}

/**
 * Parses a price typed by a seller in whole pesos ("19.900", "$ 19900").
 * Dots or commas are accepted only as thousands separators: decimals are rejected.
 */
export function parsePriceCop(raw: string): PriceResult {
  const text = String(raw ?? "").replace(/^\s*(\$|COP)?\s*/i, "").replace(/\s*(COP)?\s*$/i, "");
  const plain = /^\d+$/.test(text);
  const grouped = /^\d{1,3}(\.\d{3})+$/.test(text) || /^\d{1,3}(,\d{3})+$/.test(text);
  if (!plain && !grouped) return { ok: false, reason: "invalid" };

  const pesos = Number(text.replace(/[.,]/g, ""));
  if (!Number.isSafeInteger(pesos)) return { ok: false, reason: "invalid" };
  return validatePriceCents(pesos * 100);
}

const MAX_PRICE_DIGITS = 9;

/**
 * Live formatting for the price field: keeps only digits (no decimals ever), drops leading zeros and groups
 * thousands with dots ("40000" -> "40.000"). `digits` is the plain value; the server parses again.
 */
export function formatPriceInput(raw: string): { display: string; digits: string } {
  const digits = String(raw ?? "")
    .replace(/\D/g, "")
    .replace(/^0+/, "")
    .slice(0, MAX_PRICE_DIGITS);
  return { display: digits.replace(/\B(?=(\d{3})+(?!\d))/g, "."), digits };
}

/** Caret position in a formatted `display` that sits after the first `digitCount` digits. */
export function caretAfterFormat(display: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < display.length; i++) {
    if (/\d/.test(display[i]!)) seen++;
    if (seen === digitCount) return i + 1;
  }
  return display.length;
}

export function priceErrorMessage(reason: "invalid" | "too_low" | "too_high"): string {
  switch (reason) {
    case "too_low":
      return "El precio mínimo es 5.000 COP.";
    case "too_high":
      return "El precio máximo es 1.000.000 COP.";
    case "invalid":
      return "Escribe un precio en pesos, sin decimales. Ejemplo: 19900";
  }
}

/** An optional price field: blank means "no price yet" (`cents: null`); anything else must be valid. */
export function resolveOptionalPrice(
  raw: string | null,
): { ok: true; cents: number | null } | { ok: false; reason: "invalid" | "too_low" | "too_high" } {
  if (raw === null || raw.trim() === "") return { ok: true, cents: null };
  const parsed = parsePriceCop(raw);
  return parsed.ok ? { ok: true, cents: parsed.cents } : parsed;
}

/**
 * The price a publish request should use: the value on screen when the seller filled it in (validated, and
 * flagged when it differs from the stored one so it is saved together with the publication), otherwise the
 * stored price. An invalid on-screen value is an error, never a silent fallback.
 */
export function resolvePublishPrice(input: {
  storedCents: number;
  submitted: string | null;
}): { ok: true; cents: number; changed: boolean } | { ok: false; reason: "invalid" | "too_low" | "too_high" } {
  const optional = resolveOptionalPrice(input.submitted);
  if (!optional.ok) return optional;
  if (optional.cents === null) return { ok: true, cents: input.storedCents, changed: false };
  return { ok: true, cents: optional.cents, changed: optional.cents !== input.storedCents };
}
