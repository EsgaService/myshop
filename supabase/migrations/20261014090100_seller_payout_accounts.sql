-- Seller payout account ("Cuenta para pagos").
--
-- The platform's single Wompi account collects every payment; earnings are disbursed to each seller
-- manually ("dispersion"). This table holds where to send them. It is sensitive personal data
-- (Ley 1581 de 2012): only the owner seller can read their own row, nobody writes from the client.
--
-- Contains no DELETE and no DROP POLICY, so the Supabase MCP can apply it.

create table public.seller_payout_accounts (
  seller_id              uuid primary key references public.sellers (id) on delete cascade,
  method                 text not null check (method in ('bank', 'wallet')),
  institution            text not null check (char_length(institution) between 2 and 60),
  account_type           text check (account_type in ('savings', 'checking')),
  -- Digits only. Wallets are 10-digit Colombian mobile numbers (start with 3).
  account_number         text not null check (account_number ~ '^[0-9]{4,20}$'),
  holder_name            text not null check (char_length(btrim(holder_name)) between 3 and 120),
  holder_document_type   text not null check (holder_document_type in ('CC', 'CE', 'NIT', 'PP')),
  holder_document_number text not null check (holder_document_number ~ '^[A-Za-z0-9]{4,20}$'),
  updated_at             timestamptz not null default now(),
  constraint payout_bank_has_account_type check (
    (method = 'bank' and account_type is not null) or (method = 'wallet' and account_type is null)
  ),
  constraint payout_wallet_is_mobile check (method <> 'wallet' or account_number ~ '^3[0-9]{9}$')
);

alter table public.seller_payout_accounts enable row level security;

-- Read-only for the owner seller; writes only through the service role behind requireSeller().
create policy "payout accounts are readable by their seller"
  on public.seller_payout_accounts for select
  to authenticated
  using (seller_id = (select private.my_seller_id()));

revoke all on table public.seller_payout_accounts from anon, authenticated;
grant select on table public.seller_payout_accounts to authenticated;
