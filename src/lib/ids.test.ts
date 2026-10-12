import { describe, expect, it } from "vitest";
import { isUuid } from "./ids";

describe("isUuid", () => {
  it("accepts canonical UUIDs", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA")).toBe(true);
  });

  it.each(["", "abc", "11111111-1111-4111-8111-11111111111", "11111111-1111-4111-8111-1111111111111", "x".repeat(36), "1; drop table"])(
    "rejects %j",
    (v) => expect(isUuid(v)).toBe(false),
  );

  it("rejects non-strings", () => {
    expect(isUuid(undefined as unknown as string)).toBe(false);
  });
});
