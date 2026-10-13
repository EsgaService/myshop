export const MAX_PRODUCT_NAME_LENGTH = 120;

export type ProductNameResult = { ok: true; value: string } | { ok: false; reason: "empty" | "too_long" };

/** Trims, collapses inner whitespace and bounds the length of a product (book) name. */
export function parseProductName(raw: unknown): ProductNameResult {
  const value = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (value.length === 0) return { ok: false, reason: "empty" };
  if (value.length > MAX_PRODUCT_NAME_LENGTH) return { ok: false, reason: "too_long" };
  return { ok: true, value };
}

export function productNameErrorMessage(reason: "empty" | "too_long"): string {
  return reason === "empty"
    ? "Escribe un nombre para el producto."
    : `El nombre no puede superar los ${MAX_PRODUCT_NAME_LENGTH} caracteres.`;
}
