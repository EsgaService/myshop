type Ordered = { page: number; ordinal: number };

/**
 * Orders candidates for a recipe whose title is on `sourcePage`: nearest page first, a later page before an
 * earlier one at the same distance (the photo usually follows the title), PDF order within a page.
 * Without a known page it falls back to plain PDF order.
 */
export function orderByPageProximity<T extends Ordered>(candidates: T[], sourcePage: number | null): T[] {
  const distance = (page: number) => (sourcePage === null ? page : Math.abs(page - sourcePage));
  return [...candidates].sort((a, b) => {
    const byDistance = distance(a.page) - distance(b.page);
    if (byDistance !== 0) return byDistance;
    if (a.page !== b.page) return sourcePage !== null && a.page > sourcePage ? -1 : 1;
    return a.ordinal - b.ordinal;
  });
}
