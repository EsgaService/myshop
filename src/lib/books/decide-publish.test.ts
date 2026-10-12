import { describe, expect, it } from "vitest";
import { decidePublish, publishErrorMessage } from "./decide-publish";

const ok = { status: "draft" as const, priceCents: 1_990_000, canPublish: true };

describe("decidePublish (R7, R9)", () => {
  it("allows a priced draft when the seller can publish", () => {
    expect(decidePublish(ok)).toEqual({ ok: true });
  });

  it("refuses without an active subscription and keeps the reason actionable", () => {
    expect(decidePublish({ ...ok, canPublish: false })).toEqual({ ok: false, reason: "subscription_required" });
  });

  it("checks the subscription before the price so the CTA is always the first blocker", () => {
    expect(decidePublish({ status: "draft", priceCents: 0, canPublish: false })).toEqual({
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

describe("publishErrorMessage", () => {
  it("returns neutral Spanish copy for every reason", () => {
    for (const reason of ["subscription_required", "invalid_price", "archived"] as const) {
      expect(publishErrorMessage(reason).length).toBeGreaterThan(10);
    }
    expect(publishErrorMessage("subscription_required")).toMatch(/suscripción/);
  });
});
