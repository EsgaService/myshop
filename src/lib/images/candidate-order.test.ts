import { describe, expect, it } from "vitest";
import { orderByPageProximity } from "./candidate-order";

const c = (id: string, page: number, ordinal = 0) => ({ id, page, ordinal });

describe("orderByPageProximity", () => {
  it("puts the nearest pages first, later pages before earlier ones at equal distance", () => {
    const out = orderByPageProximity([c("a", 1), c("b", 9), c("c", 11), c("d", 10), c("e", 12)], 10);
    expect(out.map((x) => x.id)).toEqual(["d", "c", "b", "e", "a"]);
  });
  it("keeps the PDF order (ordinal) within the same page", () => {
    const out = orderByPageProximity([c("b", 4, 2), c("a", 4, 1)], 4);
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("falls back to page order when the recipe has no known page, and does not mutate the input", () => {
    const input = [c("b", 5), c("a", 2)];
    expect(orderByPageProximity(input, null).map((x) => x.id)).toEqual(["a", "b"]);
    expect(input.map((x) => x.id)).toEqual(["b", "a"]);
  });
});
