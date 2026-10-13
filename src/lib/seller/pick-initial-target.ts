/**
 * Picks the product the uploader should start on from the `?producto=` query param.
 * Only ids of the seller's own selectable products are accepted; anything else falls back to the default.
 */
export function pickInitialTarget(
  requested: string | string[] | undefined,
  products: ReadonlyArray<{ id: string }>,
): string | undefined {
  const value = Array.isArray(requested) ? requested[0] : requested;
  if (!value) return undefined;
  return products.some((p) => p.id === value) ? value : undefined;
}
