import { describe, expect, it } from "vitest";
import { decideReviewNotice } from "./decide-review-notice";

const base = { uploadStatus: "ready" as const, imagesStatus: "done" as const, reviewPending: true };

describe("decideReviewNotice (R3.7)", () => {
  it("shows the notice for a ready PDF whose images finished and were not reviewed yet", () => {
    expect(decideReviewNotice(base)).toBe(true);
  });

  it("hides it once the seller opened the editor for that PDF", () => {
    expect(decideReviewNotice({ ...base, reviewPending: false })).toBe(false);
  });

  it("hides it while images are pending, processing or failed", () => {
    expect(decideReviewNotice({ ...base, imagesStatus: null })).toBe(false);
    expect(decideReviewNotice({ ...base, imagesStatus: "processing" })).toBe(false);
    expect(decideReviewNotice({ ...base, imagesStatus: "failed" })).toBe(false);
  });

  it("hides it for PDFs that are not ready", () => {
    expect(decideReviewNotice({ ...base, uploadStatus: "processing" })).toBe(false);
    expect(decideReviewNotice({ ...base, uploadStatus: "failed" })).toBe(false);
  });
});
