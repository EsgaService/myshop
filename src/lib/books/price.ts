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
