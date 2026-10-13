-- Seller marketplace: expand-only schema + backfill.
--
-- Strategy (non-destructive, no DELETE statements):
--   * New tables: profiles, sellers, subscriptions, books, book_uploads, ingestion_jobs.
--   * Legacy `stores` rows are mirrored into `books` REUSING the same id (book.id = store.id),
--     so re-keying the legacy tables is simply `book_id = store_id`.
--   * `stores` and every `store_id` column stay in place (readable, rollback-friendly).
--   * All writes happen server-side with the service role; RLS policies live in the next migration.
--
-- Prices are integer COP cents.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.account_role  as enum ('buyer', 'seller');
create type public.book_status   as enum ('draft', 'published', 'archived');
create type public.upload_status as enum ('pending', 'uploaded', 'processing', 'ready', 'failed');
create type public.job_status    as enum ('queued', 'processing', 'succeeded', 'failed');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user; `role` is the source of truth (never user_metadata).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.account_role not null,
  display_name text,
  avatar_url   text,
  phone        text,
  city         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sellers: own uuid so the platform seller can exist without an auth user.
-- Keep the reserved list in sync with src/lib/routing/reserved-slugs.ts.
-- ---------------------------------------------------------------------------
create table public.sellers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users (id) on delete cascade,
  slug        text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  store_name  text not null check (char_length(store_name) between 1 and 80),
  bio         text,
  avatar_url  text,
  city        text,
  instagram   text,
  whatsapp    text,
  is_platform boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint sellers_slug_not_reserved check (
    is_platform or slug not in (
      'api', 'auth', 'login', 'ingresar', 'vendedor', 'mis-recetarios', 'explorar',
      'privacidad', 'terminos', 'admin', 'ayuda', 'precios', 'myshop', 'cocteles', 'micheladas'
    )
  )
);
alter table public.sellers enable row level security;

-- ---------------------------------------------------------------------------
-- subscriptions: paid periods. Liveness is computed from time (no cron).
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.sellers (id) on delete cascade,
  provider     text not null,
  provider_ref text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency     text not null default 'COP' check (char_length(currency) = 3),
  period_start timestamptz not null,
  period_end   timestamptz not null,
  created_at   timestamptz not null default now(),
  check (period_end > period_start),
  unique (provider, provider_ref)
);
alter table public.subscriptions enable row level security;
create index subscriptions_seller_period_idx on public.subscriptions (seller_id, period_end desc);

-- ---------------------------------------------------------------------------
-- book_uploads: one row per uploaded PDF (max 12 active per seller, enforced by trigger).
-- The book_id FK is added after `books` exists.
-- ---------------------------------------------------------------------------
create table public.book_uploads (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.sellers (id) on delete cascade,
  storage_path  text not null unique,
  original_name text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  status        public.upload_status not null default 'pending',
  book_id       uuid,
  error         text,
  removed_at    timestamptz,
  created_at    timestamptz not null default now()
);
alter table public.book_uploads enable row level security;
create index book_uploads_seller_idx on public.book_uploads (seller_id) where removed_at is null;

create function public.enforce_upload_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  active_count integer;
begin
  -- Serialize concurrent inserts for the same seller.
  perform 1 from public.sellers where id = new.seller_id for update;

  select count(*) into active_count
  from public.book_uploads
  where seller_id = new.seller_id and removed_at is null;

  if new.removed_at is null and active_count >= 12 then
    raise exception 'upload_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger book_uploads_enforce_limit before insert on public.book_uploads
  for each row execute function public.enforce_upload_limit();

-- ---------------------------------------------------------------------------
-- books: the sellable product. Legacy rows reuse stores.id.
-- ---------------------------------------------------------------------------
create table public.books (
  id               uuid primary key default gen_random_uuid(),
  seller_id        uuid not null references public.sellers (id) on delete cascade,
  slug             text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text not null,
  tagline          text,
  description      text,
  cover_url        text,
  primary_color    text not null default '#1f2937' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color  text not null default '#f59e0b' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  background_color text not null default '#ffffff' check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  text_color       text not null default '#111827' check (text_color ~ '^#[0-9a-fA-F]{6}$'),
  font             text not null default 'Inter',
  price_cents      integer not null default 0 check (price_cents >= 0),
  currency         text not null default 'COP' check (char_length(currency) = 3),
  -- Public marketing preview: { intro: string[], sample: { title, ingredients[], steps[] } }.
  teaser           jsonb not null default '{}'::jsonb,
  status           public.book_status not null default 'draft',
  upload_id        uuid unique references public.book_uploads (id) on delete set null,
  legacy_store_id  uuid unique,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (seller_id, slug)
);
alter table public.books enable row level security;
create index books_published_idx on public.books (published_at desc) where status = 'published';
create trigger books_set_updated_at before update on public.books
  for each row execute function public.set_updated_at();

alter table public.book_uploads
  add constraint book_uploads_book_id_fkey
  foreign key (book_id) references public.books (id) on delete set null;
create index book_uploads_book_idx on public.book_uploads (book_id);

-- ---------------------------------------------------------------------------
-- ingestion_jobs: Postgres-backed queue (claimed with FOR UPDATE SKIP LOCKED).
-- ---------------------------------------------------------------------------
create table public.ingestion_jobs (
  id           uuid primary key default gen_random_uuid(),
  upload_id    uuid not null unique references public.book_uploads (id) on delete cascade,
  status       public.job_status not null default 'queued',
  attempts     integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts > 0),
  run_after    timestamptz not null default now(),
  locked_at    timestamptz,
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.ingestion_jobs enable row level security;
create index ingestion_jobs_status_run_idx on public.ingestion_jobs (status, run_after);
create trigger ingestion_jobs_set_updated_at before update on public.ingestion_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Backfill (INSERT ... SELECT / UPDATE only; no DELETE).
-- ---------------------------------------------------------------------------
insert into public.sellers (slug, store_name, is_platform)
values ('myshop', 'MyShop', true)
on conflict (slug) do nothing;

insert into public.books (
  id, seller_id, slug, title, tagline, description, cover_url,
  primary_color, secondary_color, background_color, text_color, font,
  price_cents, currency, teaser, status, legacy_store_id, published_at, created_at
)
select
  s.id,
  (select id from public.sellers where slug = 'myshop'),
  s.slug, s.name, s.tagline, s.description, s.cover_url,
  s.primary_color, s.secondary_color, s.background_color, s.text_color, s.font,
  s.price_cents, s.currency, s.teaser,
  case when s.published then 'published'::public.book_status else 'draft'::public.book_status end,
  s.id,
  case when s.published then s.created_at end,
  s.created_at
from public.stores s
on conflict (id) do nothing;

-- Re-key the legacy tables: book_id = store_id (books reuse stores.id).
alter table public.recipe_categories add column book_id uuid references public.books (id) on delete cascade;
alter table public.book_sections     add column book_id uuid references public.books (id) on delete cascade;
alter table public.recipes           add column book_id uuid references public.books (id) on delete cascade;
alter table public.purchases         add column book_id uuid references public.books (id) on delete restrict;

update public.recipe_categories set book_id = store_id where book_id is null;
update public.book_sections     set book_id = store_id where book_id is null;
update public.recipes           set book_id = store_id where book_id is null;
update public.purchases         set book_id = store_id where book_id is null;

alter table public.recipe_categories alter column book_id set not null;
alter table public.book_sections     alter column book_id set not null;
alter table public.recipes           alter column book_id set not null;
alter table public.purchases         alter column book_id set not null;

-- store_id becomes optional so new books (which have no legacy store) can insert rows.
alter table public.recipe_categories alter column store_id drop not null;
alter table public.book_sections     alter column store_id drop not null;
alter table public.recipes           alter column store_id drop not null;
alter table public.purchases         alter column store_id drop not null;

alter table public.recipe_categories add constraint recipe_categories_book_slug_key unique (book_id, slug);
alter table public.recipes           add constraint recipes_book_slug_key unique (book_id, slug);
alter table public.purchases         add constraint purchases_user_book_key unique (user_id, book_id);

create index recipes_book_position_idx on public.recipes (book_id, position);
create index book_sections_book_position_idx on public.book_sections (book_id, position);
create index recipe_categories_book_position_idx on public.recipe_categories (book_id, position);
create index purchases_book_idx on public.purchases (book_id);
create index books_seller_idx on public.books (seller_id);

-- Existing purchasers are buyers (accounts that already bought can never become sellers).
insert into public.profiles (id, role)
select distinct p.user_id, 'buyer'::public.account_role
from public.purchases p
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Triggers keeping the legacy write path (npm run import:book, store_id writers) working.
-- ---------------------------------------------------------------------------
create function public.sync_book_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.book_id := coalesce(new.book_id, new.store_id);
  return new;
end;
$$;

create trigger recipe_categories_sync_book_id before insert on public.recipe_categories
  for each row execute function public.sync_book_id();
create trigger book_sections_sync_book_id before insert on public.book_sections
  for each row execute function public.sync_book_id();
create trigger recipes_sync_book_id before insert on public.recipes
  for each row execute function public.sync_book_id();
create trigger purchases_sync_book_id before insert on public.purchases
  for each row execute function public.sync_book_id();

-- A legacy store written by the import script must also exist as a platform-owned book.
create function public.sync_book_from_store()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.books (
    id, seller_id, slug, title, tagline, description, cover_url,
    primary_color, secondary_color, background_color, text_color, font,
    price_cents, currency, teaser, status, legacy_store_id, published_at, created_at
  )
  values (
    new.id,
    (select id from public.sellers where slug = 'myshop'),
    new.slug, new.name, new.tagline, new.description, new.cover_url,
    new.primary_color, new.secondary_color, new.background_color, new.text_color, new.font,
    new.price_cents, new.currency, new.teaser,
    case when new.published then 'published'::public.book_status else 'draft'::public.book_status end,
    new.id,
    case when new.published then new.created_at end,
    new.created_at
  )
  on conflict (id) do update set
    slug = excluded.slug,
    title = excluded.title,
    tagline = excluded.tagline,
    description = excluded.description,
    cover_url = excluded.cover_url,
    primary_color = excluded.primary_color,
    secondary_color = excluded.secondary_color,
    background_color = excluded.background_color,
    text_color = excluded.text_color,
    font = excluded.font,
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    teaser = excluded.teaser,
    status = excluded.status;
  return new;
end;
$$;
create trigger stores_sync_book after insert or update on public.stores
  for each row execute function public.sync_book_from_store();

-- Sellers can never buy (R2). The service role bypasses RLS but not triggers.
create function public.purchases_buyer_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles pr
    where pr.id = new.user_id and pr.role = 'seller'
  ) then
    raise exception 'sellers_cannot_purchase' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger purchases_buyer_only before insert on public.purchases
  for each row execute function public.purchases_buyer_only();

-- ---------------------------------------------------------------------------
-- RPCs (service role only)
-- ---------------------------------------------------------------------------

-- Atomically claims one runnable job (queued and due, or stale processing).
create function public.claim_ingestion_job(p_stale interval default interval '10 minutes')
returns setof public.ingestion_jobs
language sql
set search_path = ''
as $$
  update public.ingestion_jobs j
  set status = 'processing',
      attempts = j.attempts + 1,
      locked_at = now()
  where j.id = (
    select c.id
    from public.ingestion_jobs c
    where (c.status = 'queued' and c.run_after <= now())
       or (c.status = 'processing' and c.locked_at < now() - p_stale)
    order by c.created_at
    for update skip locked
    limit 1
  )
  returning j.*;
$$;

-- Persists a whole AI-generated book atomically and idempotently (books.upload_id is unique).
-- p_payload shape:
--   { slug, title, tagline?, description?, teaser?,
--     categories: [{ slug, name, description?, position }],
--     sections:   [{ position, title, blocks }],
--     recipes:    [{ category_slug?, slug, title, position, yield_text?, yield_servings,
--                    time_text?, ingredients, steps, notes, extras }] }
create function public.create_book_from_ingestion(p_seller uuid, p_upload uuid, p_payload jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_book_id   uuid;
  v_slug      text;
  v_base_slug text;
  v_suffix    integer := 1;
  v_cat       jsonb;
  v_sec       jsonb;
  v_rec       jsonb;
  v_cat_id    uuid;
begin
  -- Ownership: the upload must belong to the seller.
  if not exists (
    select 1 from public.book_uploads u where u.id = p_upload and u.seller_id = p_seller
  ) then
    raise exception 'upload_not_owned' using errcode = 'P0001';
  end if;

  -- Idempotent retry.
  select b.id into v_book_id from public.books b where b.upload_id = p_upload;
  if v_book_id is not null then
    return v_book_id;
  end if;

  v_base_slug := p_payload ->> 'slug';
  v_slug := v_base_slug;
  while exists (select 1 from public.books b where b.seller_id = p_seller and b.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.books (seller_id, slug, title, tagline, description, teaser, status, upload_id)
  values (
    p_seller, v_slug, p_payload ->> 'title', p_payload ->> 'tagline', p_payload ->> 'description',
    coalesce(p_payload -> 'teaser', '{}'::jsonb), 'draft', p_upload
  )
  returning id into v_book_id;

  for v_cat in select * from jsonb_array_elements(coalesce(p_payload -> 'categories', '[]'::jsonb)) loop
    insert into public.recipe_categories (book_id, slug, name, description, position)
    values (
      v_book_id, v_cat ->> 'slug', v_cat ->> 'name', v_cat ->> 'description',
      coalesce((v_cat ->> 'position')::integer, 0)
    );
  end loop;

  for v_sec in select * from jsonb_array_elements(coalesce(p_payload -> 'sections', '[]'::jsonb)) loop
    insert into public.book_sections (book_id, position, title, blocks)
    values (
      v_book_id, coalesce((v_sec ->> 'position')::integer, 0), v_sec ->> 'title',
      coalesce(v_sec -> 'blocks', '[]'::jsonb)
    );
  end loop;

  for v_rec in select * from jsonb_array_elements(coalesce(p_payload -> 'recipes', '[]'::jsonb)) loop
    v_cat_id := null;
    if v_rec ->> 'category_slug' is not null then
      select c.id into v_cat_id
      from public.recipe_categories c
      where c.book_id = v_book_id and c.slug = v_rec ->> 'category_slug';
    end if;

    insert into public.recipes (
      book_id, category_id, slug, title, position, yield_text, yield_servings,
      time_text, ingredients, steps, notes, extras
    )
    values (
      v_book_id, v_cat_id, v_rec ->> 'slug', v_rec ->> 'title',
      coalesce((v_rec ->> 'position')::integer, 0),
      v_rec ->> 'yield_text',
      coalesce((v_rec ->> 'yield_servings')::integer, 1),
      v_rec ->> 'time_text',
      coalesce(v_rec -> 'ingredients', '[]'::jsonb),
      coalesce(v_rec -> 'steps', '[]'::jsonb),
      coalesce(v_rec -> 'notes', '[]'::jsonb),
      coalesce(v_rec -> 'extras', '{}'::jsonb)
    );
  end loop;

  update public.book_uploads set status = 'ready', book_id = v_book_id, error = null
  where id = p_upload;
  update public.ingestion_jobs set status = 'succeeded', locked_at = null, last_error = null
  where upload_id = p_upload;

  return v_book_id;
end;
$$;

-- Function privileges: service role only.
revoke execute on function public.claim_ingestion_job(interval) from public, anon, authenticated;
revoke execute on function public.create_book_from_ingestion(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.sync_book_from_store() from public, anon, authenticated;
grant execute on function public.claim_ingestion_job(interval) to service_role;
grant execute on function public.create_book_from_ingestion(uuid, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Private bucket for seller PDFs. No storage.objects policies: access is only via
-- service-role signed URLs (path: {seller_id}/{upload_id}.pdf).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seller-pdfs', 'seller-pdfs', false, 20971520, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf'];
