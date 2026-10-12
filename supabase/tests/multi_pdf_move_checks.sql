-- Multi-PDF products: move checks for Migration C (move_upload_to_book).
-- Run AFTER 20261013090000_multi_pdf_products.sql AND 20261013090200_move_upload_rpc.sql, as the postgres role
-- (Dashboard SQL editor). Self-contained: it builds its own fixtures and everything runs inside one
-- transaction that is rolled back, so nothing persists. Every assertion is scoped to the fixture rows
-- (no global counts). A clean run ends with the final NOTICE; any failure raises an exception.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: seller S (and a foreign seller T).
--   SRC  (draft):  M1 (cocteles: a, dup; postres: b; section), M2 (cocteles: c, dup), F1 failed.
--   TGT  (draft):  T1 (cocteles: x, dup; ensaladas: y).
--   SRC2 (draft):  N1 (cocteles: n), its only PDF.
--   LEG  (legacy), ARC (archived), FB (belongs to T).
-- Upload order by created_at: M1 < M2 < T1 < N1.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'multi-pdf-move-s@example.test'),
  ('00000000-0000-4000-8000-0000000000f2', 'multi-pdf-move-t@example.test');
insert into public.profiles (id, role) values
  ('00000000-0000-4000-8000-0000000000f1', 'seller'),
  ('00000000-0000-4000-8000-0000000000f2', 'seller');
insert into public.sellers (id, user_id, slug, store_name) values
  ('00000000-0000-4000-8000-00000000ff01', '00000000-0000-4000-8000-0000000000f1', 'multi-pdf-move-s', 'Move S'),
  ('00000000-0000-4000-8000-00000000ff02', '00000000-0000-4000-8000-0000000000f2', 'multi-pdf-move-t', 'Move T');

insert into public.books (id, seller_id, slug, title, status, legacy_store_id) values
  ('00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-00000000ff01', 'move-src',  'Move SRC',  'draft',    null),
  ('00000000-0000-4000-8000-00000000f102', '00000000-0000-4000-8000-00000000ff01', 'move-tgt',  'Move TGT',  'draft',    null),
  ('00000000-0000-4000-8000-00000000f103', '00000000-0000-4000-8000-00000000ff01', 'move-src2', 'Move SRC2', 'draft',    null),
  ('00000000-0000-4000-8000-00000000f104', '00000000-0000-4000-8000-00000000ff01', 'move-leg',  'Move LEG',  'draft',    '00000000-0000-4000-8000-00000000f1e9'),
  ('00000000-0000-4000-8000-00000000f105', '00000000-0000-4000-8000-00000000ff01', 'move-arc',  'Move ARC',  'archived', null),
  ('00000000-0000-4000-8000-00000000f106', '00000000-0000-4000-8000-00000000ff02', 'move-fb',   'Move FB',   'draft',    null);

insert into public.book_uploads (id, seller_id, book_id, storage_path, original_name, size_bytes, status, created_at) values
  ('00000000-0000-4000-8000-00000000f201', '00000000-0000-4000-8000-00000000ff01', '00000000-0000-4000-8000-00000000f101', 'move/m1.pdf', 'm1.pdf', 100, 'uploaded', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-00000000f202', '00000000-0000-4000-8000-00000000ff01', '00000000-0000-4000-8000-00000000f101', 'move/m2.pdf', 'm2.pdf', 100, 'uploaded', now() - interval '9 minutes'),
  ('00000000-0000-4000-8000-00000000f203', '00000000-0000-4000-8000-00000000ff01', '00000000-0000-4000-8000-00000000f101', 'move/f1.pdf', 'f1.pdf', 100, 'failed',   now() - interval '8 minutes'),
  ('00000000-0000-4000-8000-00000000f204', '00000000-0000-4000-8000-00000000ff01', '00000000-0000-4000-8000-00000000f102', 'move/t1.pdf', 't1.pdf', 100, 'uploaded', now() - interval '7 minutes'),
  ('00000000-0000-4000-8000-00000000f205', '00000000-0000-4000-8000-00000000ff01', '00000000-0000-4000-8000-00000000f103', 'move/n1.pdf', 'n1.pdf', 100, 'uploaded', now() - interval '6 minutes');

do $$
declare
  v_s uuid := '00000000-0000-4000-8000-00000000ff01';
begin
  perform public.create_book_from_ingestion(v_s, '00000000-0000-4000-8000-00000000f201', jsonb_build_object(
    'slug', 'x', 'title', 'x',
    'teaser', jsonb_build_object('intro', jsonb_build_array('M1')),
    'categories', jsonb_build_array(
      jsonb_build_object('slug', 'cocteles', 'name', 'Cocteles', 'position', 1),
      jsonb_build_object('slug', 'postres', 'name', 'Postres', 'position', 2)),
    'sections', jsonb_build_array(jsonb_build_object('position', 1, 'title', 'Intro M1', 'blocks', jsonb_build_array())),
    'recipes', jsonb_build_array(
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'a',   'title', 'A',     'position', 1),
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'dup', 'title', 'DupM1', 'position', 2),
      jsonb_build_object('category_slug', 'postres',  'slug', 'b',   'title', 'B',     'position', 3))));
  perform public.create_book_from_ingestion(v_s, '00000000-0000-4000-8000-00000000f202', jsonb_build_object(
    'slug', 'x', 'title', 'x',
    'teaser', jsonb_build_object('intro', jsonb_build_array('M2')),
    'categories', jsonb_build_array(jsonb_build_object('slug', 'cocteles', 'name', 'Cocteles', 'position', 1)),
    'recipes', jsonb_build_array(
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'c',   'title', 'C',     'position', 1),
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'zed', 'title', 'Z',     'position', 2))));
  perform public.create_book_from_ingestion(v_s, '00000000-0000-4000-8000-00000000f204', jsonb_build_object(
    'slug', 'x', 'title', 'x',
    'teaser', jsonb_build_object('intro', jsonb_build_array('T1')),
    'categories', jsonb_build_array(
      jsonb_build_object('slug', 'cocteles',   'name', 'Cocteles',   'position', 1),
      jsonb_build_object('slug', 'ensaladas',  'name', 'Ensaladas',  'position', 2)),
    'recipes', jsonb_build_array(
      jsonb_build_object('category_slug', 'cocteles',  'slug', 'x',   'title', 'X',     'position', 1),
      jsonb_build_object('category_slug', 'cocteles',  'slug', 'dup', 'title', 'DupT',   'position', 2),
      jsonb_build_object('category_slug', 'ensaladas', 'slug', 'y',   'title', 'Y',     'position', 3))));
  perform public.create_book_from_ingestion(v_s, '00000000-0000-4000-8000-00000000f205', jsonb_build_object(
    'slug', 'x', 'title', 'x',
    'teaser', jsonb_build_object('intro', jsonb_build_array('N1')),
    'categories', jsonb_build_array(jsonb_build_object('slug', 'cocteles', 'name', 'Cocteles', 'position', 1)),
    'recipes', jsonb_build_array(
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'n',   'title', 'N',     'position', 1),
      jsonb_build_object('category_slug', 'cocteles', 'slug', 'dup', 'title', 'DupN',  'position', 2))));

  assert (select count(*) from public.recipes where book_id = '00000000-0000-4000-8000-00000000f101') = 5, 'FIXTURE FAILED: SRC recipes';
  assert (select count(*) from public.recipes where book_id = '00000000-0000-4000-8000-00000000f102') = 3, 'FIXTURE FAILED: TGT recipes';
  assert (select count(*) from public.recipes where book_id = '00000000-0000-4000-8000-00000000f103') = 2, 'FIXTURE FAILED: SRC2 recipes';
end;
$$;

-- ---------------------------------------------------------------------------
-- Rejections that must change nothing.
-- ---------------------------------------------------------------------------
do $$
declare
  v_s    uuid := '00000000-0000-4000-8000-00000000ff01';
  v_t    uuid := '00000000-0000-4000-8000-00000000ff02';
  v_src  uuid := '00000000-0000-4000-8000-00000000f101';
  v_tgt  uuid := '00000000-0000-4000-8000-00000000f102';
  v_src2 uuid := '00000000-0000-4000-8000-00000000f103';
  v_leg  uuid := '00000000-0000-4000-8000-00000000f104';
  v_arc  uuid := '00000000-0000-4000-8000-00000000f105';
  v_fb   uuid := '00000000-0000-4000-8000-00000000f106';
  v_m1   uuid := '00000000-0000-4000-8000-00000000f201';
  v_f1   uuid := '00000000-0000-4000-8000-00000000f203';
  v_n1   uuid := '00000000-0000-4000-8000-00000000f205';
  v_msg  text;
begin
  -- Non-ready (failed) upload.
  begin
    perform public.move_upload_to_book(v_s, v_f1, v_tgt);
    v_msg := 'no error';
  exception when others then v_msg := sqlerrm; end;
  assert v_msg = 'upload_not_ready', 'CHECK FAILED: failed upload was moved: ' || v_msg;

  -- Foreign target (belongs to another seller).
  begin
    perform public.move_upload_to_book(v_s, v_m1, v_fb);
    v_msg := 'no error';
  exception when others then v_msg := sqlerrm; end;
  assert v_msg = 'upload_not_owned', 'CHECK FAILED: foreign target accepted: ' || v_msg;

  -- Foreign seller trying to move someone else's upload.
  begin
    perform public.move_upload_to_book(v_t, v_m1, v_fb);
    v_msg := 'no error';
  exception when others then v_msg := sqlerrm; end;
  assert v_msg = 'upload_not_owned', 'CHECK FAILED: foreign seller accepted: ' || v_msg;

  -- Unknown target.
  begin
    perform public.move_upload_to_book(v_s, v_m1, '00000000-0000-4000-8000-00000000f1ff');
    v_msg := 'no error';
  exception when others then v_msg := sqlerrm; end;
  assert v_msg = 'upload_not_owned', 'CHECK FAILED: unknown target accepted: ' || v_msg;

  -- Legacy target.
  begin
    perform public.move_upload_to_book(v_s, v_m1, v_leg);
    v_msg := 'no error';
  exception when others then v_msg := sqlerrm; end;
  assert v_msg = 'invalid_target', 'CHECK FAILED: legacy target accepted: ' || v_msg;

  -- Archived target.
  begin
    perform public.move_upload_to_book(v_s, v_m1, v_arc);
    v_msg := 'no error';
  exception when others then v_msg := sqlerrm; end;
  assert v_msg = 'invalid_target', 'CHECK FAILED: archived target accepted: ' || v_msg;

  -- Same product.
  begin
    perform public.move_upload_to_book(v_s, v_m1, v_src);
    v_msg := 'no error';
  exception when others then v_msg := sqlerrm; end;
  assert v_msg = 'invalid_target', 'CHECK FAILED: same-product move accepted: ' || v_msg;

  -- Last ready PDF of a published source (SRC2 only has N1).
  update public.books set status = 'published', published_at = now() where id = v_src2;
  begin
    perform public.move_upload_to_book(v_s, v_n1, v_tgt);
    v_msg := 'no error';
  exception when others then v_msg := sqlerrm; end;
  assert v_msg = 'last_ready_pdf', 'CHECK FAILED: last ready PDF of a published source was moved: ' || v_msg;
  assert (select book_id from public.book_uploads where id = v_n1) = v_src2, 'CHECK FAILED: guard moved N1';
  assert (select count(*) from public.recipes where book_id = v_src2) = 2, 'CHECK FAILED: guard moved recipes';
  assert (select teaser #>> '{intro,0}' from public.books where id = v_src2) = 'N1', 'CHECK FAILED: guard changed teaser';
  update public.books set status = 'draft', published_at = null where id = v_src2;

  -- Nothing moved by any rejection.
  assert (select book_id from public.book_uploads where id = v_m1) = v_src, 'CHECK FAILED: M1 moved by a rejected call';
  assert (select count(*) from public.recipes where book_id = v_src) = 5, 'CHECK FAILED: SRC recipes changed by rejections';
  assert (select count(*) from public.recipes where book_id = v_tgt) = 3, 'CHECK FAILED: TGT recipes changed by rejections';
end;
$$;

-- ---------------------------------------------------------------------------
-- Move M1 into TGT: reuse "cocteles", create "postres", suffix the colliding slug, prune the source category.
-- SRC stays draft here and keeps M2 (+ failed F1), so it is not empty.
-- ---------------------------------------------------------------------------
do $$
declare
  v_s    uuid := '00000000-0000-4000-8000-00000000ff01';
  v_src  uuid := '00000000-0000-4000-8000-00000000f101';
  v_tgt  uuid := '00000000-0000-4000-8000-00000000f102';
  v_m1   uuid := '00000000-0000-4000-8000-00000000f201';
  v_res  jsonb;
  v_tgt_cocteles uuid;
begin
  select id into v_tgt_cocteles from public.recipe_categories where book_id = v_tgt and slug = 'cocteles';

  v_res := public.move_upload_to_book(v_s, v_m1, v_tgt);
  assert (v_res ->> 'source_book_id')::uuid = v_src, 'CHECK FAILED: source_book_id';
  assert (v_res ->> 'target_book_id')::uuid = v_tgt, 'CHECK FAILED: target_book_id';
  assert not (v_res ->> 'source_empty')::boolean, 'CHECK FAILED: source still has M2 and F1, source_empty must be false';
  assert (select book_id from public.book_uploads where id = v_m1) = v_tgt, 'CHECK FAILED: upload not re-pointed';

  -- Target: M1 recipes first (older upload), then T1; colliding slug gets -2; positions contiguous.
  assert (select string_agg(slug, ',' order by position) from public.recipes where book_id = v_tgt)
    = 'a,dup-2,b,x,dup,y', 'CHECK FAILED: TGT slugs after move';
  assert (select string_agg(title, ',' order by position) from public.recipes where book_id = v_tgt)
    = 'A,DupM1,B,X,DupT,Y', 'CHECK FAILED: TGT titles after move';
  assert (select string_agg(position::text, ',' order by position) from public.recipes where book_id = v_tgt)
    = '0,1,2,3,4,5', 'CHECK FAILED: TGT recipe positions not contiguous';

  -- Category reuse: M1 recipes in "cocteles" point to the target category that already existed.
  assert (select count(*) from public.recipe_categories where book_id = v_tgt and slug = 'cocteles') = 1,
    'CHECK FAILED: cocteles duplicated in TGT';
  assert (select count(*) from public.recipes where book_id = v_tgt and slug in ('a', 'dup-2') and category_id = v_tgt_cocteles) = 2,
    'CHECK FAILED: moved recipes not pointing at the reused category';
  -- "postres" did not exist in TGT: created last, owned by the moved upload, and b points at it.
  assert (select string_agg(slug || ':' || position, ',' order by position) from public.recipe_categories where book_id = v_tgt)
    = 'cocteles:1,ensaladas:2,postres:3', 'CHECK FAILED: TGT categories after move';
  assert (select upload_id from public.recipe_categories where book_id = v_tgt and slug = 'postres') = v_m1,
    'CHECK FAILED: created category should carry the moved upload as provenance';
  assert (select c.slug from public.recipes r join public.recipe_categories c on c.id = r.category_id
          where r.book_id = v_tgt and r.slug = 'b') = 'postres', 'CHECK FAILED: b category';
  assert not exists (
    select 1 from public.recipes r join public.recipe_categories c on c.id = r.category_id
    where r.book_id = v_tgt and c.book_id <> v_tgt), 'CHECK FAILED: a TGT recipe points to a category of another product';

  -- Sections follow the upload.
  assert (select string_agg(title || ':' || position, ',') from public.book_sections where book_id = v_tgt) = 'Intro M1:0',
    'CHECK FAILED: sections in TGT';
  assert not exists (select 1 from public.book_sections where book_id = v_src), 'CHECK FAILED: sections left in SRC';

  -- Source: only M2 content, contiguous; "postres" pruned, "cocteles" kept because M2 uses it.
  assert (select string_agg(slug, ',' order by position) from public.recipes where book_id = v_src) = 'c,zed',
    'CHECK FAILED: SRC recipes after move';
  assert (select string_agg(position::text, ',' order by position) from public.recipes where book_id = v_src) = '0,1',
    'CHECK FAILED: SRC recipe positions not contiguous';
  assert not exists (select 1 from public.recipe_categories where book_id = v_src and slug = 'postres'),
    'CHECK FAILED: empty source category not pruned';
  assert (select string_agg(slug || ':' || position, ',') from public.recipe_categories where book_id = v_src) = 'cocteles:1',
    'CHECK FAILED: SRC categories after move';

  -- Teasers: TGT earliest ready PDF is now M1; SRC falls back to M2.
  assert (select teaser #>> '{intro,0}' from public.books where id = v_tgt) = 'M1', 'CHECK FAILED: TGT teaser';
  assert (select teaser #>> '{intro,0}' from public.books where id = v_src) = 'M2', 'CHECK FAILED: SRC teaser';

  -- Title and description of the target are untouched.
  assert (select title from public.books where id = v_tgt) = 'Move TGT', 'CHECK FAILED: TGT title changed';
end;
$$;

-- ---------------------------------------------------------------------------
-- Move M2 into TGT (no collisions). SRC keeps only the failed F1: not empty (active upload),
-- but it has no content left and no teaser.
-- ---------------------------------------------------------------------------
do $$
declare
  v_s    uuid := '00000000-0000-4000-8000-00000000ff01';
  v_src  uuid := '00000000-0000-4000-8000-00000000f101';
  v_tgt  uuid := '00000000-0000-4000-8000-00000000f102';
  v_m2   uuid := '00000000-0000-4000-8000-00000000f202';
  v_res  jsonb;
begin
  v_res := public.move_upload_to_book(v_s, v_m2, v_tgt);
  assert not (v_res ->> 'source_empty')::boolean, 'CHECK FAILED: failed F1 is still an active upload';

  assert (select string_agg(slug, ',' order by position) from public.recipes where book_id = v_tgt)
    = 'a,dup-2,b,c,zed,x,dup,y', 'CHECK FAILED: TGT slugs after second move: '
      || (select string_agg(slug, ',' order by position) from public.recipes where book_id = v_tgt);
  assert (select string_agg(position::text, ',' order by position) from public.recipes where book_id = v_tgt)
    = '0,1,2,3,4,5,6,7', 'CHECK FAILED: TGT recipe positions not contiguous after second move';
  assert (select string_agg(slug || ':' || position, ',' order by position) from public.recipe_categories where book_id = v_tgt)
    = 'cocteles:1,ensaladas:2,postres:3', 'CHECK FAILED: TGT categories after second move';

  assert not exists (select 1 from public.recipes where book_id = v_src), 'CHECK FAILED: SRC recipes remain';
  assert not exists (select 1 from public.recipe_categories where book_id = v_src), 'CHECK FAILED: SRC categories remain';
  assert (select teaser from public.books where id = v_src) = '{}'::jsonb, 'CHECK FAILED: SRC teaser should be empty';
  assert (select teaser #>> '{intro,0}' from public.books where id = v_tgt) = 'M1', 'CHECK FAILED: TGT teaser changed';
end;
$$;

-- ---------------------------------------------------------------------------
-- Move the only PDF of a draft source: source_empty = true; the source is left without content.
-- ---------------------------------------------------------------------------
do $$
declare
  v_s    uuid := '00000000-0000-4000-8000-00000000ff01';
  v_src2 uuid := '00000000-0000-4000-8000-00000000f103';
  v_tgt  uuid := '00000000-0000-4000-8000-00000000f102';
  v_n1   uuid := '00000000-0000-4000-8000-00000000f205';
  v_res  jsonb;
begin
  v_res := public.move_upload_to_book(v_s, v_n1, v_tgt);
  assert (v_res ->> 'source_empty')::boolean, 'CHECK FAILED: source_empty must be true';
  assert not exists (select 1 from public.recipes where book_id = v_src2), 'CHECK FAILED: SRC2 recipes remain';
  assert not exists (select 1 from public.recipe_categories where book_id = v_src2), 'CHECK FAILED: SRC2 categories remain';
  assert (select teaser from public.books where id = v_src2) = '{}'::jsonb, 'CHECK FAILED: SRC2 teaser should be empty';

  assert (select string_agg(slug, ',' order by position) from public.recipes where book_id = v_tgt)
    = 'a,dup-2,b,c,zed,x,dup,y,n,dup-3', 'CHECK FAILED: TGT slugs after third move (second collision gets -3)';
  assert (select count(*) from public.recipe_categories where book_id = v_tgt and slug = 'cocteles') = 1,
    'CHECK FAILED: cocteles duplicated after third move';

  -- An already moved upload now belongs to TGT: moving it back to the emptied SRC2 works the same way.
  v_res := public.move_upload_to_book(v_s, v_n1, v_src2);
  assert not (v_res ->> 'source_empty')::boolean, 'CHECK FAILED: TGT still has other PDFs';
  assert (select string_agg(slug, ',' order by position) from public.recipes where book_id = v_src2) = 'n,dup-3',
    'CHECK FAILED: move back';
  assert (select teaser #>> '{intro,0}' from public.books where id = v_src2) = 'N1', 'CHECK FAILED: SRC2 teaser after move back';
  assert (select string_agg(slug, ',' order by position) from public.recipes where book_id = v_tgt)
    = 'a,dup-2,b,c,zed,x,dup,y', 'CHECK FAILED: TGT after move back';
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
do $$
begin
  assert not has_function_privilege('anon', 'public.move_upload_to_book(uuid,uuid,uuid)', 'execute'),
    'CHECK FAILED: anon can execute move_upload_to_book';
  assert not has_function_privilege('authenticated', 'public.move_upload_to_book(uuid,uuid,uuid)', 'execute'),
    'CHECK FAILED: authenticated can execute move_upload_to_book';
  assert has_function_privilege('service_role', 'public.move_upload_to_book(uuid,uuid,uuid)', 'execute'),
    'CHECK FAILED: service_role cannot execute move_upload_to_book';
end;
$$;

do $$ begin raise notice 'multi_pdf_move_checks: all checks passed'; end $$;

rollback;
