import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPurchaseRow,
  type GrantPurchaseInput,
  subscriptionGrantArgs,
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
 * Appends the next paid period for a seller. The SQL function serializes grants per seller
 * (row lock), computes the contiguous period and inserts idempotently per (provider, provider_ref),
 * so concurrent or repeated webhooks never overlap or extend the subscription twice.
 */
export async function grantSubscriptionPeriod(input: GrantSubscriptionInput): Promise<void> {
  const { error } = await createAdminClient().rpc("grant_subscription_period", subscriptionGrantArgs(input));
  if (error) throw new Error(`Could not record subscription: ${error.message}`);
}
