-- Multi-PDF products: removal checks for Migration B (R2.1-R2.4).
-- Run AFTER 20261013090000_multi_pdf_products.sql AND 20261013090100_remove_upload_rpc.sql, as the postgres role
-- (Dashboard SQL editor). Self-contained: it builds its own fixtures and everything runs inside one
-- transaction that is rolled back, so nothing persists. Every assertion is scoped to the fixture rows
-- (no global counts). A clean run ends with the final NOTICE; any failure raises an exception.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: seller S, two products.
--   B1 (published): P1 (Cocteles: A, B + section), P2 (Cocteles: C, Postres: D), P3 failed, P4 queued.
--   B2 (draft):     Q1 creates "Cocteles" (E), Q2 reuses it (F) and creates "Postres" (G).
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000d1', 'multi-pdf-removal@example.test');
insert into public.profiles (id, role) values
  ('00000000-0000-4000-8000-0000000000d1', 'seller');
insert into public.sellers (id, user_id, slug, store_name) values
  ('00000000-0000-4000-8000-00000000dd01', '00000000-0000-4000-8000-0000000000d1', 'multi-pdf-removal', 'Multi PDF Removal');

insert into public.books (id, seller_id, slug, title, status) values
  ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000dd01', 'removal-b1', 'Removal B1', 'draft'),
  ('00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-00000000dd01', 'removal-b2', 'Removal B2', 'draft');

insert into public.book_uploads (id, seller_id, book_id, storage_path, original_name, size_bytes, status, created_at) values
  ('00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-00000000dd01', '00000000-0000-4000-8000-00000000d101', 'removal/p1.pdf', 'p1.pdf', 100, 'uploaded', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000dd01', '00000000-0000-4000-8000-00000000d101', 'removal/p2.pdf', 'p2.pdf', 100, 'uploaded', now() - interval '9 minutes'),
  ('00000000-0000-4000-8000-00000000e103', '00000000-0000-4000-8000-00000000dd01', '00000000-0000-4000-8000-00000000d101', 'removal/p3.pdf', 'p3.pdf', 100, 'failed',   now() - interval '8 minutes'),
  ('00000000-0000-4000-8000-00000000e104', '00000000-0000-4000-8000-00000000dd01', '00000000-0000-4000-8000-00000000d101', 'removal/p4.pdf', 'p4.pdf', 100, 'uploaded', now() - interval '7 minutes'),
  ('00000000-0000-4000-8000-00000000e201', '00000000-0000-4000-8000-00000000dd01', '00000000-0000-4000-8000-00000000d102', 'removal/q1.pdf', 'q1.pdf', 100, 'uploaded', now() - interval '6 minutes'),
  ('00000000-0000-4000-8000-00000000e202', '00000000-0000-4000-8000-00000000dd01', '00000000-0000-4000-8000-00000000d102', 'removal/q2.pdf', 'q2.pdf', 100, 'uploaded', now() - interval '5 minutes');
insert into public.ingestion_jobs (upload_id, status) values
  ('00000000-0000-4000-8000-00000000e101', 'processing'),
  ('00000000-0000-4000-8000-00000000e102', 'processing'),
  ('00000000-0000-4000-8000-00000000e104', 'queued'),
  ('00000000-0000-4000-8000-00000000e201', 'processing'),
  ('00000000-0000-4000-8000-00000000e202', 'processing');

do $$
declare
  v_s uuid := '00000000-0000-4000-8000-00000000dd01';
  v_b1 uuid := '00000000-0000-4000-8000-00000000d101';
  v_b2 uuid := '00000000-0000-4000-8000-00000000d102';
begin
  perform public.create_book_from_ingestion(v_s, '00000000-0000-4000-8000-00000000e101', jsonb_build_object(
    'slug', 'x', 'title', 'x',
    'teaser', jsonb_build_object('intro', jsonb_build_array('P1')),
    'categories', jsonb_build_array(jsonb_build_object('slug', 'cocteles', 'name', 'Cocteles', 'position', 1)),
    'sections', jsonb_build_array(jsonb_build_object('position', 1, 'title', 'Intro P1', 'blocks', jsonb_build_array())),
    'recipes', jsonb_build_array(
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'a', 'title', 'A', 'position', 1),
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'b', 'title', 'B', 'position', 2))));
  perform public.create_book_from_ingestion(v_s, '00000000-0000-4000-8000-00000000e102', jsonb_build_object(
    'slug', 'x', 'title', 'x',
    'teaser', jsonb_build_object('intro', jsonb_build_array('P2')),
    'categories', jsonb_build_array(
      jsonb_build_object('slug', 'cocteles', 'name', 'Cocteles', 'position', 1),
      jsonb_build_object('slug', 'postres', 'name', 'Postres', 'position', 2)),
    'sections', jsonb_build_array(jsonb_build_object('position', 1, 'title', 'Intro P2', 'blocks', jsonb_build_array())),
    'recipes', jsonb_build_array(
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'c', 'title', 'C', 'position', 1),
      jsonb_build_object('category_slug', 'postres', 'slug', 'd', 'title', 'D', 'position', 2))));

  perform public.create_book_from_ingestion(v_s, '00000000-0000-4000-8000-00000000e201', jsonb_build_object(
    'slug', 'x', 'title', 'x',
    'teaser', jsonb_build_object('intro', jsonb_build_array('Q1')),
    'categories', jsonb_build_array(jsonb_build_object('slug', 'cocteles', 'name', 'Cocteles', 'position', 1)),
    'recipes', jsonb_build_array(jsonb_build_object('category_slug', 'cocteles', 'slug', 'e', 'title', 'E', 'position', 1))));
  perform public.create_book_from_ingestion(v_s, '00000000-0000-4000-8000-00000000e202', jsonb_build_object(
    'slug', 'x', 'title', 'x',
    'teaser', jsonb_build_object('intro', jsonb_build_array('Q2')),
    'categories', jsonb_build_array(
      jsonb_build_object('slug', 'cocteles', 'name', 'Cocteles', 'position', 1),
      jsonb_build_object('slug', 'postres', 'name', 'Postres', 'position', 2)),
    'recipes', jsonb_build_array(
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'f', 'title', 'F', 'position', 1),
      jsonb_build_object('category_slug', 'postres', 'slug', 'g', 'title', 'G', 'position', 2))));

  update public.books set status = 'published', published_at = now() where id = v_b1;

  assert (select count(*) from public.recipes where book_id = v_b1) = 4, 'FIXTURE FAILED: B1 recipes';
  assert (select count(*) from public.recipes where book_id = v_b2) = 3, 'FIXTURE FAILED: B2 recipes';
end;
$$;

-- ---------------------------------------------------------------------------
-- Removal of P2 from the published B1 (P1 stays ready): only P2's content disappears.
-- ---------------------------------------------------------------------------
do $$
declare
  v_s uuid := '00000000-0000-4000-8000-00000000dd01';
  v_b1 uuid := '00000000-0000-4000-8000-00000000d101';
  v_p1 uuid := '00000000-0000-4000-8000-00000000e101';
  v_p2 uuid := '00000000-0000-4000-8000-00000000e102';
  v_res jsonb;
  v_titles text;
  v_positions text;
begin
  v_res := public.remove_upload_from_book(v_s, v_p2);
  assert (v_res ->> 'removed')::boolean, 'CHECK FAILED: removal must report removed = true';
  assert (v_res ->> 'storage_path') = 'removal/p2.pdf', 'CHECK FAILED: storage_path not returned';
  assert (v_res ->> 'book_id')::uuid = v_b1, 'CHECK FAILED: book_id not returned';

  -- Only P1's recipes remain, intact and contiguous.
  select string_agg(title, ',' order by position), string_agg(position::text, ',' order by position)
    into v_titles, v_positions
  from public.recipes where book_id = v_b1;
  assert v_titles = 'A,B', 'CHECK FAILED: remaining recipes were ' || coalesce(v_titles, 'none');
  assert v_positions = '0,1', 'CHECK FAILED: recipe positions not contiguous: ' || v_positions;
  assert not exists (select 1 from public.recipes where book_id = v_b1 and upload_id = v_p2),
    'CHECK FAILED: P2 recipes still present';
  assert (select count(*) from public.recipes where book_id = v_b1 and upload_id = v_p1) = 2,
    'CHECK FAILED: P1 recipes changed';

  -- Sections follow the same rule.
  assert (select string_agg(title || ':' || position, ',') from public.book_sections where book_id = v_b1) = 'Intro P1:0',
    'CHECK FAILED: sections after removal';

  -- "postres" only had P2 recipes: pruned. "cocteles" still holds P1 recipes: kept (created by P1).
  assert not exists (select 1 from public.recipe_categories where book_id = v_b1 and slug = 'postres'),
    'CHECK FAILED: empty category was not pruned';
  assert (select count(*) from public.recipe_categories where book_id = v_b1 and slug = 'cocteles') = 1,
    'CHECK FAILED: shared category was removed';
  assert (select count(*) from public.recipes r join public.recipe_categories c on c.id = r.category_id
          where r.book_id = v_b1 and c.slug = 'cocteles') = 2,
    'CHECK FAILED: P1 recipes lost their category';

  -- Soft removal and teaser.
  assert (select removed_at from public.book_uploads where id = v_p2) is not null, 'CHECK FAILED: removed_at not set';
  assert (select teaser #>> '{intro,0}' from public.books where id = v_b1) = 'P1', 'CHECK FAILED: teaser not recomputed';

  -- Idempotent: a second call changes nothing and reports removed = false.
  v_res := public.remove_upload_from_book(v_s, v_p2);
  assert not (v_res ->> 'removed')::boolean, 'CHECK FAILED: second removal must report removed = false';
  assert (select count(*) from public.recipes where book_id = v_b1) = 2, 'CHECK FAILED: second removal changed recipes';
end;
$$;

-- ---------------------------------------------------------------------------
-- Last ready PDF of a published product is protected; failed/queued PDFs do not count as ready.
-- ---------------------------------------------------------------------------
do $$
declare
  v_s uuid := '00000000-0000-4000-8000-00000000dd01';
  v_b1 uuid := '00000000-0000-4000-8000-00000000d101';
  v_p1 uuid := '00000000-0000-4000-8000-00000000e101';
  v_ok boolean := false;
begin
  -- B1 is published; P1 is the only ready PDF (P3 failed, P4 queued).
  begin
    perform public.remove_upload_from_book(v_s, v_p1);
  exception when others then
    if sqlerrm <> 'last_ready_pdf' then raise; end if;
    v_ok := true;
  end;
  assert v_ok, 'CHECK FAILED: last ready PDF of a published product was removed';
  assert (select removed_at from public.book_uploads where id = v_p1) is null, 'CHECK FAILED: guard left P1 removed';
  assert (select count(*) from public.recipes where book_id = v_b1) = 2, 'CHECK FAILED: guard changed recipes';
  assert (select teaser #>> '{intro,0}' from public.books where id = v_b1) = 'P1', 'CHECK FAILED: guard changed teaser';
end;
$$;

-- ---------------------------------------------------------------------------
-- Queued upload: removal fails its job so it never runs. Failed upload: removable, no content to prune.
-- ---------------------------------------------------------------------------
do $$
declare
  v_s uuid := '00000000-0000-4000-8000-00000000dd01';
  v_b1 uuid := '00000000-0000-4000-8000-00000000d101';
  v_p3 uuid := '00000000-0000-4000-8000-00000000e103';
  v_p4 uuid := '00000000-0000-4000-8000-00000000e104';
begin
  perform public.remove_upload_from_book(v_s, v_p4);
  assert (select status from public.ingestion_jobs where upload_id = v_p4) = 'failed', 'CHECK FAILED: queued job still runnable';
  assert (select last_error from public.ingestion_jobs where upload_id = v_p4) = 'removed', 'CHECK FAILED: queued job reason';
  assert (select removed_at from public.book_uploads where id = v_p4) is not null, 'CHECK FAILED: P4 not removed';

  perform public.remove_upload_from_book(v_s, v_p3);
  assert (select removed_at from public.book_uploads where id = v_p3) is not null, 'CHECK FAILED: failed upload not removed';
  assert (select count(*) from public.recipes where book_id = v_b1) = 2, 'CHECK FAILED: removing a failed PDF touched recipes';

  -- A late-finishing job of a removed upload is discarded by the merge (no content, job closed).
  perform public.create_book_from_ingestion(v_s, v_p4, jsonb_build_object(
    'slug', 'x', 'title', 'x',
    'recipes', jsonb_build_array(jsonb_build_object('slug', 'ghost', 'title', 'Ghost', 'position', 1))));
  assert not exists (select 1 from public.recipes where book_id = v_b1 and slug = 'ghost'),
    'CHECK FAILED: removed upload merged content';
end;
$$;

-- ---------------------------------------------------------------------------
-- Category created by the removed PDF but still used by another PDF is kept; positions renumbered;
-- a draft product may lose its last ready PDF (teaser back to '{}').
-- ---------------------------------------------------------------------------
do $$
declare
  v_s uuid := '00000000-0000-4000-8000-00000000dd01';
  v_b2 uuid := '00000000-0000-4000-8000-00000000d102';
  v_q1 uuid := '00000000-0000-4000-8000-00000000e201';
  v_q2 uuid := '00000000-0000-4000-8000-00000000e202';
begin
  -- Q1 created "cocteles" and Q2 created "postres"; Q2 recipes also live in "cocteles" (F).
  perform public.remove_upload_from_book(v_s, v_q1);
  assert (select count(*) from public.recipe_categories where book_id = v_b2 and slug = 'cocteles') = 1,
    'CHECK FAILED: category created by the removed PDF but used by another was pruned';
  assert (select string_agg(title, ',' order by position) from public.recipes where book_id = v_b2) = 'F,G',
    'CHECK FAILED: Q2 recipes after removing Q1';
  assert (select string_agg(slug || ':' || position, ',' order by position) from public.recipe_categories where book_id = v_b2)
    = 'cocteles:1,postres:2', 'CHECK FAILED: category positions not contiguous';
  assert (select teaser #>> '{intro,0}' from public.books where id = v_b2) = 'Q2', 'CHECK FAILED: teaser should move to Q2';

  -- Draft product: its last ready PDF can be removed.
  perform public.remove_upload_from_book(v_s, v_q2);
  assert not exists (select 1 from public.recipes where book_id = v_b2), 'CHECK FAILED: draft recipes remain';
  assert not exists (select 1 from public.recipe_categories where book_id = v_b2), 'CHECK FAILED: draft categories remain';
  assert (select teaser from public.books where id = v_b2) = '{}'::jsonb, 'CHECK FAILED: teaser should be empty';
end;
$$;

-- ---------------------------------------------------------------------------
-- Ownership and privileges
-- ---------------------------------------------------------------------------
do $$
declare
  v_ok boolean := false;
begin
  begin
    perform public.remove_upload_from_book('00000000-0000-4000-8000-00000000dd99', '00000000-0000-4000-8000-00000000e101');
  exception when others then
    if sqlerrm <> 'upload_not_owned' then raise; end if;
    v_ok := true;
  end;
  assert v_ok, 'CHECK FAILED: foreign seller was accepted';

  assert not has_function_privilege('anon', 'public.remove_upload_from_book(uuid,uuid)', 'execute'),
    'CHECK FAILED: anon can execute remove_upload_from_book';
  assert not has_function_privilege('authenticated', 'public.remove_upload_from_book(uuid,uuid)', 'execute'),
    'CHECK FAILED: authenticated can execute remove_upload_from_book';
  assert has_function_privilege('service_role', 'public.remove_upload_from_book(uuid,uuid)', 'execute'),
    'CHECK FAILED: service_role cannot execute remove_upload_from_book';
end;
$$;

do $$ begin raise notice 'multi_pdf_removal_checks: all checks passed'; end $$;

rollback;
