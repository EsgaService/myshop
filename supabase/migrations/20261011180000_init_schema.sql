-- White-label recipe-book stores: schema, RLS and grants.
-- Access model:
--   * stores + recipe_categories are public (sales pages, menu).
--   * book_sections + recipes are readable only by users with a purchases row for that store.
--   * purchases is readable by its owner and writable ONLY with the service role (server-side).

create table public.stores (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug not in ('api', 'auth', 'login')),  -- reserved route names
  name             text not null,
  tagline          text,
  description      text,
  logo_url         text,
  cover_url        text,
  primary_color    text not null default '#1f2937' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color  text not null default '#f59e0b' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  background_color text not null default '#ffffff' check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  text_color       text not null default '#111827' check (text_color ~ '^#[0-9a-fA-F]{6}$'),
  font             text not null default 'Inter',
  price_cents      integer not null default 0 check (price_cents >= 0),
  currency         text not null default 'COP' check (char_length(currency) = 3),
  -- Public marketing preview: { intro: string[], sample: { title, ingredients[], steps[] } }.
  -- Deliberately public; keep it to a small free sample.
  teaser           jsonb not null default '{}'::jsonb,
  published        boolean not null default true,
  created_at       timestamptz not null default now()
);

create table public.recipe_categories (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  slug        text not null,
  name        text not null,
  description text,
  position    integer not null default 0,
  unique (store_id, slug)
);

-- Narrative sections of the book (intro, basics, safety...).
-- blocks = [{ tipo: 'p' | 'h' | 'ul' | 'tabla', texto | items | filas }]
create table public.book_sections (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references public.stores (id) on delete cascade,
  position  integer not null default 0,
  title     text not null,
  blocks    jsonb not null default '[]'::jsonb
);

create table public.recipes (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores (id) on delete cascade,
  category_id       uuid references public.recipe_categories (id) on delete set null,
  slug              text not null,
  title             text not null,
  position          integer not null default 0,
  photo_path        text,          -- storage path (bucket recipe-photos) or absolute URL
  photo_people_path text,
  yield_text        text,          -- e.g. "1 vaso alto (400 ml)"
  yield_servings    integer not null default 1 check (yield_servings > 0),
  time_text         text,
  -- [{ raw: string, qty: number|null, rest: string }]
  ingredients       jsonb not null default '[]'::jsonb,
  steps             jsonb not null default '[]'::jsonb,   -- string[]
  notes             jsonb not null default '[]'::jsonb,   -- string[]
  -- { adelanta, presentacion, conservacion, variacion, variacion_titulo }
  extras            jsonb not null default '{}'::jsonb,
  unique (store_id, slug)
);

create table public.purchases (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  store_id     uuid not null references public.stores (id) on delete restrict,
  provider     text not null,
  provider_ref text,
  amount_cents integer not null check (amount_cents >= 0),
  currency     text not null,
  created_at   timestamptz not null default now(),
  unique (user_id, store_id)
);

-- Indexes for FK columns and RLS lookups. Unique constraints already cover
-- stores.slug, categories(store_id, slug), recipes(store_id, slug) and purchases(user_id, store_id).
create index recipes_store_position_idx on public.recipes (store_id, position);
create index recipes_category_idx on public.recipes (category_id);
create index book_sections_store_position_idx on public.book_sections (store_id, position);
create index purchases_store_idx on public.purchases (store_id);

-- Row level security
alter table public.stores            enable row level security;
alter table public.recipe_categories enable row level security;
alter table public.book_sections     enable row level security;
alter table public.recipes           enable row level security;
alter table public.purchases         enable row level security;

create policy "stores are public"
  on public.stores for select
  to anon, authenticated
  using (published);

create policy "categories are public"
  on public.recipe_categories for select
  to anon, authenticated
  using (true);

create policy "buyers read book sections"
  on public.book_sections for select
  to authenticated
  using (exists (
    select 1 from public.purchases p
    where p.store_id = book_sections.store_id
      and p.user_id = (select auth.uid())
  ));

create policy "buyers read recipes"
  on public.recipes for select
  to authenticated
  using (exists (
    select 1 from public.purchases p
    where p.store_id = recipes.store_id
      and p.user_id = (select auth.uid())
  ));

create policy "users read their own purchases"
  on public.purchases for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No INSERT/UPDATE/DELETE policies exist on any table: only the service role
-- (which bypasses RLS) can write. The grants below are defense in depth.
revoke all on public.stores, public.recipe_categories, public.book_sections, public.recipes, public.purchases
  from anon, authenticated;

grant select on public.stores, public.recipe_categories to anon, authenticated;
grant select on public.book_sections, public.recipes, public.purchases to authenticated;

-- Public bucket for recipe photos (photos are not treated as secret in this first slice).
insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;
