-- Custom image quota checks (trigger book_images_custom_quota).
-- Run AFTER 20261015090100_custom_image_quota.sql, as the postgres role (SQL editor / MCP execute_sql / CLI).
-- Everything happens inside one transaction that is rolled back, so nothing persists.
-- Assertions are scoped to the fixture rows below (the database may hold real data).

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'quota-seller-a@example.test'),
  ('00000000-0000-4000-8000-0000000000e2', 'quota-seller-b@example.test');
insert into public.profiles (id, role) values
  ('00000000-0000-4000-8000-0000000000e1', 'seller'),
  ('00000000-0000-4000-8000-0000000000e2', 'seller');
insert into public.sellers (id, user_id, slug, store_name) values
  ('00000000-0000-4000-8000-00000000ee01', '00000000-0000-4000-8000-0000000000e1', 'quota-check-a', 'Quota A'),
  ('00000000-0000-4000-8000-00000000ee02', '00000000-0000-4000-8000-0000000000e2', 'quota-check-b', 'Quota B');
insert into public.books (id, seller_id, slug, title, price_cents, status) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000ee01', 'quota-a', 'Quota A', 1000000, 'draft'),
  ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000ee02', 'quota-b', 'Quota B', 1000000, 'draft');

do $$
declare
  v_a uuid := '00000000-0000-4000-8000-00000000ee01';
  v_b uuid := '00000000-0000-4000-8000-00000000ee02';
begin
  -- 300 custom images are accepted.
  insert into public.book_images (seller_id, kind, book_id, width, height, storage_path, thumb_path)
  select v_a, 'custom', '00000000-0000-4000-8000-00000000e001', 10, 10, 'quota-check/a/' || g || '.webp', 'quota-check/a/' || g || '-t.webp'
  from generate_series(1, 300) g;
  assert (select count(*) from public.book_images where seller_id = v_a and kind = 'custom') = 300,
    'CHECK FAILED: the first 300 custom images were not accepted';

  -- The 301st is refused with custom_image_quota (P0001).
  begin
    insert into public.book_images (seller_id, kind, book_id, width, height, storage_path, thumb_path)
    values (v_a, 'custom', '00000000-0000-4000-8000-00000000e001', 10, 10, 'quota-check/a/301.webp', 'quota-check/a/301-t.webp');
    raise exception 'CHECK FAILED: the 301st custom image was accepted';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'custom_image_quota', 'CHECK FAILED: unexpected error ' || sqlerrm;
  end;

  -- The quota is per seller.
  insert into public.book_images (seller_id, kind, book_id, width, height, storage_path, thumb_path)
  values (v_b, 'custom', '00000000-0000-4000-8000-00000000e002', 10, 10, 'quota-check/b/1.webp', 'quota-check/b/1-t.webp');

  -- Only custom images count: a pdf candidate is never blocked by a full quota.
  insert into public.book_uploads (id, seller_id, book_id, storage_path, original_name, size_bytes, status)
  values ('00000000-0000-4000-8000-00000000e0c1', v_a, '00000000-0000-4000-8000-00000000e001', 'quota-check/u.pdf', 'u.pdf', 100, 'ready');
  insert into public.book_images (seller_id, kind, upload_id, ordinal, page, width, height, storage_path, thumb_path)
  values (v_a, 'pdf', '00000000-0000-4000-8000-00000000e0c1', 1, 1, 10, 10, 'quota-check/a/pdf1.webp', 'quota-check/a/pdf1-t.webp');
end;
$$;

do $$ begin raise notice 'custom_image_quota_checks: all checks passed'; end $$;

rollback;
