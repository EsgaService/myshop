-- Wompi review fixes.
--
-- 1. payment_checkouts.status gains 'approved_unfulfilled': the payment was approved but access could not be
--    granted (book missing or archived), so support must refund. 'voided' may now follow 'approved' (flag for
--    manual review; access is NOT revoked automatically).
-- 2. payment_checkouts.expires_at: validity of the hosted checkout link, used to reuse a still-valid pending
--    checkout instead of creating a second one (double click / second tab).
-- 3. seller_payout_accounts: revoke the SELECT grant from the client roles. The owner never needs the raw
--    account number in the browser (the app reads it with the service role and masks it). Without the grant the
--    select policy is inert; it can be dropped later from the Dashboard (the MCP rejects DROP POLICY).
--
-- Contains no DELETE and no DROP POLICY, so the Supabase MCP can apply it.

alter table public.payment_checkouts add column expires_at timestamptz;

alter table public.payment_checkouts drop constraint payment_checkouts_status_check;
alter table public.payment_checkouts add constraint payment_checkouts_status_check
  check (status in ('pending', 'approved', 'approved_unfulfilled', 'declined', 'voided', 'error'));

-- Reuse lookup: pending checkouts of one user for one subject.
create index payment_checkouts_pending_reuse_idx
  on public.payment_checkouts (user_id, kind, subject_id, expires_at desc)
  where status = 'pending';

revoke select on table public.seller_payout_accounts from authenticated, anon;
