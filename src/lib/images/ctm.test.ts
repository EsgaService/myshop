import { describe, expect, it } from "vitest";
import { CtmTracker, IDENTITY, multiply, placementRect } from "./ctm";

describe("multiply", () => {
  it("composes translate then scale like pdf.js (m1 applied after m2)", () => {
    const scale = [2, 0, 0, 3, 0, 0] as const;
    const translate = [1, 0, 0, 1, 10, 20] as const;
    // point (1,1): translate -> (11,21), then scale -> (22,63)
    const m = multiply(scale, translate);
    expect([m[0] * 1 + m[2] * 1 + m[4], m[1] * 1 + m[3] * 1 + m[5]]).toEqual([22, 63]);
  });

  it("is neutral with the identity", () => {
    expect(multiply(IDENTITY, [4, 0, 0, 5, 6, 7])).toEqual([4, 0, 0, 5, 6, 7]);
  });
});

describe("CtmTracker", () => {
  it("applies transform ops cumulatively", () => {
    const t = new CtmTracker();
    t.transform([2, 0, 0, 2, 0, 0]);
    t.transform([1, 0, 0, 1, 5, 5]);
    expect(t.current).toEqual([2, 0, 0, 2, 10, 10]);
  });

  it("restores the matrix saved before a nested transform", () => {
    const t = new CtmTracker();
    t.transform([2, 0, 0, 2, 0, 0]);
    t.save();
    t.transform([1, 0, 0, 1, 100, 100]);
    expect(t.current[4]).toBe(200);
    t.restore();
    expect(t.current).toEqual([2, 0, 0, 2, 0, 0]);
  });

  it("falls back to the identity when restore has nothing to pop", () => {
    const t = new CtmTracker();
    t.transform([3, 0, 0, 3, 0, 0]);
    t.restore();
    expect(t.current).toEqual(IDENTITY);
  });
});

describe("placementRect", () => {
  it("maps the unit square to a top-left origin rectangle", () => {
    // 200x100 image whose bottom-left corner sits at (50, 600) on an 800pt tall page.
    const rect = placementRect([200, 0, 0, 100, 50, 600], 800);
    expect(rect).toEqual({ x: 50, y: 100, w: 200, h: 100 });
  });

  it("handles a rotated 90 degrees placement via the bounding box", () => {
    // 90 degree rotation: width 100 (b), height 200 (c negative).
    const rect = placementRect([0, 100, -200, 0, 300, 100], 800);
    expect(rect).toEqual({ x: 100, y: 600, w: 200, h: 100 });
  });
});
