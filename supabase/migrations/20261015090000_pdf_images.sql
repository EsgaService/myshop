-- PDF images (additive: ADD COLUMN, CREATE TABLE/INDEX/FUNCTION, UPDATE, bucket upsert only).
-- No DELETE and no DROP POLICY, so it can be applied through the Supabase MCP.
--
--   * Each READY upload gets best-effort, AI-free image extraction tracked on `book_uploads.images_*`
--     (null status = pending). The sweep claims uploads with `claim_image_extraction()` (SKIP LOCKED).
--   * `book_images` holds the candidate images (kind 'pdf', keyed by upload + ordinal) and the seller's
--     own uploads (kind 'custom', counted for the per-seller quota).
--   * Seller choices are protected by `recipes.photo_source` and `books.cover_source`
--     ('auto' | 'pdf' | 'custom' | 'none'). Re-extraction only touches 'auto' rows:
--       auto + photo_path null = unmatched, none = the seller removed it on purpose.
--   * Legacy rows that already have a photo or cover are marked 'custom' so extraction never overwrites them.
--   * Private bucket `seller-image-uploads` is the temp area for validated custom uploads (signed URLs only).

-- ---------------------------------------------------------------------------
-- Per-upload extraction state
-- ---------------------------------------------------------------------------
alter table public.book_uploads
  add column if not exists images_status text check (images_status in ('processing', 'done', 'failed')),
  add column if not exists images_attempts smallint not null default 0,
  add column if not exists images_at timestamptz,
  add column if not exists images_error text,
  add column if not exists images_review_pending boolean not null default false;

-- Work queue for the sweep: ready, active uploads whose images are not done yet.
create index if not exists book_uploads_images_pending_idx
  on public.book_uploads (created_at)
  where status = 'ready' and removed_at is null and images_status is distinct from 'done';

-- ---------------------------------------------------------------------------
-- Seller-choice protection
-- ---------------------------------------------------------------------------
alter table public.recipes
  add column if not exists photo_source text not null default 'auto'
    check (photo_source in ('auto', 'pdf', 'custom', 'none')),
  add column if not exists source_page smallint;

alter table public.books
  add column if not exists cover_source text not null default 'auto'
    check (cover_source in ('auto', 'pdf', 'custom', 'none'));

-- Legacy photos/covers were set by hand or by seeds: protect them from extraction.
update public.recipes set photo_source = 'custom' where photo_path is not null and photo_source = 'auto';
update public.books set cover_source = 'custom' where cover_url is not null and cover_source = 'auto';

-- ---------------------------------------------------------------------------
-- Candidate and custom images
-- ---------------------------------------------------------------------------
create table public.book_images (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.sellers (id) on delete cascade,
  kind         text not null check (kind in ('pdf', 'custom')),
  upload_id    uuid references public.book_uploads (id) on delete cascade,
  book_id      uuid references public.books (id) on delete cascade,
  recipe_id    uuid references public.recipes (id) on delete cascade,
  ordinal      integer,
  page         smallint,
  width        integer not null check (width > 0),
  height       integer not null check (height > 0),
  area_ratio   real,
  image_key    text,
  storage_path text not null unique,
  thumb_path   text not null,
  created_at   timestamptz not null default now(),
  constraint book_images_pdf_shape check (
    kind <> 'pdf' or (upload_id is not null and ordinal is not null and page is not null)
  ),
  constraint book_images_custom_target check (
    kind <> 'custom' or (book_id is not null or recipe_id is not null)
  ),
  constraint book_images_upload_ordinal_key unique (upload_id, ordinal)
);

-- FK and lookup indexes.
create index book_images_upload_page_idx on public.book_images (upload_id, page);
create index book_images_seller_custom_idx on public.book_images (seller_id) where kind = 'custom';
create index book_images_book_idx on public.book_images (book_id) where book_id is not null;
create index book_images_recipe_idx on public.book_images (recipe_id) where recipe_id is not null;

-- RLS: read-only for the owning seller. All writes use the service role.
alter table public.book_images enable row level security;
revoke all on public.book_images from anon, authenticated;
grant select on public.book_images to authenticated;

create policy "book images are readable by their seller"
  on public.book_images for select
  to authenticated
  using (seller_id = (select private.my_seller_id()));

-- ---------------------------------------------------------------------------
-- Claim one upload for image extraction (mirrors claim_ingestion_job).
-- ---------------------------------------------------------------------------
create function public.claim_image_extraction(p_stale interval default interval '10 minutes')
returns setof public.book_uploads
language plpgsql
set search_path = ''
as $$
begin
  -- A run that died after exhausting its attempts is failed for good.
  update public.book_uploads u
  set images_status = 'failed',
      images_error = coalesce(u.images_error, 'extraction timed out')
  where u.status = 'ready'
    and u.removed_at is null
    and u.images_status = 'processing'
    and u.images_at < now() - p_stale
    and u.images_attempts >= 3;

  return query
  update public.book_uploads u
  set images_status = 'processing',
      images_attempts = u.images_attempts + 1,
      images_at = now()
  where u.id = (
    select c.id
    from public.book_uploads c
    where c.status = 'ready'
      and c.removed_at is null
      and (
        c.images_status is null
        or (c.images_status = 'processing' and c.images_at < now() - p_stale and c.images_attempts < 3)
      )
    order by c.created_at
    for update skip locked
    limit 1
  )
  returning u.*;
end;
$$;

revoke execute on function public.claim_image_extraction(interval) from public, anon, authenticated;
grant execute on function public.claim_image_extraction(interval) to service_role;

-- ---------------------------------------------------------------------------
-- Temp bucket for custom image uploads: private, 5 MB, no storage.objects client policies
-- (uploads go through signed upload URLs; the confirm action validates and re-encodes).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seller-image-uploads', 'seller-image-uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
