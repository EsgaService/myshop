-- Multi-PDF products, part C: move one ready PDF (and only its content) to another product.
--
-- This migration contains DELETE statements inside the function body, so the Supabase MCP rejects it
-- ("Invalid or expired requestState"). Apply it through the Dashboard SQL editor or the Supabase CLI.
-- Requires 20261013090000_multi_pdf_products.sql (provenance columns, per-PDF teaser). It does not use
-- anything from 20261013090100_remove_upload_rpc.sql, but apply that one first to keep the order.
--
-- move_upload_to_book(p_seller, p_upload, p_target) returns { source_book_id, target_book_id, source_empty }:
--   * both products and then the upload are locked (products in id order, so two opposite moves cannot
--     deadlock; merges and removals lock product first, then upload, so they serialize with this);
--   * raises 'upload_not_owned' (upload, source or target not the seller's), 'invalid_target' (same product,
--     legacy or archived), 'upload_not_ready' (not ready, removed, or moved by someone else meanwhile) and
--     'last_ready_pdf' (it is the only active ready PDF of a published source);
--   * categories used by the PDF are reused by slug in the target or created after the last one;
--   * recipes are moved one by one, colliding slugs get a deterministic -2, -3, ... suffix;
--   * source categories left empty are pruned (including the ones the PDF created); positions are
--     renumbered in both products;
--   * teasers of both products are recomputed (legacy products are rejected, so never touched).
-- Purchases are never touched. The target title and description are untouched.

create or replace function public.move_upload_to_book(p_seller uuid, p_upload uuid, p_target uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_source        uuid;
  v_src_seller    uuid;
  v_src_status    public.book_status;
  v_src_legacy    uuid;
  v_tgt_seller    uuid;
  v_tgt_status    public.book_status;
  v_tgt_legacy    uuid;
  v_up_status     public.upload_status;
  v_up_removed    timestamptz;
  v_up_book       uuid;
  v_used_cats     uuid[];
  v_touched_cats  uuid[];
  v_cat           record;
  v_rec           record;
  v_tgt_cat       uuid;
  v_tgt_pos       integer;
  v_map           jsonb := '{}'::jsonb;
  v_slug          text;
  v_suffix        integer;
  v_book          uuid;
begin
  -- Ownership + source lookup (unlocked read, re-checked under lock below).
  select u.book_id into v_source
  from public.book_uploads u
  where u.id = p_upload and u.seller_id = p_seller;
  if not found then
    raise exception 'upload_not_owned' using errcode = 'P0001';
  end if;
  if v_source is null then
    raise exception 'upload_not_ready' using errcode = 'P0001';
  end if;
  if p_target is null or p_target = v_source then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;

  -- Lock order: both products by id (deterministic, deadlock-free), then the upload.
  perform 1
  from public.books b
  where b.id in (v_source, p_target)
  order by b.id
  for update;

  select b.seller_id, b.status, b.legacy_store_id into v_src_seller, v_src_status, v_src_legacy
  from public.books b where b.id = v_source;
  select b.seller_id, b.status, b.legacy_store_id into v_tgt_seller, v_tgt_status, v_tgt_legacy
  from public.books b where b.id = p_target;
  if v_src_seller is distinct from p_seller or v_tgt_seller is distinct from p_seller then
    raise exception 'upload_not_owned' using errcode = 'P0001';
  end if;
  if v_src_legacy is not null or v_tgt_legacy is not null or v_tgt_status = 'archived' then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;

  select u.status, u.removed_at, u.book_id into v_up_status, v_up_removed, v_up_book
  from public.book_uploads u
  where u.id = p_upload
  for update;
  -- Also covers a concurrent move or removal that committed between the unlocked read and the locks.
  if v_up_book is distinct from v_source or v_up_removed is not null or v_up_status <> 'ready' then
    raise exception 'upload_not_ready' using errcode = 'P0001';
  end if;

  -- A published product must keep at least one ready PDF.
  if v_src_status = 'published' and not exists (
    select 1
    from public.book_uploads o
    where o.book_id = v_source
      and o.id <> p_upload
      and o.removed_at is null
      and o.status = 'ready'
  ) then
    raise exception 'last_ready_pdf' using errcode = 'P0001';
  end if;

  -- Categories used by this PDF's recipes: they are mapped (reused or created) in the target.
  select coalesce(array_agg(distinct r.category_id) filter (where r.category_id is not null), '{}')
  into v_used_cats
  from public.recipes r
  where r.book_id = v_source and r.upload_id = p_upload;

  -- Source categories that may end up empty: the ones the recipes used plus the ones this PDF created.
  select coalesce(array_agg(c.id), '{}')
  into v_touched_cats
  from public.recipe_categories c
  where c.book_id = v_source and (c.id = any (v_used_cats) or c.upload_id = p_upload);

  for v_cat in
    select c.id, c.slug, c.name, c.description
    from public.recipe_categories c
    where c.id = any (v_used_cats)
    order by c.position, c.id
  loop
    v_tgt_cat := null;
    select c.id into v_tgt_cat
    from public.recipe_categories c
    where c.book_id = p_target and c.slug = v_cat.slug;

    if v_tgt_cat is null then
      select coalesce(max(c.position), 0) + 1 into v_tgt_pos
      from public.recipe_categories c
      where c.book_id = p_target;

      insert into public.recipe_categories (book_id, slug, name, description, position, upload_id)
      values (p_target, v_cat.slug, v_cat.name, v_cat.description, v_tgt_pos, p_upload)
      returning id into v_tgt_cat;
    end if;

    v_map := v_map || jsonb_build_object(v_cat.id::text, v_tgt_cat::text);
  end loop;

  -- Recipes move one by one so colliding slugs get a deterministic -2, -3, ... suffix in the target.
  for v_rec in
    select r.id, r.slug, r.category_id
    from public.recipes r
    where r.book_id = v_source and r.upload_id = p_upload
    order by r.position, r.id
  loop
    v_slug := v_rec.slug;
    v_suffix := 1;
    while exists (select 1 from public.recipes r where r.book_id = p_target and r.slug = v_slug) loop
      v_suffix := v_suffix + 1;
      v_slug := v_rec.slug || '-' || v_suffix;
    end loop;

    update public.recipes r
    set book_id = p_target,
        slug = v_slug,
        category_id = case
          when v_rec.category_id is null then null
          else (v_map ->> v_rec.category_id::text)::uuid
        end
    where r.id = v_rec.id;
  end loop;

  update public.book_sections s
  set book_id = p_target
  where s.book_id = v_source and s.upload_id = p_upload;

  -- Source categories that ended up empty are pruned (the ones other PDFs still use stay).
  delete from public.recipe_categories c
  where c.book_id = v_source
    and c.id = any (v_touched_cats)
    and not exists (select 1 from public.recipes r where r.category_id = c.id);

  update public.book_uploads set book_id = p_target where id = p_upload;

  -- Contiguous positions again in both products (recipes and sections from 0, categories from 1),
  -- and the book teaser = teaser of the earliest active ready PDF ('{}' if none).
  foreach v_book in array array[v_source, p_target] loop
    update public.recipes r
    set position = o.rn
    from (
      select x.id, (row_number() over (order by u.created_at nulls first, x.position, x.id) - 1)::integer as rn
      from public.recipes x
      left join public.book_uploads u on u.id = x.upload_id
      where x.book_id = v_book
    ) o
    where r.id = o.id and r.position is distinct from o.rn;

    update public.book_sections s
    set position = o.rn
    from (
      select x.id, (row_number() over (order by u.created_at nulls first, x.position, x.id) - 1)::integer as rn
      from public.book_sections x
      left join public.book_uploads u on u.id = x.upload_id
      where x.book_id = v_book
    ) o
    where s.id = o.id and s.position is distinct from o.rn;

    update public.recipe_categories c
    set position = o.rn
    from (
      select x.id, row_number() over (order by x.position, x.id)::integer as rn
      from public.recipe_categories x
      where x.book_id = v_book
    ) o
    where c.id = o.id and c.position is distinct from o.rn;

    update public.books b
    set teaser = coalesce((
      select u.teaser
      from public.book_uploads u
      where u.book_id = v_book and u.removed_at is null and u.status = 'ready'
      order by u.created_at, u.id
      limit 1
    ), '{}'::jsonb)
    where b.id = v_book and b.legacy_store_id is null;
  end loop;

  return jsonb_build_object(
    'source_book_id', v_source,
    'target_book_id', p_target,
    'source_empty', not exists (
      select 1 from public.book_uploads u where u.book_id = v_source and u.removed_at is null
    )
  );
end;
$$;

-- Function privileges: service role only.
revoke execute on function public.move_upload_to_book(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.move_upload_to_book(uuid, uuid, uuid) to service_role;
