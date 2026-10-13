import { describe, expect, it } from "vitest";
import { allowedPreviousStatuses, isReusableCheckout, REUSE_MIN_REMAINING_MS } from "./checkout-status";

describe("allowedPreviousStatuses (which rows an outcome may overwrite)", () => {
  it("lets approved replace anything that is not voided", () => {
    expect(allowedPreviousStatuses("approved")).toEqual(
      expect.arrayContaining(["pending", "declined", "error", "approved_unfulfilled", "approved"]),
    );
    expect(allowedPreviousStatuses("approved")).not.toContain("voided");
  });

  it("allows approved -> voided (manual review flag) and keeps voided idempotent", () => {
    expect(allowedPreviousStatuses("voided")).toEqual(expect.arrayContaining(["approved", "approved_unfulfilled", "pending", "voided"]));
  });

  it("never lets declined or error downgrade an approved, unfulfilled or voided checkout", () => {
    for (const to of ["declined", "error"] as const) {
      const prev = allowedPreviousStatuses(to);
      expect(prev).not.toContain("approved");
      expect(prev).not.toContain("approved_unfulfilled");
      expect(prev).not.toContain("voided");
    }
  });

  it("only marks approved_unfulfilled over rows that were not fulfilled", () => {
    const prev = allowedPreviousStatuses("approved_unfulfilled");
    expect(prev).not.toContain("approved");
    expect(prev).not.toContain("voided");
    expect(prev).toContain("pending");
  });

  it("never writes pending", () => {
    expect(allowedPreviousStatuses("pending")).toEqual([]);
  });
});

describe("isReusableCheckout", () => {
  const now = new Date("2026-10-12T20:00:00.000Z");
  const base = { status: "pending" as const, expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString() };

  it("reuses a pending checkout with enough time left", () => {
    expect(isReusableCheckout(base, now)).toBe(true);
  });

  it("does not reuse one that is about to expire", () => {
    expect(isReusableCheckout({ ...base, expiresAt: new Date(now.getTime() + REUSE_MIN_REMAINING_MS - 1).toISOString() }, now)).toBe(false);
  });

  it("does not reuse expired, unknown-expiry or non-pending checkouts", () => {
    expect(isReusableCheckout({ ...base, expiresAt: "2026-10-12T19:00:00.000Z" }, now)).toBe(false);
    expect(isReusableCheckout({ ...base, expiresAt: null }, now)).toBe(false);
    expect(isReusableCheckout({ ...base, status: "declined" }, now)).toBe(false);
    expect(isReusableCheckout({ ...base, status: "approved" }, now)).toBe(false);
  });
});
