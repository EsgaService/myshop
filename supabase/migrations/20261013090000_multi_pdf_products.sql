-- Multi-PDF products, part A (additive: ADD COLUMN, CREATE INDEX, UPDATE, CREATE OR REPLACE only).
-- No DELETE and no DROP POLICY, so it can be applied through the Supabase MCP.
--
--   * A product (`books` row) can now hold several PDFs (`book_uploads.book_id`, set when the upload is requested).
--   * Recipes, sections and categories record the upload that produced them (`upload_id`, nullable:
--     legacy and seed rows have no provenance).
--   * `book_uploads.teaser` stores each PDF's public teaser; the book teaser is the one of the earliest active
--     ready PDF.
--   * "Ingested" is now `book_uploads.status = 'ready'` (it used to be `book_id is not null`).
--   * `create_book_from_ingestion` merges an upload into its product (locked, idempotent). If the upload has no
--     product yet (in-flight rows created before this migration) it falls back to creating one from the payload.
--
-- The removal RPC (it contains DELETE) lives in the next migration and is applied through the Dashboard or CLI.

-- ---------------------------------------------------------------------------
-- Provenance + per-PDF teaser
-- ---------------------------------------------------------------------------
alter table public.recipe_categories
  add column if not exists upload_id uuid references public.book_uploads (id) on delete set null;
alter table public.book_sections
  add column if not exists upload_id uuid references public.book_uploads (id) on delete set null;
alter table public.recipes
  add column if not exists upload_id uuid references public.book_uploads (id) on delete set null;

create index if not exists recipe_categories_upload_idx on public.recipe_categories (upload_id) where upload_id is not null;
create index if not exists book_sections_upload_idx on public.book_sections (upload_id) where upload_id is not null;
create index if not exists recipes_upload_idx on public.recipes (upload_id) where upload_id is not null;

alter table public.book_uploads
  add column if not exists teaser jsonb not null default '{}'::jsonb;

create index if not exists book_uploads_book_active_idx
  on public.book_uploads (book_id, created_at)
  where removed_at is null;

-- ---------------------------------------------------------------------------
-- Backfill (UPDATE only): existing books are one-PDF products.
-- ---------------------------------------------------------------------------
update public.recipes r
set upload_id = b.upload_id
from public.books b
where r.book_id = b.id and b.upload_id is not null and r.upload_id is null;

update public.book_sections s
set upload_id = b.upload_id
from public.books b
where s.book_id = b.id and b.upload_id is not null and s.upload_id is null;

update public.recipe_categories c
set upload_id = b.upload_id
from public.books b
where c.book_id = b.id and b.upload_id is not null and c.upload_id is null;

update public.book_uploads u
set teaser = b.teaser
from public.books b
where b.upload_id = u.id and u.teaser = '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- claim_ingestion_job: a dead job fails its upload unless it already merged (status, not book_id).
-- ---------------------------------------------------------------------------
create or replace function public.claim_ingestion_job(p_stale interval default interval '10 minutes')
returns setof public.ingestion_jobs
language plpgsql
set search_path = ''
as $$
declare
  v_max_concurrent constant integer := 3;
  v_running integer;
begin
  -- Serialize claims so the concurrency cap below cannot be raced.
  perform pg_advisory_xact_lock(hashtext('public.claim_ingestion_job'));

  -- A stale processing job that used all its attempts is terminal: never paid for again.
  with dead as (
    update public.ingestion_jobs j
    set status = 'failed',
        locked_at = null,
        last_error = 'El procesamiento tardó demasiado. Inténtalo de nuevo.'
    where j.status = 'processing'
      and j.locked_at < now() - p_stale
      and j.attempts >= j.max_attempts
    returning j.upload_id
  )
  update public.book_uploads u
  set status = 'failed',
      error = 'El procesamiento tardó demasiado. Inténtalo de nuevo.'
  from dead
  where u.id = dead.upload_id
    and u.status <> 'ready';

  select count(*) into v_running
  from public.ingestion_jobs r
  where r.status = 'processing'
    and r.locked_at >= now() - p_stale;
  if v_running >= v_max_concurrent then
    return;
  end if;

  return query
  update public.ingestion_jobs j
  set status = 'processing',
      attempts = j.attempts + 1,
      locked_at = now()
  where j.id = (
    select c.id
    from public.ingestion_jobs c
    where (c.status = 'queued' and c.run_after <= now())
       or (c.status = 'processing' and c.locked_at < now() - p_stale and c.attempts < c.max_attempts)
    order by c.created_at
    for update skip locked
    limit 1
  )
  returning j.*;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_book_from_ingestion: merge one upload into its product.
-- p_payload shape (unchanged):
--   { slug, title, tagline?, description?, teaser?,
--     categories: [{ slug, name, description?, position }],
--     sections:   [{ position, title, blocks }],
--     recipes:    [{ category_slug?, slug, title, position, yield_text?, yield_servings,
--                    time_text?, ingredients, steps, notes, extras }] }
-- Returns the product id.
-- ---------------------------------------------------------------------------
create or replace function public.create_book_from_ingestion(p_seller uuid, p_upload uuid, p_payload jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_book_id     uuid;
  v_book_seller uuid;
  v_legacy      uuid;
  v_up_status   public.upload_status;
  v_up_removed  timestamptz;
  v_slug        text;
  v_base_slug   text;
  v_suffix      integer;
  v_cat         jsonb;
  v_sec         jsonb;
  v_rec         jsonb;
  v_cat_id      uuid;
  v_cat_pos     integer;
  v_teaser      jsonb;
begin
  -- Ownership: the upload must belong to the seller.
  select u.book_id into v_book_id
  from public.book_uploads u
  where u.id = p_upload and u.seller_id = p_seller;
  if not found then
    raise exception 'upload_not_owned' using errcode = 'P0001';
  end if;

  -- Fallback for in-flight uploads created before products existed: build a product from the payload.
  if v_book_id is null then
    v_base_slug := p_payload ->> 'slug';
    v_slug := v_base_slug;
    v_suffix := 1;
    while exists (select 1 from public.books b where b.seller_id = p_seller and b.slug = v_slug) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base_slug || '-' || v_suffix;
    end loop;

    insert into public.books (seller_id, slug, title, tagline, description, status)
    values (p_seller, v_slug, p_payload ->> 'title', p_payload ->> 'tagline', p_payload ->> 'description', 'draft')
    returning id into v_book_id;

    update public.book_uploads set book_id = v_book_id where id = p_upload;
  end if;

  -- Lock order: product first, then the upload. All merges into one product are serialized.
  select b.seller_id, b.legacy_store_id into v_book_seller, v_legacy
  from public.books b
  where b.id = v_book_id
  for update;
  if v_book_seller is distinct from p_seller then
    raise exception 'upload_not_owned' using errcode = 'P0001';
  end if;

  select u.status, u.removed_at into v_up_status, v_up_removed
  from public.book_uploads u
  where u.id = p_upload
  for update;

  -- Removed while the job was in flight: discard the result.
  if v_up_removed is not null then
    update public.ingestion_jobs set status = 'succeeded', locked_at = null, last_error = null
    where upload_id = p_upload;
    return v_book_id;
  end if;

  -- Idempotent retry.
  if v_up_status = 'ready' then
    return v_book_id;
  end if;

  -- The seller-set title is never overwritten; AI text only fills empty fields.
  update public.books b
  set tagline = coalesce(nullif(btrim(b.tagline), ''), p_payload ->> 'tagline'),
      description = coalesce(nullif(btrim(b.description), ''), p_payload ->> 'description')
  where b.id = v_book_id;

  -- Categories merge by slug; new ones go after the existing ones.
  for v_cat in
    select c from jsonb_array_elements(coalesce(p_payload -> 'categories', '[]'::jsonb)) with ordinality as t(c, n)
    order by coalesce((c ->> 'position')::integer, 0), n
  loop
    if not exists (
      select 1 from public.recipe_categories c
      where c.book_id = v_book_id and c.slug = v_cat ->> 'slug'
    ) then
      select coalesce(max(c.position), 0) + 1 into v_cat_pos
      from public.recipe_categories c
      where c.book_id = v_book_id;

      insert into public.recipe_categories (book_id, slug, name, description, position, upload_id)
      values (v_book_id, v_cat ->> 'slug', v_cat ->> 'name', v_cat ->> 'description', v_cat_pos, p_upload);
    end if;
  end loop;

  for v_sec in select * from jsonb_array_elements(coalesce(p_payload -> 'sections', '[]'::jsonb)) loop
    insert into public.book_sections (book_id, position, title, blocks, upload_id)
    values (
      v_book_id, coalesce((v_sec ->> 'position')::integer, 0), v_sec ->> 'title',
      coalesce(v_sec -> 'blocks', '[]'::jsonb), p_upload
    );
  end loop;

  for v_rec in select * from jsonb_array_elements(coalesce(p_payload -> 'recipes', '[]'::jsonb)) loop
    v_cat_id := null;
    if v_rec ->> 'category_slug' is not null then
      select c.id into v_cat_id
      from public.recipe_categories c
      where c.book_id = v_book_id and c.slug = v_rec ->> 'category_slug';
    end if;

    -- Colliding recipe slugs get a deterministic -2, -3, ... suffix.
    v_base_slug := v_rec ->> 'slug';
    v_slug := v_base_slug;
    v_suffix := 1;
    while exists (select 1 from public.recipes r where r.book_id = v_book_id and r.slug = v_slug) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base_slug || '-' || v_suffix;
    end loop;

    insert into public.recipes (
      book_id, category_id, slug, title, position, yield_text, yield_servings,
      time_text, ingredients, steps, notes, extras, upload_id
    )
    values (
      v_book_id, v_cat_id, v_slug, v_rec ->> 'title',
      coalesce((v_rec ->> 'position')::integer, 0),
      v_rec ->> 'yield_text',
      coalesce((v_rec ->> 'yield_servings')::integer, 1),
      v_rec ->> 'time_text',
      coalesce(v_rec -> 'ingredients', '[]'::jsonb),
      coalesce(v_rec -> 'steps', '[]'::jsonb),
      coalesce(v_rec -> 'notes', '[]'::jsonb),
      coalesce(v_rec -> 'extras', '{}'::jsonb),
      p_upload
    );
  end loop;

  -- Final order follows upload order, then the in-PDF position (rows without provenance come first).
  update public.recipes r
  set position = o.rn
  from (
    select x.id, (row_number() over (order by u.created_at nulls first, x.position, x.id) - 1)::integer as rn
    from public.recipes x
    left join public.book_uploads u on u.id = x.upload_id
    where x.book_id = v_book_id
  ) o
  where r.id = o.id and r.position is distinct from o.rn;

  update public.book_sections s
  set position = o.rn
  from (
    select x.id, (row_number() over (order by u.created_at nulls first, x.position, x.id) - 1)::integer as rn
    from public.book_sections x
    left join public.book_uploads u on u.id = x.upload_id
    where x.book_id = v_book_id
  ) o
  where s.id = o.id and s.position is distinct from o.rn;

  -- Public-safe teaser of this PDF; the book teaser is the earliest active ready PDF's (legacy books untouched).
  v_teaser := coalesce(p_payload -> 'teaser', '{}'::jsonb);
  update public.book_uploads
  set status = 'ready', error = null, teaser = v_teaser
  where id = p_upload;

  if v_legacy is null then
    update public.books b
    set teaser = coalesce((
      select u.teaser
      from public.book_uploads u
      where u.book_id = v_book_id and u.removed_at is null and u.status = 'ready'
      order by u.created_at, u.id
      limit 1
    ), '{}'::jsonb)
    where b.id = v_book_id;
  end if;

  update public.ingestion_jobs set status = 'succeeded', locked_at = null, last_error = null
  where upload_id = p_upload;

  return v_book_id;
end;
$$;

-- Function privileges: service role only.
revoke execute on function public.claim_ingestion_job(interval) from public, anon, authenticated;
revoke execute on function public.create_book_from_ingestion(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_ingestion_job(interval) to service_role;
grant execute on function public.create_book_from_ingestion(uuid, uuid, jsonb) to service_role;
