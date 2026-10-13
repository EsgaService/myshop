import { describe, expect, it } from "vitest";
import { filterImages, MAX_SOURCE_PIXELS } from "./filter-images";
import type { Placement } from "./types";

const PAGE = { width: 600, height: 800 }; // area 480_000

function pl(over: Partial<Placement> & { opIndex: number }): Placement {
  return {
    page: 2,
    key: `img_${over.opIndex}`,
    bbox: { x: 50, y: 50, w: 300, h: 300 }, // 90_000 = 18.75% of the page
    pageSize: PAGE,
    pxWidth: 900,
    pxHeight: 900,
    ...over,
  };
}

const keptIds = (r: ReturnType<typeof filterImages>) => r.kept.map((p) => p.opIndex);
const bgIds = (r: ReturnType<typeof filterImages>) => r.background.map((p) => p.opIndex);

describe("filterImages (R1.4)", () => {
  it("keeps a normal photo", () => {
    const r = filterImages([pl({ opIndex: 1 })]);
    expect(keptIds(r)).toEqual([1]);
    expect(bgIds(r)).toEqual([]);
  });

  it("flags an image covering more than 85% of the page as background", () => {
    const full = pl({ opIndex: 1, bbox: { x: 0, y: 0, w: 600, h: 780 } }); // 97.5%
    expect(bgIds(filterImages([full]))).toEqual([1]);
  });

  it("allows a full-page image on page 1 (cover candidate)", () => {
    const cover = pl({ opIndex: 1, page: 1, bbox: { x: 0, y: 0, w: 600, h: 800 } });
    expect(keptIds(filterImages([cover]))).toEqual([1]);
  });

  it("flags images whose source side is under 200 px", () => {
    const tiny = pl({ opIndex: 1, pxWidth: 199, pxHeight: 900 });
    const ok = pl({ opIndex: 2, pxWidth: 200, pxHeight: 200 });
    const r = filterImages([tiny, ok]);
    expect(bgIds(r)).toEqual([1]);
    expect(keptIds(r)).toEqual([2]);
  });

  it("flags images covering less than 3% of the page", () => {
    const small = pl({ opIndex: 1, bbox: { x: 0, y: 0, w: 100, h: 100 } }); // 2.08%
    const fine = pl({ opIndex: 2, bbox: { x: 0, y: 0, w: 130, h: 130 } }); // 3.52%
    const r = filterImages([small, fine]);
    expect(bgIds(r)).toEqual([1]);
    expect(keptIds(r)).toEqual([2]);
  });

  it("flags strips with an aspect ratio over 4:1 (either orientation)", () => {
    const wide = pl({ opIndex: 1, bbox: { x: 0, y: 0, w: 500, h: 100 } }); // 5:1
    const tall = pl({ opIndex: 2, bbox: { x: 0, y: 0, w: 100, h: 500 } });
    const ok = pl({ opIndex: 3, bbox: { x: 0, y: 0, w: 400, h: 100 } }); // exactly 4:1 stays
    const r = filterImages([wide, tall, ok]);
    expect(bgIds(r)).toEqual([1, 2]);
    expect(keptIds(r)).toEqual([3]);
  });

  it("flags the same image shown on 3 or more pages (logo, watermark)", () => {
    const logo = [2, 3, 4, 5, 6].map((page, i) => pl({ opIndex: 10 + i, page, key: "logo" }));
    const twice = [pl({ opIndex: 20, page: 2, key: "pair" }), pl({ opIndex: 21, page: 3, key: "pair" })];
    const r = filterImages([...logo, ...twice]);
    expect(bgIds(r)).toEqual([10, 11, 12, 13, 14]);
    expect(keptIds(r)).toEqual([20, 21]);
  });

  it("counts distinct pages, so one image painted 3 times on the same page is kept", () => {
    const sameImage = [30, 31, 32].map((opIndex) => pl({ opIndex, page: 4, key: "repeat" }));
    expect(keptIds(filterImages(sameImage))).toEqual([30, 31, 32]);
  });

  it("drops images whose declared pixel count exceeds the decode cap, before any decoding", () => {
    const side = Math.ceil(Math.sqrt(MAX_SOURCE_PIXELS)) + 1;
    const bomb = pl({ opIndex: 1, pxWidth: side, pxHeight: side });
    const ok = pl({ opIndex: 2, pxWidth: 4000, pxHeight: 4000 });
    const r = filterImages([bomb, ok]);
    expect(keptIds(r)).toEqual([2]);
    expect(bgIds(r)).toEqual([1]);
  });
});
