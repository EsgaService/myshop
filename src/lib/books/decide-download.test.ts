import { describe, expect, it } from "vitest";
import { decideDownload } from "./decide-download";

const upload = { bookMatches: true, status: "ready" as const, removed: false };

describe("decideDownload (R3.1)", () => {
  it("allows a purchaser to download a ready PDF of the book", () => {
    expect(decideDownload({ isOwner: false, hasPurchase: true, upload })).toEqual({ ok: true });
  });

  it("allows the owner seller without a purchase", () => {
    expect(decideDownload({ isOwner: true, hasPurchase: false, upload })).toEqual({ ok: true });
  });

  it("denies anyone who is neither owner nor purchaser, without revealing why", () => {
    expect(decideDownload({ isOwner: false, hasPurchase: false, upload })).toEqual({ ok: false, reason: "not_found" });
  });

  it("denies an upload that belongs to another book", () => {
    expect(decideDownload({ isOwner: true, hasPurchase: true, upload: { ...upload, bookMatches: false } })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it.each(["pending", "uploaded", "processing", "failed"] as const)("denies a %s upload", (status) => {
    expect(decideDownload({ isOwner: true, hasPurchase: true, upload: { ...upload, status } })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("denies a removed upload even when it is ready", () => {
    expect(decideDownload({ isOwner: true, hasPurchase: true, upload: { ...upload, removed: true } })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("denies when the upload does not exist", () => {
    expect(decideDownload({ isOwner: true, hasPurchase: true, upload: null })).toEqual({ ok: false, reason: "not_found" });
  });
});
