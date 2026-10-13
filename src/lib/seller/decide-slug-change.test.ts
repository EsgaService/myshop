import { describe, expect, it } from "vitest";
import { SLUG_LOCKED_MESSAGE, decideSlugChange } from "./decide-slug-change";

describe("decideSlugChange (shared links must keep working)", () => {
  it("allows any slug while the seller has no published book", () => {
    expect(decideSlugChange({ currentSlug: "ana", newSlug: "dulces-ana", publishedBookCount: 0 })).toEqual({ ok: true });
  });

  it("allows saving the profile with an unchanged slug even with published books", () => {
    expect(decideSlugChange({ currentSlug: "ana", newSlug: "ana", publishedBookCount: 3 })).toEqual({ ok: true });
  });

  it("locks the slug once any book is published", () => {
    expect(decideSlugChange({ currentSlug: "ana", newSlug: "dulces-ana", publishedBookCount: 1 })).toEqual({
      ok: false,
      reason: "locked",
    });
  });

  it("explains the lock in Spanish", () => {
    expect(SLUG_LOCKED_MESSAGE).toMatch(/publicad/i);
  });
});
