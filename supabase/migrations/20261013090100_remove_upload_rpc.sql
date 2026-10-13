-- Multi-PDF products, part B: remove one PDF (and only its content) from a product.
--
-- This migration contains DELETE statements inside the function body, so the Supabase MCP rejects it
-- ("Invalid or expired requestState"). Apply it through the Dashboard SQL editor or the Supabase CLI.
-- Requires 20261013090000_multi_pdf_products.sql (provenance columns, per-PDF teaser).
--
-- remove_upload_from_book(p_seller, p_upload) returns { book_id, storage_path, removed }:
--   * locks the product, then the upload (same order as create_book_from_ingestion, so merges and
--     removals into one product are serialized);
--   * idempotent: an already removed upload returns removed = false and changes nothing;
--   * raises 'last_ready_pdf' when the product is published and this is its only active ready PDF;
--   * deletes only the recipes and sections whose upload_id is this upload, prunes the categories that
--     ended up empty, renumbers positions and recomputes the book teaser (legacy books are untouched);
--   * soft-removes the upload (removed_at) and fails its job when it is still queued.
-- The caller deletes the storage object after the commit (storage_path is returned for that).

create or replace function public.remove_upload_from_book(p_seller uuid, p_upload uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_book_id     uuid;
  v_path        text;
  v_book_seller uuid;
  v_book_status public.book_status;
  v_legacy      uuid;
  v_up_status   public.upload_status;
  v_up_removed  timestamptz;
  v_cats        uuid[];
begin
  -- Ownership + product lookup (unlocked read, re-checked under lock below).
  select u.book_id, u.storage_path into v_book_id, v_path
  from public.book_uploads u
  where u.id = p_upload and u.seller_id = p_seller;
  if not found then
    raise exception 'upload_not_owned' using errcode = 'P0001';
  end if;

  -- An upload without a product (created before products existed) has no content to prune.
  if v_book_id is null then
    update public.book_uploads
    set removed_at = coalesce(removed_at, now())
    where id = p_upload and removed_at is null;
    update public.ingestion_jobs
    set status = 'failed', last_error = 'removed', locked_at = null
    where upload_id = p_upload and status = 'queued';
    return jsonb_build_object('book_id', null, 'storage_path', v_path, 'removed', true);
  end if;

  -- Lock order: product first, then the upload.
  select b.seller_id, b.status, b.legacy_store_id into v_book_seller, v_book_status, v_legacy
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

  -- Already removed: nothing to do.
  if v_up_removed is not null then
    return jsonb_build_object('book_id', v_book_id, 'storage_path', v_path, 'removed', false);
  end if;

  -- A published product must keep at least one ready PDF.
  if v_book_status = 'published' and v_up_status = 'ready' and not exists (
    select 1
    from public.book_uploads o
    where o.book_id = v_book_id
      and o.id <> p_upload
      and o.removed_at is null
      and o.status = 'ready'
  ) then
    raise exception 'last_ready_pdf' using errcode = 'P0001';
  end if;

  -- Categories touched by this PDF: the ones it created and the ones its recipes used.
  select coalesce(array_agg(distinct r.category_id) filter (where r.category_id is not null), '{}')
  into v_cats
  from public.recipes r
  where r.book_id = v_book_id and r.upload_id = p_upload;

  delete from public.recipes r where r.book_id = v_book_id and r.upload_id = p_upload;
  delete from public.book_sections s where s.book_id = v_book_id and s.upload_id = p_upload;

  delete from public.recipe_categories c
  where c.book_id = v_book_id
    and (c.upload_id = p_upload or c.id = any (v_cats))
    and not exists (select 1 from public.recipes r where r.category_id = c.id);

  -- Contiguous positions again (recipes and sections from 0, categories from 1, as the merge creates them).
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

  update public.recipe_categories c
  set position = o.rn
  from (
    select x.id, row_number() over (order by x.position, x.id)::integer as rn
    from public.recipe_categories x
    where x.book_id = v_book_id
  ) o
  where c.id = o.id and c.position is distinct from o.rn;

  update public.book_uploads set removed_at = now() where id = p_upload;

  -- A queued job must never run for a removed upload. A running job is closed by the merge itself,
  -- which discards the result of a removed upload.
  update public.ingestion_jobs
  set status = 'failed', last_error = 'removed', locked_at = null
  where upload_id = p_upload and status = 'queued';

  -- Book teaser = teaser of the earliest remaining active ready PDF ('{}' if none). Legacy books keep theirs.
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

  return jsonb_build_object('book_id', v_book_id, 'storage_path', v_path, 'removed', true);
end;
$$;

-- Function privileges: service role only.
revoke execute on function public.remove_upload_from_book(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_upload_from_book(uuid, uuid) to service_role;
