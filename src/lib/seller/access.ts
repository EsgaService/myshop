import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideSellerAccess, decideSubscription, type SellerAccess } from "./decide-subscription";

/**
 * Whether a seller may currently sell (active subscription or platform seller).
 * Reads `subscriptions` with the service role because the table is owner-only
 * under RLS; the result is time-computed, so a lapse needs no cron job.
 */
export async function getSellerAccess(sellerId: string, isPlatform: boolean, now: Date = new Date()): Promise<SellerAccess> {
  if (isPlatform) return decideSellerAccess({ isPlatform, subscription: decideSubscription({ periods: [], now }) });
  const admin = createAdminClient();
  const { data, error } = await admin.from("subscriptions").select("period_start,period_end").eq("seller_id", sellerId);
  if (error) throw new Error(`subscription lookup failed: ${error.message}`);
  const periods = (data ?? []).map((r) => ({
    periodStart: new Date(r.period_start as string),
    periodEnd: new Date(r.period_end as string),
  }));
  return decideSellerAccess({ isPlatform, subscription: decideSubscription({ periods, now }) });
}
