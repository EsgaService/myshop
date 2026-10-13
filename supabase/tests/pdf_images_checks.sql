-- PDF images checks (R1.1, R3.5-R3.7, R4.1).
-- Run AFTER 20261015090000_pdf_images.sql, as the postgres role (SQL editor / MCP execute_sql / CLI).
-- Everything happens inside one transaction that is rolled back, so nothing persists.
-- Each check raises an exception on failure; a clean run ends with the final NOTICE.
-- Assertions are scoped to the fixture rows below (the database may hold real data).

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: seller A (published product + one ready upload) and seller B
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'images-seller-a@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'images-seller-b@example.test');
insert into public.profiles (id, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'seller'),
  ('00000000-0000-4000-8000-0000000000a2', 'seller');
insert into public.sellers (id, user_id, slug, store_name) values
  ('00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-0000000000a1', 'images-check-a', 'Images A'),
  ('00000000-0000-4000-8000-00000000aa02', '00000000-0000-4000-8000-0000000000a2', 'images-check-b', 'Images B');

insert into public.books (id, seller_id, slug, title, price_cents, status, published_at) values
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000aa01', 'images-pub', 'Published A', 1990000, 'published', now());

-- U1 is ready and ancient so the claim queue (ordered by created_at) always picks it first.
-- U2 is a second upload that will be merged into the published product.
insert into public.book_uploads (id, seller_id, book_id, storage_path, original_name, size_bytes, status, created_at) values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-00000000b001', 'images-check/u1.pdf', 'u1.pdf', 100, 'ready', now() - interval '100 years'),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-00000000b001', 'images-check/u2.pdf', 'u2.pdf', 100, 'uploaded', now());
insert into public.ingestion_jobs (upload_id, status) values
  ('00000000-0000-4000-8000-00000000c002', 'processing');

insert into public.book_images (id, seller_id, kind, upload_id, ordinal, page, width, height, storage_path, thumb_path) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000aa01', 'pdf',
   '00000000-0000-4000-8000-00000000c001', 1, 3, 800, 600, 'images-check/a/u1/1.webp', 'images-check/a/u1/1-t.webp');

-- ---------------------------------------------------------------------------
-- Table shape: pdf rows need upload/ordinal/page, (upload, ordinal) is unique, custom rows need a target
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    insert into public.book_images (seller_id, kind, width, height, storage_path, thumb_path)
    values ('00000000-0000-4000-8000-00000000aa01', 'pdf', 10, 10, 'images-check/bad1.webp', 'images-check/bad1-t.webp');
    raise exception 'CHECK FAILED: pdf image without upload/ordinal/page was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.book_images (seller_id, kind, upload_id, ordinal, page, width, height, storage_path, thumb_path)
    values ('00000000-0000-4000-8000-00000000aa01', 'pdf', '00000000-0000-4000-8000-00000000c001', 1, 4, 10, 10, 'images-check/bad2.webp', 'images-check/bad2-t.webp');
    raise exception 'CHECK FAILED: duplicate (upload, ordinal) was accepted';
  exception when unique_violation then null;
  end;

  begin
    insert into public.book_images (seller_id, kind, width, height, storage_path, thumb_path)
    values ('00000000-0000-4000-8000-00000000aa01', 'custom', 10, 10, 'images-check/bad3.webp', 'images-check/bad3-t.webp');
    raise exception 'CHECK FAILED: custom image without book or recipe was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.recipes (book_id, slug, title, photo_source)
    values ('00000000-0000-4000-8000-00000000b001', 'bad-source', 'Bad source', 'removed');
    raise exception 'CHECK FAILED: invalid photo_source was accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: owner-only select, no client writes, anon sees nothing
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
begin
  assert (select count(*) from public.book_images where id = '00000000-0000-4000-8000-00000000d001') = 1,
    'CHECK FAILED: the owner cannot read its image';
  begin
    insert into public.book_images (seller_id, kind, upload_id, ordinal, page, width, height, storage_path, thumb_path)
    values ('00000000-0000-4000-8000-00000000aa01', 'pdf', '00000000-0000-4000-8000-00000000c001', 9, 9, 10, 10, 'images-check/w.webp', 'images-check/w-t.webp');
    raise exception 'CHECK FAILED: an authenticated client wrote to book_images';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
do $$
begin
  assert (select count(*) from public.book_images where id = '00000000-0000-4000-8000-00000000d001') = 0,
    'CHECK FAILED: another seller can read the image';
end;
$$;
reset role;

set local role anon;
do $$
begin
  begin
    perform count(*) from public.book_images;
    raise exception 'CHECK FAILED: anon can select book_images';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- ---------------------------------------------------------------------------
-- claim_image_extraction: claim, no double claim, stale reclaim, exhausted attempts fail
-- ---------------------------------------------------------------------------
do $$
declare
  v_u1 uuid := '00000000-0000-4000-8000-00000000c001';
  v_claimed public.book_uploads;
begin
  -- A pending ready upload is claimed first (it is the oldest).
  select * into v_claimed from public.claim_image_extraction();
  assert v_claimed.id = v_u1, 'CHECK FAILED: the oldest pending upload was not claimed';
  assert v_claimed.images_status = 'processing' and v_claimed.images_attempts = 1,
    'CHECK FAILED: claim did not mark processing / attempts = 1';

  -- A fresh processing claim is not handed out again.
  select * into v_claimed from public.claim_image_extraction();
  assert v_claimed.id is distinct from v_u1, 'CHECK FAILED: a fresh claim was handed out twice';

  -- A stale claim is reclaimed with attempts + 1.
  update public.book_uploads set images_at = now() - interval '11 minutes' where id = v_u1;
  select * into v_claimed from public.claim_image_extraction();
  assert v_claimed.id = v_u1 and v_claimed.images_attempts = 2,
    'CHECK FAILED: a stale claim was not reclaimed with attempts = 2';

  -- Stale with attempts exhausted: marked failed and never claimed again.
  update public.book_uploads set images_at = now() - interval '11 minutes', images_attempts = 3 where id = v_u1;
  select * into v_claimed from public.claim_image_extraction();
  assert v_claimed.id is distinct from v_u1, 'CHECK FAILED: an exhausted upload was claimed';
  assert (select images_status from public.book_uploads where id = v_u1) = 'failed',
    'CHECK FAILED: an exhausted stale upload was not marked failed';

  -- Done uploads are never claimed.
  update public.book_uploads set images_status = 'done', images_attempts = 1 where id = v_u1;
  select * into v_claimed from public.claim_image_extraction();
  assert v_claimed.id is distinct from v_u1, 'CHECK FAILED: a done upload was claimed';

  -- Removed uploads are never claimed.
  update public.book_uploads set images_status = null, removed_at = now() where id = v_u1;
  select * into v_claimed from public.claim_image_extraction();
  assert v_claimed.id is distinct from v_u1, 'CHECK FAILED: a removed upload was claimed';
end;
$$;

-- ---------------------------------------------------------------------------
-- R4.1: merging another PDF into a published product keeps it published with its price
-- ---------------------------------------------------------------------------
do $$
declare
  v_book uuid := '00000000-0000-4000-8000-00000000b001';
begin
  perform public.create_book_from_ingestion(
    '00000000-0000-4000-8000-00000000aa01',
    '00000000-0000-4000-8000-00000000c002',
    jsonb_build_object(
      'slug', 'ai-slug', 'title', 'AI title',
      'categories', jsonb_build_array(jsonb_build_object('slug', 'cocteles', 'name', 'Cocteles', 'position', 1)),
      'sections', jsonb_build_array(),
      'recipes', jsonb_build_array(
        jsonb_build_object('category_slug', 'cocteles', 'slug', 'mojito', 'title', 'Mojito', 'position', 1, 'yield_servings', 1)
      )
    )
  );
  assert (select status from public.books where id = v_book) = 'published',
    'CHECK FAILED: merging a PDF unpublished the product';
  assert (select price_cents from public.books where id = v_book) = 1990000,
    'CHECK FAILED: merging a PDF changed the price';
  assert (select count(*) from public.recipes where book_id = v_book and slug = 'mojito') = 1,
    'CHECK FAILED: the merged recipe is missing';
  -- New recipes start as auto / unmatched; the new upload starts with images pending.
  assert (select photo_source from public.recipes where book_id = v_book and slug = 'mojito') = 'auto',
    'CHECK FAILED: a merged recipe did not start as photo_source = auto';
  assert (select images_status from public.book_uploads where id = '00000000-0000-4000-8000-00000000c002') is null,
    'CHECK FAILED: a freshly merged upload must start with images_status null';
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges and storage
-- ---------------------------------------------------------------------------
do $$
begin
  assert not has_function_privilege('anon', 'public.claim_image_extraction(interval)', 'execute'),
    'CHECK FAILED: anon can execute claim_image_extraction';
  assert not has_function_privilege('authenticated', 'public.claim_image_extraction(interval)', 'execute'),
    'CHECK FAILED: authenticated can execute claim_image_extraction';
  assert has_function_privilege('service_role', 'public.claim_image_extraction(interval)', 'execute'),
    'CHECK FAILED: service_role cannot execute claim_image_extraction';

  assert (select public from storage.buckets where id = 'seller-image-uploads') = false,
    'CHECK FAILED: seller-image-uploads must be private';
  assert (select file_size_limit from storage.buckets where id = 'seller-image-uploads') = 5242880,
    'CHECK FAILED: seller-image-uploads must be limited to 5 MB';
  assert (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
          and (coalesce(qual, '') || coalesce(with_check, '')) like '%seller-image-uploads%') = 0,
    'CHECK FAILED: seller-image-uploads must have no storage.objects client policies';
end;
$$;

do $$ begin raise notice 'pdf_images_checks: all checks passed'; end $$;

rollback;
