import { describe, expect, it } from "vitest";
import { decideExtractionWrite } from "./decide-extraction-write";

describe("decideExtractionWrite", () => {
  it("writes when the upload is active and still in the same product", () => {
    expect(decideExtractionWrite({ startedBookId: "b1", current: { bookId: "b1", removedAt: null } })).toBe("write");
  });

  it("skips when the upload was removed meanwhile", () => {
    expect(decideExtractionWrite({ startedBookId: "b1", current: { bookId: "b1", removedAt: "2026-10-12T00:00:00Z" } })).toBe("skip");
  });

  it("skips when the upload moved to another product", () => {
    expect(decideExtractionWrite({ startedBookId: "b1", current: { bookId: "b2", removedAt: null } })).toBe("skip");
    expect(decideExtractionWrite({ startedBookId: "b1", current: { bookId: null, removedAt: null } })).toBe("skip");
  });

  it("skips when the upload no longer exists", () => {
    expect(decideExtractionWrite({ startedBookId: "b1", current: null })).toBe("skip");
  });
});
