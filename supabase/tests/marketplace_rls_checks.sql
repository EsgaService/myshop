-- Marketplace RLS + integrity checks (R11, R20, R21).
-- Run AFTER both marketplace migrations, as the postgres role (SQL editor / MCP execute_sql).
-- Everything happens inside one transaction that is rolled back, so nothing persists.
-- Each check raises an exception on failure; a clean run ends with the final NOTICE.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: buyer, seller A (subscribed), seller B (no subscription)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000b1', 'buyer-check@example.test'),
  ('00000000-0000-4000-8000-0000000000a1', 'seller-a-check@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'seller-b-check@example.test'),
  ('00000000-0000-4000-8000-0000000000c1', 'stranger-check@example.test');

insert into public.profiles (id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'buyer'),
  ('00000000-0000-4000-8000-0000000000a1', 'seller'),
  ('00000000-0000-4000-8000-0000000000a2', 'seller'),
  ('00000000-0000-4000-8000-0000000000c1', 'buyer');

insert into public.sellers (id, user_id, slug, store_name) values
  ('00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-0000000000a1', 'check-seller-a', 'Check A'),
  ('00000000-0000-4000-8000-00000000aa02', '00000000-0000-4000-8000-0000000000a2', 'check-seller-b', 'Check B');

insert into public.subscriptions (seller_id, provider, provider_ref, amount_cents, period_start, period_end) values
  ('00000000-0000-4000-8000-00000000aa01', 'check', 'sub-a-1', 5000000, now() - interval '1 day', now() + interval '29 days');

-- A: one published book + one draft. B (lapsed): one published book.
insert into public.books (id, seller_id, slug, title, price_cents, status, published_at) values
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000aa01', 'pub-a', 'Published A', 1990000, 'published', now()),
  ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000aa01', 'draft-a', 'Draft A', 0, 'draft', null),
  ('00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000aa02', 'pub-b', 'Published B lapsed', 1990000, 'published', now());

insert into public.recipe_categories (book_id, slug, name) values
  ('00000000-0000-4000-8000-00000000b001', 'c1', 'Cat A'),
  ('00000000-0000-4000-8000-00000000b002', 'c1', 'Cat draft A');
insert into public.recipes (book_id, slug, title) values
  ('00000000-0000-4000-8000-00000000b001', 'r1', 'Recipe A'),
  ('00000000-0000-4000-8000-00000000b002', 'r1', 'Recipe draft A'),
  ('00000000-0000-4000-8000-00000000b003', 'r1', 'Recipe B');
insert into public.book_sections (book_id, title) values
  ('00000000-0000-4000-8000-00000000b001', 'Section A');

-- Buyer owns Published A and lapsed-seller book B.
insert into public.purchases (user_id, book_id, provider, amount_cents, currency) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b001', 'check', 1990000, 'COP'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b003', 'check', 1990000, 'COP');

-- ---------------------------------------------------------------------------
-- Integrity: purchases_buyer_only, upload limit, zero orphans (as postgres)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    insert into public.purchases (user_id, book_id, provider, amount_cents, currency)
    values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b001', 'check', 1, 'COP');
    raise exception 'CHECK FAILED: seller purchase was accepted';
  exception when others then
    if sqlerrm <> 'sellers_cannot_purchase' then raise; end if;
  end;
end $$;

do $$
declare
  i integer;
begin
  for i in 1..12 loop
    insert into public.book_uploads (seller_id, storage_path, original_name, size_bytes)
    values ('00000000-0000-4000-8000-00000000aa01', 'check/' || i || '.pdf', 'f' || i || '.pdf', 1000);
  end loop;
  begin
    insert into public.book_uploads (seller_id, storage_path, original_name, size_bytes)
    values ('00000000-0000-4000-8000-00000000aa01', 'check/13.pdf', 'f13.pdf', 1000);
    raise exception 'CHECK FAILED: 13th upload was accepted';
  exception when others then
    if sqlerrm <> 'upload_limit_reached' then raise; end if;
  end;
  -- Removed uploads free their slot.
  update public.book_uploads set removed_at = now() where storage_path = 'check/1.pdf';
  insert into public.book_uploads (seller_id, storage_path, original_name, size_bytes)
  values ('00000000-0000-4000-8000-00000000aa01', 'check/14.pdf', 'f14.pdf', 1000);
end $$;

do $$
begin
  if exists (select 1 from public.recipes r where not exists (select 1 from public.books b where b.id = r.book_id)) then
    raise exception 'CHECK FAILED: orphan recipes';
  end if;
  if exists (select 1 from public.purchases p where not exists (select 1 from public.books b where b.id = p.book_id)) then
    raise exception 'CHECK FAILED: orphan purchases';
  end if;
  if exists (select 1 from public.stores s where not exists (select 1 from public.books b where b.id = s.id)) then
    raise exception 'CHECK FAILED: store without matching book';
  end if;
  if exists (select 1 from public.recipes where store_id is not null and book_id <> store_id) then
    raise exception 'CHECK FAILED: recipe book_id/store_id mismatch';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS checks. Fixture books are filtered by id because legacy platform books also exist.
-- Helper fixture ids: b001 = A published, b002 = A draft, b003 = B (lapsed) published.
-- ---------------------------------------------------------------------------

-- anon: only the live seller's published book; no recipes/sections; cannot write.
set local role anon;
do $$
declare n integer;
begin
  select count(*) into n from public.books where id::text like '00000000-0000-4000-8000-00000000b00%';
  if n <> 1 then raise exception 'CHECK FAILED: anon should see 1 fixture book, got %', n; end if;

  select count(*) into n from public.books where id = '00000000-0000-4000-8000-00000000b003';
  if n <> 0 then raise exception 'CHECK FAILED: anon sees lapsed seller book'; end if;

  begin
    perform 1 from public.recipes limit 1;
    raise exception 'CHECK FAILED: anon can select recipes';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.books (seller_id, slug, title) values ('00000000-0000-4000-8000-00000000aa01', 'x', 'x');
    raise exception 'CHECK FAILED: anon insert accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- buyer: owns A and B(lapsed); reads their recipes, never the draft.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
do $$
declare n integer;
begin
  select count(*) into n from public.recipes where book_id = '00000000-0000-4000-8000-00000000b001';
  if n <> 1 then raise exception 'CHECK FAILED: buyer cannot read purchased recipes (got %)', n; end if;

  select count(*) into n from public.recipes where book_id = '00000000-0000-4000-8000-00000000b003';
  if n <> 1 then raise exception 'CHECK FAILED: buyer lost access after seller lapse (got %)', n; end if;

  select count(*) into n from public.recipes where book_id = '00000000-0000-4000-8000-00000000b002';
  if n <> 0 then raise exception 'CHECK FAILED: buyer reads draft recipes'; end if;

  select count(*) into n from public.book_sections where book_id = '00000000-0000-4000-8000-00000000b001';
  if n <> 1 then raise exception 'CHECK FAILED: buyer cannot read purchased sections'; end if;

  select count(*) into n from public.subscriptions;
  if n <> 0 then raise exception 'CHECK FAILED: buyer reads subscriptions'; end if;

  begin
    update public.books set price_cents = 1 where id = '00000000-0000-4000-8000-00000000b001';
    raise exception 'CHECK FAILED: buyer update accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- stranger: no purchase -> zero recipes/sections; sees only the listed book metadata.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
do $$
declare n integer;
begin
  select count(*) into n from public.recipes where book_id::text like '00000000-0000-4000-8000-00000000b00%';
  if n <> 0 then raise exception 'CHECK FAILED: non-buyer reads recipes (got %)', n; end if;

  select count(*) into n from public.book_sections where book_id::text like '00000000-0000-4000-8000-00000000b00%';
  if n <> 0 then raise exception 'CHECK FAILED: non-buyer reads sections (got %)', n; end if;

  select count(*) into n from public.books where id = '00000000-0000-4000-8000-00000000b001';
  if n <> 1 then raise exception 'CHECK FAILED: listed book metadata hidden from non-buyer'; end if;

  select count(*) into n from public.books where id = '00000000-0000-4000-8000-00000000b002';
  if n <> 0 then raise exception 'CHECK FAILED: non-buyer sees draft'; end if;
end $$;
reset role;

-- seller A: sees own drafts, recipes, uploads, subscription; nothing of seller B.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare n integer;
begin
  select count(*) into n from public.books where id = '00000000-0000-4000-8000-00000000b002';
  if n <> 1 then raise exception 'CHECK FAILED: seller cannot see own draft'; end if;

  select count(*) into n from public.recipes where book_id in
    ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000b002');
  if n <> 2 then raise exception 'CHECK FAILED: seller cannot read own recipes (got %)', n; end if;

  select count(*) into n from public.subscriptions;
  if n <> 1 then raise exception 'CHECK FAILED: seller subscription visibility (got %)', n; end if;

  select count(*) into n from public.book_uploads;
  if n <> 13 then raise exception 'CHECK FAILED: seller sees % uploads, expected 13 rows (12 active + 1 removed)', n; end if;
end $$;
reset role;

-- seller B (lapsed): own book hidden from marketplace logic but readable by owner; not A's drafts.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
do $$
declare n integer;
begin
  select count(*) into n from public.recipes where book_id in
    ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000b002');
  if n <> 0 then raise exception 'CHECK FAILED: other seller reads A recipes (got %)', n; end if;

  select count(*) into n from public.books where id = '00000000-0000-4000-8000-00000000b002';
  if n <> 0 then raise exception 'CHECK FAILED: other seller sees A draft'; end if;

  select count(*) into n from public.subscriptions;
  if n <> 0 then raise exception 'CHECK FAILED: other seller reads A subscription'; end if;

  select count(*) into n from public.book_uploads;
  if n <> 0 then raise exception 'CHECK FAILED: other seller reads A uploads'; end if;
end $$;
reset role;

-- Private storage bucket exists and is not public.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'seller-pdfs' and public = false) then
    raise exception 'CHECK FAILED: seller-pdfs bucket missing or public';
  end if;
end $$;

do $$ begin raise notice 'marketplace_rls_checks: all checks passed'; end $$;

rollback;
