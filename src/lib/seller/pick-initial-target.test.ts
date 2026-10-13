import { describe, expect, it } from "vitest";
import { pickInitialTarget } from "./pick-initial-target";

const products = [{ id: "a" }, { id: "b" }];

describe("pickInitialTarget", () => {
  it("returns the requested product when it belongs to the seller", () => {
    expect(pickInitialTarget("b", products)).toBe("b");
  });

  it("returns undefined for an unknown id", () => {
    expect(pickInitialTarget("zzz", products)).toBeUndefined();
  });

  it("returns undefined when nothing is requested", () => {
    expect(pickInitialTarget(undefined, products)).toBeUndefined();
    expect(pickInitialTarget("", products)).toBeUndefined();
  });

  it("uses the first value when the param is repeated", () => {
    expect(pickInitialTarget(["a", "b"], products)).toBe("a");
    expect(pickInitialTarget([], products)).toBeUndefined();
  });
});
