import type { Placement } from "./types";

export const COVER_LAST_PAGE = 5;

export type CoverSource = "auto" | "pdf" | "custom" | "none";

/**
 * Picks the automatic cover: the largest image on pages 1 to 5 (R1.6). Nothing is chosen when the
 * product already has a cover or the seller decided on it (custom, picked or cleared), so re-extraction
 * never overwrites a seller choice (R3.4).
 */
export function chooseCover(input: {
  currentCoverUrl: string | null;
  coverSource: CoverSource;
  candidates: Placement[];
}): Placement | null {
  if (input.currentCoverUrl || input.coverSource !== "auto") return null;
  const area = (p: Placement) => p.bbox.w * p.bbox.h;
  const eligible = input.candidates.filter((p) => p.page <= COVER_LAST_PAGE);
  return eligible.sort((a, b) => area(b) - area(a) || a.page - b.page || a.opIndex - b.opIndex)[0] ?? null;
}
