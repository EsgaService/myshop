import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decideSellerAccess,
  decideSubscription,
  type SellerAccess,
  type SubscriptionState,
} from "./decide-subscription";

/**
 * Subscription state of a seller, computed from time (a lapse needs no cron job).
 * Reads `subscriptions` with the service role because the table is owner-only under RLS.
 */
export async function getSellerSubscription(sellerId: string, now: Date = new Date()): Promise<SubscriptionState> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("subscriptions").select("period_start,period_end").eq("seller_id", sellerId);
  if (error) throw new Error(`subscription lookup failed: ${error.message}`);
  const periods = (data ?? []).map((r) => ({
    periodStart: new Date(r.period_start as string),
    periodEnd: new Date(r.period_end as string),
  }));
  return decideSubscription({ periods, now });
}

/** Whether a seller may currently sell (active subscription or platform seller). */
export async function getSellerAccess(sellerId: string, isPlatform: boolean, now: Date = new Date()): Promise<SellerAccess> {
  if (isPlatform) return decideSellerAccess({ isPlatform, subscription: decideSubscription({ periods: [], now }) });
  return decideSellerAccess({ isPlatform, subscription: await getSellerSubscription(sellerId, now) });
}
