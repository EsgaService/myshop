-- Wompi integration, part 1: server-side checkout records + reserve the /pagos route.
--
-- Wompi events only carry our `reference`, so every hosted checkout is stored BEFORE the buyer is redirected.
-- The webhook and the return page read who pays / for what / how much from this table and refuse any event
-- that disagrees with it. Service role only: RLS is enabled and there are NO client policies on purpose.
--
-- Contains no DELETE and no DROP POLICY, so the Supabase MCP can apply it.

create table public.payment_checkouts (
  id                      uuid primary key default gen_random_uuid(),
  reference               text not null unique
    check (reference ~ '^[A-Za-z0-9_-]{1,64}$'),
  kind                    text not null check (kind in ('purchase', 'subscription')),
  -- bookId for purchases, sellerId for subscriptions (polymorphic, so no FK).
  subject_id              uuid not null,
  user_id                 uuid not null references auth.users (id) on delete cascade,
  amount_cents            integer not null check (amount_cents > 0),
  currency                text not null check (char_length(currency) = 3),
  provider                text not null,
  status                  text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'voided', 'error')),
  provider_transaction_id text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.payment_checkouts enable row level security;

-- FK column without an index would make auth.users deletes scan the table.
create index payment_checkouts_user_idx on public.payment_checkouts (user_id);

-- Defense in depth: even with RLS and no policies, the client roles get no table privileges at all.
revoke all on table public.payment_checkouts from anon, authenticated;

comment on table public.payment_checkouts is
  'Server-side record of hosted checkouts (Wompi). Service role only: RLS on, no client policies.';

-- ---------------------------------------------------------------------------
-- The return page lives at /pagos/resultado, which would collide with /[seller]/[book].
-- Keep the list in sync with src/lib/routing/reserved-slugs.ts.
-- (ALTER only: no DELETE / DROP POLICY involved.)
-- ---------------------------------------------------------------------------
alter table public.sellers drop constraint sellers_slug_not_reserved;
alter table public.sellers add constraint sellers_slug_not_reserved check (
  is_platform or slug not in (
    'api', 'auth', 'login', 'ingresar', 'vendedor', 'mis-recetarios', 'explorar',
    'privacidad', 'terminos', 'admin', 'ayuda', 'precios', 'myshop', 'cocteles', 'micheladas', 'pagos'
  )
);
