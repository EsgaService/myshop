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
  -- Removing an upload whose token was already used (not pending) frees its slot.
  update public.book_uploads set status = 'failed', removed_at = now() where storage_path = 'check/1.pdf';
  insert into public.book_uploads (seller_id, storage_path, original_name, size_bytes)
  values ('00000000-0000-4000-8000-00000000aa01', 'check/14.pdf', 'f14.pdf', 1000);

  -- Removing a PENDING upload does NOT free its slot: its signed upload token is still usable (~2h).
  update public.book_uploads set removed_at = now() where storage_path = 'check/2.pdf';
  begin
    insert into public.book_uploads (seller_id, storage_path, original_name, size_bytes)
    values ('00000000-0000-4000-8000-00000000aa01', 'check/15.pdf', 'f15.pdf', 1000);
    raise exception 'CHECK FAILED: removing a pending upload freed its slot';
  exception when others then
    if sqlerrm <> 'upload_limit_reached' then raise; end if;
  end;
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

-- ---------------------------------------------------------------------------
-- Review fixes: sellers.user_id hidden, claim_ingestion_job bounds, grant_subscription_period
-- ---------------------------------------------------------------------------

-- sellers: client roles cannot read user_id (column-level grants), public columns still work.
set local role anon;
do $$
declare n integer;
begin
  select count(*) into n from public.sellers where slug = 'check-seller-a';
  if n <> 1 then raise exception 'CHECK FAILED: anon cannot read public seller columns'; end if;

  begin
    perform user_id from public.sellers limit 1;
    raise exception 'CHECK FAILED: anon reads sellers.user_id';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.sellers where user_id = '00000000-0000-4000-8000-0000000000a1';
    raise exception 'CHECK FAILED: anon filters by sellers.user_id';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.sellers limit 1;
    raise exception 'CHECK FAILED: anon select * on sellers';
  exception when insufficient_privilege then null;
  end;

  -- The embedded seller used by the marketplace listing still works.
  select count(*) into n from public.books b join public.sellers s on s.id = b.seller_id
  where b.id = '00000000-0000-4000-8000-00000000b001';
  if n <> 1 then raise exception 'CHECK FAILED: books -> sellers join broke for anon'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare n integer;
begin
  begin
    perform user_id from public.sellers limit 1;
    raise exception 'CHECK FAILED: authenticated reads sellers.user_id';
  exception when insufficient_privilege then null;
  end;

  -- Owner-scoped RLS still resolves the seller through the security definer helper.
  select count(*) into n from public.books where id = '00000000-0000-4000-8000-00000000b002';
  if n <> 1 then raise exception 'CHECK FAILED: owner RLS broke after hiding sellers.user_id'; end if;
  select count(*) into n from public.recipes where book_id = '00000000-0000-4000-8000-00000000b002';
  if n <> 1 then raise exception 'CHECK FAILED: owner recipes RLS broke after hiding sellers.user_id'; end if;
end $$;
reset role;

-- The new RPC is service-role only.
set local role anon;
do $$
begin
  perform public.grant_subscription_period('00000000-0000-4000-8000-00000000aa02', 'check', 'anon-ref', 1, 'COP');
  raise exception 'CHECK FAILED: anon executed grant_subscription_period';
exception when insufficient_privilege then null;
end $$;
reset role;

-- claim_ingestion_job: stale jobs are reclaimed only while attempts remain; concurrency is capped.
do $$
declare
  seller constant uuid := '00000000-0000-4000-8000-00000000aa01';
  up uuid[];
  j_exhausted uuid;
  j_stale uuid;
  j_queued uuid;
  claimed public.ingestion_jobs;
  st public.job_status;
  ust public.upload_status;
begin
  select array_agg(id order by storage_path) into up
  from public.book_uploads
  where seller_id = seller and removed_at is null and storage_path in
    ('check/3.pdf', 'check/4.pdf', 'check/5.pdf', 'check/6.pdf', 'check/7.pdf');

  -- up[1]=check/3 exhausted stale, up[2]=check/4 stale with attempts left, up[3..5]=check/5..7
  insert into public.ingestion_jobs (upload_id, status, attempts, max_attempts, locked_at, created_at)
  values (up[1], 'processing', 3, 3, now() - interval '1 hour', '2000-01-01') returning id into j_exhausted;
  insert into public.ingestion_jobs (upload_id, status, attempts, max_attempts, locked_at, created_at)
  values (up[2], 'processing', 1, 3, now() - interval '1 hour', '2000-01-02') returning id into j_stale;

  select * into claimed from public.claim_ingestion_job();
  if claimed.id is distinct from j_stale or claimed.attempts <> 2 then
    raise exception 'CHECK FAILED: stale job with attempts left was not reclaimed (got %)', claimed.id;
  end if;

  select status into st from public.ingestion_jobs where id = j_exhausted;
  if st <> 'failed' then raise exception 'CHECK FAILED: exhausted stale job is % (expected failed)', st; end if;
  select status into ust from public.book_uploads where id = up[1];
  if ust <> 'failed' then raise exception 'CHECK FAILED: upload of exhausted stale job is % (expected failed)', ust; end if;

  -- Concurrency cap: 3 running jobs (j_stale is now running) => nothing else is claimed.
  insert into public.ingestion_jobs (upload_id, status, attempts, locked_at) values (up[3], 'processing', 1, now());
  insert into public.ingestion_jobs (upload_id, status, attempts, locked_at) values (up[4], 'processing', 1, now());
  insert into public.ingestion_jobs (upload_id, status, created_at) values (up[5], 'queued', '2000-01-03') returning id into j_queued;

  select * into claimed from public.claim_ingestion_job();
  if claimed.id is not null then raise exception 'CHECK FAILED: claim exceeded the concurrency cap (claimed %)', claimed.id; end if;

  update public.ingestion_jobs set status = 'succeeded' where upload_id = up[3];
  select * into claimed from public.claim_ingestion_job();
  if claimed.id is distinct from j_queued then raise exception 'CHECK FAILED: queued job not claimed once capacity freed'; end if;

  -- The exhausted job is never handed out again.
  select * into claimed from public.claim_ingestion_job();
  if claimed.id = j_exhausted then raise exception 'CHECK FAILED: exhausted job was reclaimed'; end if;
end $$;

-- grant_subscription_period: contiguous, idempotent, anchored to the original billing day.
do $$
declare
  sb constant uuid := '00000000-0000-4000-8000-00000000aa02';
  id1 uuid; id1b uuid; id2 uuid; id3 uuid; id4 uuid;
  r public.subscriptions;
begin
  id1 := public.grant_subscription_period(sb, 'check', 'anchor-1', 5000000, 'COP', '2026-01-31 10:00:00+00');
  select * into r from public.subscriptions where id = id1;
  if r.period_start <> '2026-01-31 10:00:00+00' or r.period_end <> '2026-02-28 10:00:00+00' then
    raise exception 'CHECK FAILED: first period is % -> %', r.period_start, r.period_end;
  end if;

  id1b := public.grant_subscription_period(sb, 'check', 'anchor-1', 5000000, 'COP', '2026-01-31 10:00:00+00');
  if id1b <> id1 or (select count(*) from public.subscriptions where seller_id = sb) <> 1 then
    raise exception 'CHECK FAILED: grant is not idempotent per provider_ref';
  end if;

  id2 := public.grant_subscription_period(sb, 'check', 'anchor-2', 5000000, 'COP', '2026-02-10 10:00:00+00');
  select * into r from public.subscriptions where id = id2;
  if r.period_start <> '2026-02-28 10:00:00+00' or r.period_end <> '2026-03-31 10:00:00+00' then
    raise exception 'CHECK FAILED: second period drifted: % -> %', r.period_start, r.period_end;
  end if;

  id3 := public.grant_subscription_period(sb, 'check', 'anchor-3', 5000000, 'COP', '2026-02-10 10:00:00+00');
  select * into r from public.subscriptions where id = id3;
  if r.period_start <> '2026-03-31 10:00:00+00' or r.period_end <> '2026-04-30 10:00:00+00' then
    raise exception 'CHECK FAILED: third period drifted: % -> %', r.period_start, r.period_end;
  end if;

  -- After a lapse the period restarts at the grant time with a fresh anchor.
  id4 := public.grant_subscription_period(sb, 'check', 'anchor-4', 5000000, 'COP', '2026-08-15 08:00:00+00');
  select * into r from public.subscriptions where id = id4;
  if r.period_start <> '2026-08-15 08:00:00+00' or r.period_end <> '2026-09-15 08:00:00+00' then
    raise exception 'CHECK FAILED: post-lapse period is % -> %', r.period_start, r.period_end;
  end if;
end $$;

-- Private storage bucket exists and is not public.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'seller-pdfs' and public = false) then
    raise exception 'CHECK FAILED: seller-pdfs bucket missing or public';
  end if;
end $$;

do $$ begin raise notice 'marketplace_rls_checks: all checks passed'; end $$;

select 'ALL_CHECKS_PASSED' as result;

rollback;
