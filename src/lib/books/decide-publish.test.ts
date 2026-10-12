import { describe, expect, it } from "vitest";
import { decidePublish, mustRevertPublish, publishErrorMessage } from "./decide-publish";

const ok = { status: "draft" as const, priceCents: 1_990_000, canPublish: true, readyPdfCount: 1, isLegacy: false };

describe("decidePublish PDF gate (R5.1)", () => {
  it("refuses a product with no ready PDF", () => {
    expect(decidePublish({ ...ok, readyPdfCount: 0 })).toEqual({ ok: false, reason: "no_ready_pdf" });
  });

  it("allows a product with several ready PDFs", () => {
    expect(decidePublish({ ...ok, readyPdfCount: 3 })).toEqual({ ok: true });
  });

  it("exempts legacy platform books, which have no uploads", () => {
    expect(decidePublish({ ...ok, readyPdfCount: 0, isLegacy: true })).toEqual({ ok: true });
  });

  it("reports the subscription before the missing PDF", () => {
    expect(decidePublish({ ...ok, readyPdfCount: 0, canPublish: false })).toEqual({
      ok: false,
      reason: "subscription_required",
    });
  });

  it("reports the missing PDF before the price", () => {
    expect(decidePublish({ ...ok, readyPdfCount: 0, priceCents: 0 })).toEqual({ ok: false, reason: "no_ready_pdf" });
  });

  it("has Spanish copy for the missing PDF", () => {
    expect(publishErrorMessage("no_ready_pdf")).toMatch(/PDF listo/);
  });
});

describe("decidePublish (R7, R9)", () => {
  it("allows a priced draft when the seller can publish", () => {
    expect(decidePublish(ok)).toEqual({ ok: true });
  });

  it("refuses without an active subscription and keeps the reason actionable", () => {
    expect(decidePublish({ ...ok, canPublish: false })).toEqual({ ok: false, reason: "subscription_required" });
  });

  it("checks the subscription before the price so the CTA is always the first blocker", () => {
    expect(decidePublish({ ...ok, priceCents: 0, canPublish: false })).toEqual({
      ok: false,
      reason: "subscription_required",
    });
  });

  it.each([0, -100, 4_999 * 100, 1_000_001 * 100, 1.5])("refuses an invalid stored price %s", (priceCents) => {
    expect(decidePublish({ ...ok, priceCents })).toEqual({ ok: false, reason: "invalid_price" });
  });

  it("refuses archived books", () => {
    expect(decidePublish({ ...ok, status: "archived" })).toEqual({ ok: false, reason: "archived" });
  });

  it("is idempotent for already published books", () => {
    expect(decidePublish({ ...ok, status: "published" })).toEqual({ ok: true });
  });
});

describe("mustRevertPublish (publish vs removal race)", () => {
  it("reverts when no ready PDF is left after publishing", () => {
    expect(mustRevertPublish({ readyPdfCountAfter: 0, isLegacy: false })).toBe(true);
  });

  it("keeps the publication when a ready PDF remains", () => {
    expect(mustRevertPublish({ readyPdfCountAfter: 1, isLegacy: false })).toBe(false);
  });

  it("never reverts legacy books", () => {
    expect(mustRevertPublish({ readyPdfCountAfter: 0, isLegacy: true })).toBe(false);
  });
});

describe("publishErrorMessage", () => {
  it("returns neutral Spanish copy for every reason", () => {
    for (const reason of ["subscription_required", "invalid_price", "archived", "no_ready_pdf"] as const) {
      expect(publishErrorMessage(reason).length).toBeGreaterThan(10);
    }
    expect(publishErrorMessage("subscription_required")).toMatch(/suscripción/);
  });
});
