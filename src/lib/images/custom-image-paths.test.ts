import { describe, expect, it } from "vitest";
import { customImagePaths, customTempPath, isOwnTempPath } from "./custom-image-paths";

const SELLER = "11111111-1111-4111-8111-111111111111";
const FILE = "22222222-2222-4222-8222-222222222222";

describe("customTempPath", () => {
  it("keys the temp object by seller and file id", () => {
    expect(customTempPath(SELLER, FILE)).toBe(`${SELLER}/${FILE}`);
  });
});

describe("isOwnTempPath", () => {
  it("accepts a path under the seller's own folder", () => {
    expect(isOwnTempPath(SELLER, `${SELLER}/${FILE}`)).toBe(true);
  });
  it("rejects another seller's folder, traversal and malformed ids", () => {
    expect(isOwnTempPath(SELLER, `33333333-3333-4333-8333-333333333333/${FILE}`)).toBe(false);
    expect(isOwnTempPath(SELLER, `${SELLER}/../${FILE}`)).toBe(false);
    expect(isOwnTempPath(SELLER, `${SELLER}/not-a-uuid`)).toBe(false);
    expect(isOwnTempPath(SELLER, `${SELLER}/${FILE}/extra`)).toBe(false);
    expect(isOwnTempPath(SELLER, 42)).toBe(false);
  });
});

describe("customImagePaths", () => {
  it("stores the full image and its thumb under the seller's custom folder", () => {
    expect(customImagePaths(SELLER, FILE)).toEqual({
      storagePath: `${SELLER}/custom/${FILE}.webp`,
      thumbPath: `${SELLER}/custom/${FILE}-t.webp`,
    });
  });
});
