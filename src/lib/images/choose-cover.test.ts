import { describe, expect, it } from "vitest";
import { chooseCover } from "./choose-cover";
import type { Placement } from "./types";

function pl(opIndex: number, page: number, w: number, h: number): Placement {
  return {
    page,
    opIndex,
    key: `img_${opIndex}`,
    bbox: { x: 0, y: 0, w, h },
    pageSize: { width: 600, height: 800 },
    pxWidth: 1000,
    pxHeight: 1000,
  };
}

const empty = { currentCoverUrl: null, coverSource: "auto" as const };

describe("chooseCover (R1.6, R3.4)", () => {
  it("picks the largest image among pages 1 to 5", () => {
    const chosen = chooseCover({ ...empty, candidates: [pl(1, 2, 200, 200), pl(2, 5, 400, 400), pl(3, 3, 300, 300)] });
    expect(chosen?.opIndex).toBe(2);
  });

  it("accepts a full-page photo on page 1", () => {
    const chosen = chooseCover({ ...empty, candidates: [pl(1, 1, 600, 800), pl(2, 2, 200, 200)] });
    expect(chosen?.opIndex).toBe(1);
  });

  it("ignores images after page 5", () => {
    expect(chooseCover({ ...empty, candidates: [pl(1, 6, 500, 500)] })).toBeNull();
    expect(chooseCover({ ...empty, candidates: [pl(1, 6, 500, 500), pl(2, 5, 100, 100)] })?.opIndex).toBe(2);
  });

  it("breaks ties by the lowest page, then by operator order", () => {
    const chosen = chooseCover({ ...empty, candidates: [pl(5, 3, 300, 300), pl(4, 2, 300, 300), pl(3, 2, 300, 300)] });
    expect(chosen?.opIndex).toBe(3);
  });

  it("keeps a seller-set cover", () => {
    const candidates = [pl(1, 1, 300, 300)];
    expect(chooseCover({ currentCoverUrl: "https://x/cover.webp", coverSource: "auto", candidates })).toBeNull();
    expect(chooseCover({ currentCoverUrl: null, coverSource: "custom", candidates })).toBeNull();
    expect(chooseCover({ currentCoverUrl: null, coverSource: "none", candidates })).toBeNull();
  });

  it("returns null when there are no candidates", () => {
    expect(chooseCover({ ...empty, candidates: [] })).toBeNull();
  });
});
