import type { Placement } from "./types";

export const MAX_AREA_RATIO = 0.85;
export const MIN_SOURCE_SIDE_PX = 200;
export const MIN_AREA_RATIO = 0.03;
export const MAX_ASPECT = 4;
export const REPEATED_ON_PAGES = 3;
/** Declared source pixels above this are never decoded (a raw RGBA buffer would be 4 bytes per pixel). */
export const MAX_SOURCE_PIXELS = 40_000_000;

function isBackground(p: Placement, pagesByKey: Map<string, Set<number>>): boolean {
  const pageArea = p.pageSize.width * p.pageSize.height;
  const areaRatio = pageArea > 0 ? (p.bbox.w * p.bbox.h) / pageArea : 0;
  const short = Math.min(p.bbox.w, p.bbox.h);
  const aspect = short > 0 ? Math.max(p.bbox.w, p.bbox.h) / short : Infinity;

  if (p.pxWidth * p.pxHeight > MAX_SOURCE_PIXELS) return true;
  // A page-1 full-bleed photo is a legitimate cover candidate.
  if (areaRatio > MAX_AREA_RATIO && p.page !== 1) return true;
  if (Math.min(p.pxWidth, p.pxHeight) < MIN_SOURCE_SIDE_PX) return true;
  if (areaRatio < MIN_AREA_RATIO) return true;
  if (aspect > MAX_ASPECT) return true;
  return (pagesByKey.get(p.key)?.size ?? 0) >= REPEATED_ON_PAGES;
}

/** Splits placements into photos worth offering and background / decoration (R1.4). Order is preserved. */
export function filterImages(placements: Placement[]): { kept: Placement[]; background: Placement[] } {
  const pagesByKey = new Map<string, Set<number>>();
  for (const p of placements) {
    const pages = pagesByKey.get(p.key) ?? new Set<number>();
    pages.add(p.page);
    pagesByKey.set(p.key, pages);
  }
  const kept: Placement[] = [];
  const background: Placement[] = [];
  for (const p of placements) (isBackground(p, pagesByKey) ? background : kept).push(p);
  return { kept, background };
}
