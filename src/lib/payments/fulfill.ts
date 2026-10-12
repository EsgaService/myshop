import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPurchaseRow,
  buildSubscriptionRow,
  type GrantPurchaseInput,
  type GrantSubscriptionInput,
} from "./fulfill-rows";

export type { GrantPurchaseInput, GrantSubscriptionInput };

/**
 * Writes the purchase row with the service role. Idempotent per (user, book):
 * a repeated webhook or double submit never creates a second row.
 * Legacy books also mirror `store_id` so the old read path keeps working.
 */
export async function grantPurchase(input: GrantPurchaseInput): Promise<void> {
  const admin = createAdminClient();
  const { data: book, error: bookError } = await admin
    .from("books")
    .select("legacy_store_id")
    .eq("id", input.bookId)
    .maybeSingle();
  if (bookError || !book) throw new Error(`Could not record purchase: book not found`);

  const { error } = await admin
    .from("purchases")
    .upsert(buildPurchaseRow(input, (book.legacy_store_id as string | null) ?? null), {
      onConflict: "user_id,book_id",
      ignoreDuplicates: true,
    });
  if (error) throw new Error(`Could not record purchase: ${error.message}`);
}

/**
 * Appends the next paid period for a seller. Idempotent per (provider, provider_ref),
 * so a repeated webhook never extends the subscription twice.
 */
export async function grantSubscriptionPeriod(input: GrantSubscriptionInput): Promise<void> {
  const admin = createAdminClient();
  const { data, error: readError } = await admin
    .from("subscriptions")
    .select("period_start,period_end")
    .eq("seller_id", input.sellerId);
  if (readError) throw new Error(`Could not record subscription: ${readError.message}`);

  const periods = (data ?? []).map((r) => ({
    periodStart: new Date(r.period_start as string),
    periodEnd: new Date(r.period_end as string),
  }));
  const row = buildSubscriptionRow({ ...input, periods, now: new Date() });

  const { error } = await admin
    .from("subscriptions")
    .upsert(row, { onConflict: "provider,provider_ref", ignoreDuplicates: true });
  if (error) throw new Error(`Could not record subscription: ${error.message}`);
}
