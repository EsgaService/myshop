import { describe, expect, it } from "vitest";
import { assignPhotos } from "./assign-photos";
import type { RecipeMatch } from "./match-recipes";
import type { Placement } from "./types";

const PAGE = { width: 600, height: 800 };

function pl(opIndex: number, page: number, over: Partial<Placement> = {}): Placement {
  return {
    page,
    opIndex,
    key: `img_${opIndex}`,
    bbox: { x: 50, y: 100, w: 200, h: 200 },
    pageSize: PAGE,
    pxWidth: 800,
    pxHeight: 800,
    ...over,
  };
}

const match = (recipeId: string, titlePage: number, titleY: number, range: [number, number]): RecipeMatch => ({
  recipeId,
  titlePage,
  titleY,
  range,
});

const ops = (a: ReturnType<typeof assignPhotos>) => a.map((x) => [x.recipeId, x.placement.opIndex, x.sourcePage]);

describe("assignPhotos (R1.5)", () => {
  it("gives a recipe the image on its title page", () => {
    const out = assignPhotos([match("r1", 3, 60, [3, 4])], [pl(1, 3)]);
    expect(ops(out)).toEqual([["r1", 1, 3]]);
  });

  it("takes the largest image when the recipe is alone on its page", () => {
    const big = pl(2, 3, { bbox: { x: 0, y: 200, w: 500, h: 400 } });
    const small = pl(1, 3, { bbox: { x: 0, y: 70, w: 100, h: 100 } }); // closer to the title, but small
    expect(ops(assignPhotos([match("r1", 3, 60, [3, 3])], [small, big]))).toEqual([["r1", 2, 3]]);
  });

  it("prefers the title page over later pages of the range", () => {
    const later = pl(1, 4, { bbox: { x: 0, y: 0, w: 580, h: 700 } });
    const same = pl(2, 3);
    expect(ops(assignPhotos([match("r1", 3, 60, [3, 4])], [later, same]))).toEqual([["r1", 2, 3]]);
  });

  it("falls back to the nearest later page inside the range, largest first", () => {
    const a = pl(1, 4, { bbox: { x: 0, y: 0, w: 100, h: 100 } });
    const b = pl(2, 4, { bbox: { x: 0, y: 0, w: 300, h: 300 } });
    const outside = pl(3, 5, { bbox: { x: 0, y: 0, w: 580, h: 700 } });
    expect(ops(assignPhotos([match("r1", 3, 60, [3, 4])], [a, b, outside]))).toEqual([["r1", 2, 3]]);
  });

  it("leaves a recipe without photo when its range has no image", () => {
    const out = assignPhotos([match("r1", 3, 60, [3, 4])], [pl(1, 5), pl(2, 2)]);
    expect(out).toEqual([]);
  });

  it("on a page shared by two recipes, each takes the image nearest to its title", () => {
    const top = pl(1, 4, { bbox: { x: 0, y: 100, w: 200, h: 200 } }); // center y 200
    const bottom = pl(2, 4, { bbox: { x: 0, y: 440, w: 200, h: 200 } }); // center y 540
    const out = assignPhotos([match("r1", 4, 80, [4, 4]), match("r2", 4, 420, [4, 4])], [bottom, top]);
    expect(ops(out)).toEqual([
      ["r1", 1, 4],
      ["r2", 2, 4],
    ]);
  });

  it("never gives the same image to two recipes", () => {
    const only = pl(1, 4);
    const out = assignPhotos([match("r1", 4, 80, [4, 4]), match("r2", 4, 420, [4, 4])], [only]);
    expect(ops(out)).toEqual([["r1", 1, 4]]);
  });

  it("skips recipes that were not matched to a page", () => {
    const unmatched: RecipeMatch = { recipeId: "r9", titlePage: null, titleY: null, range: null };
    expect(ops(assignPhotos([unmatched, match("r1", 3, 60, [3, 3])], [pl(1, 3)]))).toEqual([["r1", 1, 3]]);
  });
});
