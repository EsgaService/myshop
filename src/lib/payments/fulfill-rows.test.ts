import { describe, expect, it } from "vitest";
import { SELLER_PLAN } from "@/lib/seller/decide-subscription";
import { buildPurchaseRow, buildSubscriptionRow } from "./fulfill-rows";

describe("buildPurchaseRow", () => {
  const base = { userId: "u1", bookId: "b1", provider: "mock", providerRef: "mock_1", amountCents: 1990000, currency: "COP" };

  it("keys the purchase by book and mirrors the legacy store id", () => {
    expect(buildPurchaseRow(base, "s1")).toEqual({
      user_id: "u1",
      book_id: "b1",
      store_id: "s1",
      provider: "mock",
      provider_ref: "mock_1",
      amount_cents: 1990000,
      currency: "COP",
    });
  });

  it("leaves store_id null for books that have no legacy store", () => {
    expect(buildPurchaseRow(base, null).store_id).toBeNull();
  });
});

describe("buildSubscriptionRow", () => {
  const now = new Date("2026-10-12T10:00:00Z");
  const base = { sellerId: "sel1", provider: "mock", providerRef: "mock_2", now };

  it("starts a first period now and charges the server constant", () => {
    const row = buildSubscriptionRow({ ...base, periods: [] });
    expect(row.seller_id).toBe("sel1");
    expect(row.amount_cents).toBe(SELLER_PLAN.amountCents);
    expect(row.currency).toBe(SELLER_PLAN.currency);
    expect(row.period_start).toBe("2026-10-12T10:00:00.000Z");
    expect(row.period_end).toBe("2026-11-12T10:00:00.000Z");
  });

  it("chains a renewal at the end of the active coverage (no overlap)", () => {
    const periods = [{ periodStart: new Date("2026-10-01T00:00:00Z"), periodEnd: new Date("2026-11-01T00:00:00Z") }];
    const row = buildSubscriptionRow({ ...base, periods });
    expect(row.period_start).toBe("2026-11-01T00:00:00.000Z");
    expect(row.period_end).toBe("2026-12-01T00:00:00.000Z");
  });

  it("restarts from now after a lapse", () => {
    const periods = [{ periodStart: new Date("2026-08-01T00:00:00Z"), periodEnd: new Date("2026-09-01T00:00:00Z") }];
    expect(buildSubscriptionRow({ ...base, periods }).period_start).toBe("2026-10-12T10:00:00.000Z");
  });
});
