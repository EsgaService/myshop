import { describe, expect, it } from "vitest";
import { SELLER_PLAN, decideSellerAccess, decideSubscription, periodEndFor } from "./decide-subscription";

const d = (s: string) => new Date(s);
const now = d("2026-10-15T12:00:00Z");

describe("SELLER_PLAN (R6)", () => {
  it("is a server constant of 50,000 COP per month in cents", () => {
    expect(SELLER_PLAN).toEqual({ amountCents: 5_000_000, currency: "COP", periodMonths: 1 });
  });
});

describe("periodEndFor", () => {
  it("adds one calendar month in UTC", () => {
    expect(periodEndFor(d("2026-10-15T12:00:00Z")).toISOString()).toBe("2026-11-15T12:00:00.000Z");
  });
  it("clamps to the last day of shorter months", () => {
    expect(periodEndFor(d("2026-01-31T00:00:00Z")).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
  it("rolls over the year", () => {
    expect(periodEndFor(d("2026-12-20T00:00:00Z")).toISOString()).toBe("2027-01-20T00:00:00.000Z");
  });
});

describe("decideSubscription (R6-R8)", () => {
  it("is none without periods and a renewal starts now", () => {
    expect(decideSubscription({ periods: [], now })).toEqual({ status: "none", activeUntil: null, nextPeriodStart: now });
  });

  it("is active inside a period and renewal starts at its end", () => {
    const periods = [{ periodStart: d("2026-10-01T00:00:00Z"), periodEnd: d("2026-11-01T00:00:00Z") }];
    expect(decideSubscription({ periods, now })).toEqual({
      status: "active",
      activeUntil: d("2026-11-01T00:00:00Z"),
      nextPeriodStart: d("2026-11-01T00:00:00Z"),
    });
  });

  it("is lapsed when every period ended and renewal starts now", () => {
    const periods = [{ periodStart: d("2026-08-01T00:00:00Z"), periodEnd: d("2026-09-01T00:00:00Z") }];
    expect(decideSubscription({ periods, now })).toEqual({ status: "lapsed", activeUntil: null, nextPeriodStart: now });
  });

  it("treats period end as exclusive and start as inclusive", () => {
    const p = [{ periodStart: d("2026-10-01T00:00:00Z"), periodEnd: d("2026-10-15T12:00:00Z") }];
    expect(decideSubscription({ periods: p, now }).status).toBe("lapsed");
    const q = [{ periodStart: d("2026-10-15T12:00:00Z"), periodEnd: d("2026-11-15T12:00:00Z") }];
    expect(decideSubscription({ periods: q, now }).status).toBe("active");
  });

  it("extends activeUntil across contiguous queued periods", () => {
    const periods = [
      { periodStart: d("2026-11-01T00:00:00Z"), periodEnd: d("2026-12-01T00:00:00Z") },
      { periodStart: d("2026-10-01T00:00:00Z"), periodEnd: d("2026-11-01T00:00:00Z") },
    ];
    const r = decideSubscription({ periods, now });
    expect(r.status).toBe("active");
    expect(r.activeUntil).toEqual(d("2026-12-01T00:00:00Z"));
    expect(r.nextPeriodStart).toEqual(d("2026-12-01T00:00:00Z"));
  });

  it("does not bridge gaps between periods", () => {
    const periods = [
      { periodStart: d("2026-10-01T00:00:00Z"), periodEnd: d("2026-11-01T00:00:00Z") },
      { periodStart: d("2026-12-01T00:00:00Z"), periodEnd: d("2027-01-01T00:00:00Z") },
    ];
    expect(decideSubscription({ periods, now }).activeUntil).toEqual(d("2026-11-01T00:00:00Z"));
  });
});

describe("decideSellerAccess (R7, R8, R17)", () => {
  const sub = (status: "none" | "active" | "lapsed") => ({ status, activeUntil: null, nextPeriodStart: now });

  it("allows everything with an active subscription", () => {
    expect(decideSellerAccess({ isPlatform: false, subscription: sub("active") })).toEqual({
      canPublish: true,
      isListed: true,
      canSell: true,
    });
  });

  it("blocks publishing, listing and selling without a subscription or when lapsed", () => {
    for (const s of ["none", "lapsed"] as const) {
      expect(decideSellerAccess({ isPlatform: false, subscription: sub(s) })).toEqual({
        canPublish: false,
        isListed: false,
        canSell: false,
      });
    }
  });

  it("treats the platform seller as always live", () => {
    expect(decideSellerAccess({ isPlatform: true, subscription: sub("none") })).toEqual({
      canPublish: true,
      isListed: true,
      canSell: true,
    });
  });
});
