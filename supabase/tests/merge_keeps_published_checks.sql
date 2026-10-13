-- R4.1: merging a new PDF into a PUBLISHED product keeps it published with the same price.
-- Run as the postgres role (SQL editor / MCP execute_sql / CLI). One transaction, rolled back.
-- Assertions are scoped to the fixture rows below (the database may hold real data).

begin;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000f1', 'merge-published@example.test');
insert into public.profiles (id, role) values ('00000000-0000-4000-8000-0000000000f1', 'seller');
insert into public.sellers (id, user_id, slug, store_name) values
  ('00000000-0000-4000-8000-00000000ff01', '00000000-0000-4000-8000-0000000000f1', 'merge-check', 'Merge check');
insert into public.books (id, seller_id, slug, title, price_cents, status, published_at) values
  ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000ff01', 'merge-pub', 'Published', 2500000, 'published', now());
insert into public.book_uploads (id, seller_id, book_id, storage_path, original_name, size_bytes, status) values
  ('00000000-0000-4000-8000-00000000f0c1', '00000000-0000-4000-8000-00000000ff01', '00000000-0000-4000-8000-00000000f001', 'merge-check/new.pdf', 'new.pdf', 100, 'uploaded');
insert into public.ingestion_jobs (upload_id, status) values ('00000000-0000-4000-8000-00000000f0c1', 'processing');

do $$
declare
  v_book uuid := '00000000-0000-4000-8000-00000000f001';
  v_published_at timestamptz;
begin
  select published_at into v_published_at from public.books where id = v_book;

  perform public.create_book_from_ingestion(
    '00000000-0000-4000-8000-00000000ff01',
    '00000000-0000-4000-8000-00000000f0c1',
    jsonb_build_object(
      'slug', 'ai-slug', 'title', 'AI title',
      'categories', jsonb_build_array(jsonb_build_object('slug', 'cocteles', 'name', 'Cocteles', 'position', 1)),
      'sections', jsonb_build_array(),
      'recipes', jsonb_build_array(
        jsonb_build_object('category_slug', 'cocteles', 'slug', 'mojito', 'title', 'Mojito', 'position', 1, 'yield_servings', 1)
      )
    )
  );

  assert (select status from public.book_uploads where id = '00000000-0000-4000-8000-00000000f0c1') = 'ready',
    'CHECK FAILED: the upload was not merged';
  assert (select status from public.books where id = v_book) = 'published',
    'CHECK FAILED: merging a PDF changed the product status';
  assert (select price_cents from public.books where id = v_book) = 2500000,
    'CHECK FAILED: merging a PDF changed the price';
  assert (select published_at from public.books where id = v_book) is not distinct from v_published_at,
    'CHECK FAILED: merging a PDF changed published_at';
  assert (select title from public.books where id = v_book) = 'Published',
    'CHECK FAILED: merging a PDF overwrote the seller title';
end;
$$;

do $$ begin raise notice 'merge_keeps_published_checks: all checks passed'; end $$;

rollback;
