-- Multi-PDF products: merge checks for Migration A (R1.5, R1.6, R2.3, R6.2).
-- Run AFTER 20261013090000_multi_pdf_products.sql, as the postgres role (SQL editor / MCP execute_sql).
-- Everything happens inside one transaction that is rolled back, so nothing persists.
-- Each check raises an exception on failure; a clean run ends with the final NOTICE.
-- Removal checks live in a later section (Migration B).

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: one seller, one product shell "Mi libro", three uploads created in order P1 < P2 < P3
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'multi-pdf-seller@example.test');
insert into public.profiles (id, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'seller');
insert into public.sellers (id, user_id, slug, store_name) values
  ('00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-0000000000a1', 'multi-pdf-check', 'Multi PDF Check');

insert into public.books (id, seller_id, slug, title, description, status) values
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000aa01', 'mi-libro', 'Mi libro', null, 'draft');

insert into public.book_uploads (id, seller_id, book_id, storage_path, original_name, size_bytes, status, created_at) values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-00000000b001', 'check/p1.pdf', 'p1.pdf', 100, 'uploaded', now() - interval '3 minutes'),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-00000000b001', 'check/p2.pdf', 'p2.pdf', 100, 'uploaded', now() - interval '2 minutes'),
  ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-00000000b001', 'check/p3.pdf', 'p3.pdf', 100, 'uploaded', now() - interval '1 minute');
insert into public.ingestion_jobs (upload_id, status) values
  ('00000000-0000-4000-8000-00000000c001', 'processing'),
  ('00000000-0000-4000-8000-00000000c002', 'processing'),
  ('00000000-0000-4000-8000-00000000c003', 'processing');

-- ---------------------------------------------------------------------------
-- Merge P2 first, then P1 (completion order differs from upload order), then P3.
-- ---------------------------------------------------------------------------
do $$
declare
  v_book uuid := '00000000-0000-4000-8000-00000000b001';
  v_seller uuid := '00000000-0000-4000-8000-00000000aa01';
  v_p1 uuid := '00000000-0000-4000-8000-00000000c001';
  v_p2 uuid := '00000000-0000-4000-8000-00000000c002';
  v_p3 uuid := '00000000-0000-4000-8000-00000000c003';
  v_ret uuid;
  v_titles text;
  v_positions text;
  v_count integer;
begin
  -- P2: category "Cocteles", recipe slug "mojito", teaser of P2.
  v_ret := public.create_book_from_ingestion(v_seller, v_p2, jsonb_build_object(
    'slug', 'ai-slug-2', 'title', 'AI title 2', 'tagline', 'Tagline from P2', 'description', 'Description from P2',
    'teaser', jsonb_build_object('intro', jsonb_build_array('P2'), 'sample', jsonb_build_object('title', 'Mojito P2', 'ingredients', jsonb_build_array())),
    'categories', jsonb_build_array(jsonb_build_object('slug', 'cocteles', 'name', 'Cocteles', 'position', 1)),
    'sections', jsonb_build_array(jsonb_build_object('position', 1, 'title', 'Intro P2', 'blocks', jsonb_build_array())),
    'recipes', jsonb_build_array(
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'mojito', 'title', 'Mojito P2-A', 'position', 1, 'yield_servings', 1),
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'daiquiri', 'title', 'Daiquiri P2-B', 'position', 2, 'yield_servings', 1)
    )
  ));
  assert v_ret = v_book, 'CHECK FAILED: merge must return the product id';

  -- Title is the seller one; empty description/tagline filled by AI.
  assert (select title from public.books where id = v_book) = 'Mi libro',
    'CHECK FAILED: seller title was overwritten';
  assert (select description from public.books where id = v_book) = 'Description from P2',
    'CHECK FAILED: empty description was not filled by AI';

  -- P1: category with the same slug (reuse), recipe slug "mojito" collides, different tagline/description.
  perform public.create_book_from_ingestion(v_seller, v_p1, jsonb_build_object(
    'slug', 'ai-slug-1', 'title', 'AI title 1', 'tagline', 'Tagline from P1', 'description', 'Description from P1',
    'teaser', jsonb_build_object('intro', jsonb_build_array('P1'), 'sample', jsonb_build_object('title', 'Mojito P1', 'ingredients', jsonb_build_array())),
    'categories', jsonb_build_array(jsonb_build_object('slug', 'cocteles', 'name', 'Cocteles (P1)', 'position', 1)),
    'sections', jsonb_build_array(jsonb_build_object('position', 1, 'title', 'Intro P1', 'blocks', jsonb_build_array())),
    'recipes', jsonb_build_array(
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'mojito', 'title', 'Mojito P1-A', 'position', 1, 'yield_servings', 1),
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'mojito', 'title', 'Mojito P1-B', 'position', 2, 'yield_servings', 1)
    )
  ));

  -- P3: new category.
  perform public.create_book_from_ingestion(v_seller, v_p3, jsonb_build_object(
    'slug', 'ai-slug-3', 'title', 'AI title 3',
    'teaser', jsonb_build_object('intro', jsonb_build_array('P3')),
    'categories', jsonb_build_array(jsonb_build_object('slug', 'postres', 'name', 'Postres', 'position', 1)),
    'sections', '[]'::jsonb,
    'recipes', jsonb_build_array(
      jsonb_build_object('category_slug', 'postres', 'slug', 'flan', 'title', 'Flan P3-A', 'position', 1, 'yield_servings', 1)
    )
  ));

  -- Recipe order follows upload order (P1, P2, P3), then in-PDF position; contiguous from 0.
  select string_agg(title, ' | ' order by position), string_agg(position::text, ',' order by position)
    into v_titles, v_positions
  from public.recipes where book_id = v_book;
  assert v_titles = 'Mojito P1-A | Mojito P1-B | Mojito P2-A | Daiquiri P2-B | Flan P3-A',
    'CHECK FAILED: recipe order was ' || v_titles;
  assert v_positions = '0,1,2,3,4', 'CHECK FAILED: recipe positions not contiguous: ' || v_positions;

  -- Sections: same rule.
  select string_agg(title, ' | ' order by position) into v_titles from public.book_sections where book_id = v_book;
  assert v_titles = 'Intro P1 | Intro P2', 'CHECK FAILED: section order was ' || v_titles;

  -- Category reuse by slug: "cocteles" exists once and keeps its original name; "postres" added.
  select count(*) into v_count from public.recipe_categories where book_id = v_book and slug = 'cocteles';
  assert v_count = 1, 'CHECK FAILED: category slug was duplicated';
  assert (select count(*) from public.recipe_categories where book_id = v_book) = 2,
    'CHECK FAILED: expected exactly 2 categories';
  assert (select name from public.recipe_categories where book_id = v_book and slug = 'cocteles') = 'Cocteles',
    'CHECK FAILED: reused category was renamed';
  assert (select count(*) from public.recipes r join public.recipe_categories c on c.id = r.category_id
          where r.book_id = v_book and c.slug = 'cocteles') = 4,
    'CHECK FAILED: cocteles must hold the recipes of both PDFs';

  -- Colliding recipe slugs: unique with deterministic suffixes, titles unchanged.
  assert (select string_agg(slug, ',' order by slug) from public.recipes where book_id = v_book and title like 'Mojito%')
    = 'mojito,mojito-2,mojito-3', 'CHECK FAILED: slug suffixes wrong';
  assert (select count(distinct slug) from public.recipes where book_id = v_book) = 5,
    'CHECK FAILED: recipe slugs not unique';

  -- Provenance recorded.
  assert (select count(*) from public.recipes where book_id = v_book and upload_id = v_p1) = 2
     and (select count(*) from public.recipes where book_id = v_book and upload_id = v_p2) = 2
     and (select count(*) from public.recipes where book_id = v_book and upload_id = v_p3) = 1,
    'CHECK FAILED: recipe provenance wrong';
  assert (select upload_id from public.recipe_categories where book_id = v_book and slug = 'cocteles') = v_p2,
    'CHECK FAILED: category must record its creator upload (P2 finished first)';

  -- Seller title kept; description kept (non-empty); tagline filled once by the first merge (P2).
  assert (select title from public.books where id = v_book) = 'Mi libro', 'CHECK FAILED: title changed after merges';
  assert (select description from public.books where id = v_book) = 'Description from P2',
    'CHECK FAILED: non-empty description was overwritten';
  assert (select tagline from public.books where id = v_book) = 'Tagline from P2',
    'CHECK FAILED: non-empty tagline was overwritten';

  -- All uploads ready, jobs succeeded.
  assert (select count(*) from public.book_uploads where book_id = v_book and status = 'ready') = 3,
    'CHECK FAILED: uploads not marked ready';
  assert (select count(*) from public.ingestion_jobs where status = 'succeeded' and upload_id in (v_p1, v_p2, v_p3)) = 3,
    'CHECK FAILED: jobs not marked succeeded';

  -- Teaser = teaser of the earliest active ready upload (P1), even though P2 finished first.
  assert (select teaser #>> '{intro,0}' from public.books where id = v_book) = 'P1',
    'CHECK FAILED: book teaser must come from the earliest ready PDF';
end;
$$;

-- ---------------------------------------------------------------------------
-- Idempotent re-run: invoking again changes nothing.
-- ---------------------------------------------------------------------------
do $$
declare
  v_book uuid := '00000000-0000-4000-8000-00000000b001';
  v_seller uuid := '00000000-0000-4000-8000-00000000aa01';
  v_before text;
  v_after text;
begin
  select md5(string_agg(id::text || position::text || slug, ',' order by id)) into v_before from public.recipes where book_id = v_book;
  perform public.create_book_from_ingestion(v_seller, '00000000-0000-4000-8000-00000000c001', jsonb_build_object(
    'slug', 'x', 'title', 'x',
    'categories', jsonb_build_array(jsonb_build_object('slug', 'extra', 'name', 'Extra', 'position', 1)),
    'recipes', jsonb_build_array(jsonb_build_object('category_slug', 'extra', 'slug', 'extra-r', 'title', 'Extra', 'position', 1))
  ));
  select md5(string_agg(id::text || position::text || slug, ',' order by id)) into v_after from public.recipes where book_id = v_book;
  assert v_before = v_after, 'CHECK FAILED: re-run changed recipes';
  assert (select count(*) from public.recipes where book_id = v_book) = 5, 'CHECK FAILED: re-run added recipes';
  assert (select count(*) from public.recipe_categories where book_id = v_book) = 2, 'CHECK FAILED: re-run added categories';
end;
$$;

-- ---------------------------------------------------------------------------
-- Removed upload: a late-finishing job is a no-op and the job is closed.
-- ---------------------------------------------------------------------------
do $$
declare
  v_book uuid := '00000000-0000-4000-8000-00000000b001';
  v_seller uuid := '00000000-0000-4000-8000-00000000aa01';
  v_up uuid := '00000000-0000-4000-8000-00000000c004';
  v_ret uuid;
begin
  insert into public.book_uploads (id, seller_id, book_id, storage_path, original_name, size_bytes, status, removed_at)
  values (v_up, v_seller, v_book, 'check/p4.pdf', 'p4.pdf', 100, 'processing', now());
  insert into public.ingestion_jobs (upload_id, status) values (v_up, 'processing');

  v_ret := public.create_book_from_ingestion(v_seller, v_up, jsonb_build_object(
    'slug', 'x', 'title', 'x',
    'recipes', jsonb_build_array(jsonb_build_object('slug', 'ghost', 'title', 'Ghost', 'position', 1))
  ));
  assert v_ret = v_book, 'CHECK FAILED: removed no-op must return the product id';
  assert not exists (select 1 from public.recipes where book_id = v_book and upload_id = v_up),
    'CHECK FAILED: removed upload merged content';
  assert (select status from public.book_uploads where id = v_up) = 'processing',
    'CHECK FAILED: removed upload status changed';
  assert (select status from public.ingestion_jobs where upload_id = v_up) = 'succeeded',
    'CHECK FAILED: removed upload job was not closed';
end;
$$;

-- ---------------------------------------------------------------------------
-- Ownership and null-book fallback
-- ---------------------------------------------------------------------------
do $$
declare
  v_seller uuid := '00000000-0000-4000-8000-00000000aa01';
  v_up uuid := '00000000-0000-4000-8000-00000000c005';
  v_book uuid;
begin
  begin
    perform public.create_book_from_ingestion('00000000-0000-4000-8000-00000000aa99', '00000000-0000-4000-8000-00000000c001', '{}'::jsonb);
    raise exception 'CHECK FAILED: foreign seller was accepted';
  exception when others then
    if sqlerrm <> 'upload_not_owned' then raise; end if;
  end;

  -- Legacy in-flight upload without a product: a new product is created from the payload.
  insert into public.book_uploads (id, seller_id, book_id, storage_path, original_name, size_bytes, status)
  values (v_up, v_seller, null, 'check/p5.pdf', 'p5.pdf', 100, 'processing');
  insert into public.ingestion_jobs (upload_id, status) values (v_up, 'processing');

  v_book := public.create_book_from_ingestion(v_seller, v_up, jsonb_build_object(
    'slug', 'mi-libro', 'title', 'Legacy flow title',
    'teaser', jsonb_build_object('intro', jsonb_build_array('P5')),
    'recipes', jsonb_build_array(jsonb_build_object('slug', 'r', 'title', 'R', 'position', 1))
  ));
  assert v_book <> '00000000-0000-4000-8000-00000000b001', 'CHECK FAILED: fallback must create a new product';
  assert (select slug from public.books where id = v_book) = 'mi-libro-2', 'CHECK FAILED: fallback slug suffix';
  assert (select title from public.books where id = v_book) = 'Legacy flow title', 'CHECK FAILED: fallback title';
  assert (select book_id from public.book_uploads where id = v_up) = v_book, 'CHECK FAILED: fallback did not bind upload';
  assert (select status from public.book_uploads where id = v_up) = 'ready', 'CHECK FAILED: fallback upload not ready';
  assert (select teaser #>> '{intro,0}' from public.books where id = v_book) = 'P5', 'CHECK FAILED: fallback teaser';
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_ingestion_job: a dead job fails a non-ready upload and never touches a ready one.
-- ---------------------------------------------------------------------------
do $$
declare
  v_seller uuid := '00000000-0000-4000-8000-00000000aa01';
  v_book uuid := '00000000-0000-4000-8000-00000000b001';
  v_dead uuid := '00000000-0000-4000-8000-00000000c006';
  v_ready uuid := '00000000-0000-4000-8000-00000000c007';
begin
  insert into public.book_uploads (id, seller_id, book_id, storage_path, original_name, size_bytes, status) values
    (v_dead, v_seller, v_book, 'check/p6.pdf', 'p6.pdf', 100, 'processing'),
    (v_ready, v_seller, v_book, 'check/p7.pdf', 'p7.pdf', 100, 'ready');
  insert into public.ingestion_jobs (upload_id, status, attempts, max_attempts, locked_at) values
    (v_dead, 'processing', 3, 3, now() - interval '1 hour'),
    (v_ready, 'processing', 3, 3, now() - interval '1 hour');

  perform public.claim_ingestion_job();

  assert (select status from public.book_uploads where id = v_dead) = 'failed',
    'CHECK FAILED: dead job must fail a product upload that has a book_id';
  assert (select status from public.book_uploads where id = v_ready) = 'ready',
    'CHECK FAILED: dead job must not downgrade a ready upload';
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill shape: provenance columns exist, are nullable, and the RPCs are service-role only.
-- ---------------------------------------------------------------------------
do $$
begin
  assert (select count(*) from information_schema.columns
          where table_schema = 'public' and column_name = 'upload_id' and is_nullable = 'YES'
            and table_name in ('recipes', 'book_sections', 'recipe_categories')) = 3,
    'CHECK FAILED: provenance columns missing or not nullable';
  assert not has_function_privilege('anon', 'public.create_book_from_ingestion(uuid,uuid,jsonb)', 'execute'),
    'CHECK FAILED: anon can execute create_book_from_ingestion';
  assert not has_function_privilege('authenticated', 'public.create_book_from_ingestion(uuid,uuid,jsonb)', 'execute'),
    'CHECK FAILED: authenticated can execute create_book_from_ingestion';
  assert has_function_privilege('service_role', 'public.create_book_from_ingestion(uuid,uuid,jsonb)', 'execute'),
    'CHECK FAILED: service_role cannot execute create_book_from_ingestion';
end;
$$;

do $$ begin raise notice 'multi_pdf_checks (merge): all checks passed'; end $$;

rollback;
