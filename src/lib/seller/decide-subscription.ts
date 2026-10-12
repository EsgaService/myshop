/** Server-side source of truth for the seller plan. Client-supplied amounts are never used. */
export const SELLER_PLAN = Object.freeze({ amountCents: 5_000_000, currency: "COP", periodMonths: 1 });

export type SubscriptionPeriod = { periodStart: Date; periodEnd: Date };

export type SubscriptionState = {
  status: "none" | "active" | "lapsed";
  /** End of the contiguous paid coverage; null unless active. */
  activeUntil: Date | null;
  /** Where the next paid period must start so periods never overlap or leave a gap. */
  nextPeriodStart: Date;
};

export type SellerAccess = { canPublish: boolean; isListed: boolean; canSell: boolean };

/**
 * Adds calendar months in UTC, landing on `anchorDay` (default: the start's own day) clamped to the
 * length of the target month. Passing the ORIGINAL billing day avoids month-end drift:
 * Jan 31 -> Feb 28 -> Mar 31 (not Mar 28). The SQL function `grant_subscription_period` applies
 * the same rule; keep both in sync.
 */
export function periodEndFor(start: Date, months: number = SELLER_PLAN.periodMonths, anchorDay: number = start.getUTCDate()): Date {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const end = new Date(start.getTime());
  end.setUTCDate(1);
  end.setUTCMonth(m);
  end.setUTCDate(Math.min(anchorDay, lastDay));
  return end;
}

/** Period start is inclusive, period end is exclusive. */
export function decideSubscription({ periods, now }: { periods: readonly SubscriptionPeriod[]; now: Date }): SubscriptionState {
  if (periods.length === 0) return { status: "none", activeUntil: null, nextPeriodStart: now };

  const sorted = [...periods].sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
  const current = sorted.find((p) => p.periodStart <= now && now < p.periodEnd);
  if (!current) return { status: "lapsed", activeUntil: null, nextPeriodStart: now };

  let until = current.periodEnd;
  for (const p of sorted) {
    if (p.periodStart <= until && p.periodEnd > until) until = p.periodEnd;
  }
  return { status: "active", activeUntil: until, nextPeriodStart: until };
}

export function decideSellerAccess({ isPlatform, subscription }: { isPlatform: boolean; subscription: SubscriptionState }): SellerAccess {
  const live = isPlatform || subscription.status === "active";
  return { canPublish: live, isListed: live, canSell: live };
}
