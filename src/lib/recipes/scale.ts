import type { Ingredient } from "@/lib/data/types";

export function formatQty(n: number): string {
  return String(Number(n.toFixed(2))).replace(".", ",");
}

/** Renders an ingredient line for `factor` times the base yield. */
export function scaleIngredient(ing: Ingredient, factor: number): string {
  if (ing.qty === null || factor === 1) return ing.raw;
  return `${formatQty(ing.qty * factor)} ${ing.rest}`.trim();
}
