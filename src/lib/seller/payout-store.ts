import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskAccountNumber, type PayoutAccountValue } from "./payout-account";

export type SavedPayoutAccount = {
  method: PayoutAccountValue["method"];
  institution: string;
  accountType: PayoutAccountValue["account_type"];
  /** Masked: the full number never leaves the server after saving. */
  maskedAccountNumber: string;
  holderName: string;
  documentType: PayoutAccountValue["holder_document_type"];
  maskedDocumentNumber: string;
};

/** Reads the seller's payout account with the service role (keyed by the session seller) and masks it. */
export async function getSavedPayoutAccount(sellerId: string): Promise<SavedPayoutAccount | null> {
  const { data, error } = await createAdminClient()
    .from("seller_payout_accounts")
    .select("method,institution,account_type,account_number,holder_name,holder_document_type,holder_document_number")
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (error) throw new Error(`payout account lookup failed: ${error.message}`);
  if (!data) return null;
  return {
    method: data.method as SavedPayoutAccount["method"],
    institution: data.institution as string,
    accountType: (data.account_type as SavedPayoutAccount["accountType"]) ?? null,
    maskedAccountNumber: maskAccountNumber(data.account_number as string),
    holderName: data.holder_name as string,
    documentType: data.holder_document_type as SavedPayoutAccount["documentType"],
    maskedDocumentNumber: maskAccountNumber(data.holder_document_number as string),
  };
}

export async function hasPayoutAccount(sellerId: string): Promise<boolean> {
  const { count, error } = await createAdminClient()
    .from("seller_payout_accounts")
    .select("seller_id", { count: "exact", head: true })
    .eq("seller_id", sellerId);
  if (error) throw new Error(`payout account lookup failed: ${error.message}`);
  return (count ?? 0) > 0;
}
