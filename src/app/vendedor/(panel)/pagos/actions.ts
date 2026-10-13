"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth/guards";
import { parsePayoutAccount } from "@/lib/seller/payout-account";
import { createAdminClient } from "@/lib/supabase/admin";

export type PayoutFormState = {
  status: "idle" | "saved" | "error";
  errors?: Record<string, string>;
  message?: string;
};

/**
 * Saves the caller's own payout account. The seller id comes from the session (requireSeller), never
 * from the form; the write uses the service role because the table has no client write policies.
 */
export async function savePayoutAccount(_prev: PayoutFormState, formData: FormData): Promise<PayoutFormState> {
  const { seller } = await requireSeller();
  const parsed = parsePayoutAccount(Object.fromEntries(formData.entries()));
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const { error } = await createAdminClient()
    .from("seller_payout_accounts")
    .upsert({ ...parsed.value, seller_id: seller.id, updated_at: new Date().toISOString() }, { onConflict: "seller_id" });
  if (error) {
    console.error("payout account save failed", { code: error.code });
    return { status: "error", message: "No pudimos guardar tu cuenta. Inténtalo de nuevo." };
  }

  revalidatePath("/vendedor", "layout");
  return { status: "saved" };
}
