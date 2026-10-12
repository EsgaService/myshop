import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type GrantPurchaseInput = {
  userId: string;
  storeId: string;
  provider: string;
  providerRef: string;
  amountCents: number;
  currency: string;
};

/**
 * Writes the purchase row with the service role. Idempotent per (user, store):
 * a repeated webhook or double submit never creates a second row.
 */
export async function grantPurchase(input: GrantPurchaseInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("purchases").upsert(
    {
      user_id: input.userId,
      store_id: input.storeId,
      provider: input.provider,
      provider_ref: input.providerRef,
      amount_cents: input.amountCents,
      currency: input.currency,
    },
    { onConflict: "user_id,store_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Could not record purchase: ${error.message}`);
}
