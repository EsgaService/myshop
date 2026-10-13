import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowedPreviousStatuses } from "./checkout-status";
import type { CheckoutRecord, CheckoutStatus, CheckoutStore } from "./checkout-types";

const COLUMNS = "reference,kind,subject_id,user_id,amount_cents,currency,provider,status,provider_transaction_id,expires_at";

type Row = Record<string, unknown>;

function toRecord(data: Row): CheckoutRecord {
  return {
    reference: data.reference as string,
    kind: data.kind as CheckoutRecord["kind"],
    subjectId: data.subject_id as string,
    userId: data.user_id as string,
    amountCents: data.amount_cents as number,
    currency: data.currency as string,
    provider: data.provider as string,
    status: data.status as CheckoutStatus,
    providerTransactionId: (data.provider_transaction_id as string | null) ?? null,
    expiresAt: (data.expires_at as string | null) ?? null,
  };
}

/**
 * `payment_checkouts` access with the service role. The table has RLS enabled and no client policies:
 * only server code (behind requireSeller/requireBuyer or a verified webhook) reads or writes it.
 */
export const adminCheckoutStore: CheckoutStore = {
  async create(checkout) {
    const { error } = await createAdminClient().from("payment_checkouts").insert({
      reference: checkout.reference,
      kind: checkout.kind,
      subject_id: checkout.subjectId,
      user_id: checkout.userId,
      amount_cents: checkout.amountCents,
      currency: checkout.currency,
      provider: checkout.provider,
      expires_at: checkout.expiresAt,
    });
    if (error) throw new Error(`Could not store checkout: ${error.message}`);
  },

  async findByReference(reference) {
    const { data, error } = await createAdminClient().from("payment_checkouts").select(COLUMNS).eq("reference", reference).maybeSingle();
    if (error) throw new Error(`Could not load checkout: ${error.message}`);
    return data ? toRecord(data) : null;
  },

  async recordOutcome(reference, outcome) {
    const previous = allowedPreviousStatuses(outcome.status);
    if (previous.length === 0) return;
    const { error } = await createAdminClient()
      .from("payment_checkouts")
      .update({ status: outcome.status, provider_transaction_id: outcome.providerTransactionId, updated_at: new Date().toISOString() })
      .eq("reference", reference)
      .in("status", previous);
    if (error) throw new Error(`Could not record checkout outcome: ${error.message}`);
    if (outcome.status === "voided") {
      // A voided payment may follow an approval whose access we keep: leave a trace for manual review.
      console.warn("payment voided: review manually, access is not revoked automatically", { reference });
    }
  },

  async findReusablePending(query) {
    const { data, error } = await createAdminClient()
      .from("payment_checkouts")
      .select(COLUMNS)
      .eq("user_id", query.userId)
      .eq("kind", query.kind)
      .eq("subject_id", query.subjectId)
      .eq("amount_cents", query.amountCents)
      .eq("currency", query.currency)
      .eq("provider", query.provider)
      .eq("status", "pending")
      .gt("expires_at", query.validUntil.toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Could not look up pending checkout: ${error.message}`);
    return data ? toRecord(data) : null;
  },

  async findByUserAndTransaction(userId, transactionId) {
    const { data, error } = await createAdminClient()
      .from("payment_checkouts")
      .select(COLUMNS)
      .eq("user_id", userId)
      .eq("provider_transaction_id", transactionId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Could not look up checkout by transaction: ${error.message}`);
    return data ? toRecord(data) : null;
  },

  async userHasCheckouts(userId) {
    const { count, error } = await createAdminClient()
      .from("payment_checkouts")
      .select("reference", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw new Error(`Could not count checkouts: ${error.message}`);
    return (count ?? 0) > 0;
  },
};
