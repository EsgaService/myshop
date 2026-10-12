export type Ingredient = { raw: string; qty: number | null; rest: string };

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNumber(token: string): number | null {
  const t = token.replace(",", ".");
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/").map(Number);
    return b ? a / b : null;
  }
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return null;
}

/** Split a leading numeric quantity (integer, decimal, fraction, mixed number) from the rest. */
export function parseIngredient(raw: string): Ingredient {
  const text = raw.trim();
  const m = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)(?=\s|$)\s*(.*)$/);
  if (!m) return { raw: text, qty: null, rest: text };
  // A range such as "2 - 3" or "2-3" is not safely scalable.
  if (/^[-–—]/.test(m[2]) || /^\d/.test(m[2])) return { raw: text, qty: null, rest: text };
  const parts = m[1].split(/\s+/);
  const qty = parts.map(toNumber).reduce<number | null>((acc, n) => (acc === null || n === null ? null : acc + n), 0);
  return { raw: text, qty, rest: m[2] };
}

export function parseYield(text: string | undefined): number {
  const m = text?.trim().match(/^(\d+)/);
  const n = m ? Number(m[1]) : 1;
  return n > 0 ? n : 1;
}
