import type { Rect } from "./types";

/** PDF affine matrix [a b c d e f]. */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m1 x m2 with the same convention as pdf.js `Util.transform` (m1 is the outer transform). */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/** Current transformation matrix over save / restore / transform operators. */
export class CtmTracker {
  current: Matrix = IDENTITY;
  private stack: Matrix[] = [];

  save(): void {
    this.stack.push(this.current);
  }

  restore(): void {
    this.current = this.stack.pop() ?? IDENTITY;
  }

  transform(m: Matrix): void {
    this.current = multiply(this.current, m);
  }
}

/**
 * Bounding box of the unit square under `ctm`, converted from PDF space (origin bottom-left)
 * to page space (origin top-left, y downwards).
 */
export function placementRect(ctm: Matrix, pageHeight: number): Rect {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [ux, uy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    xs.push(ctm[0] * ux + ctm[2] * uy + ctm[4]);
    ys.push(ctm[1] * ux + ctm[3] * uy + ctm[5]);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: pageHeight - maxY, w: maxX - minX, h: maxY - minY };
}
