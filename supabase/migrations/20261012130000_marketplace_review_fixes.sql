-- Marketplace review fixes (additive: CREATE OR REPLACE, ADD COLUMN, GRANT/REVOKE, UPDATE only).
--
--   1/9  claim_ingestion_job: stale jobs are only reclaimed while attempts remain, exhausted stale
--        jobs become terminal, and at most 3 jobs run at once (claims are serialized by an advisory lock).
--   4    ingestion_jobs.manual_retries: caps manual retries per upload.
--   5    enforce_upload_limit: a removed upload whose signed upload token may still be valid
--        (status 'pending', removed < 2 hours ago) keeps holding its slot.
--   6/13 grant_subscription_period: race-free (per-seller row lock) and idempotent period grant with
--        month-end anchoring (Jan 31 -> Feb 28 -> Mar 31). Mirrors src/lib/seller/decide-subscription.ts.
--   11   sellers: column-level SELECT for anon/authenticated, excluding user_id.
--   12   scrub recipe steps from already stored public teasers.

-- ---------------------------------------------------------------------------
-- 4. Manual retry counter
-- ---------------------------------------------------------------------------
alter table public.ingestion_jobs
  add column if not exists manual_retries integer not null default 0 check (manual_retries >= 0);

-- ---------------------------------------------------------------------------
-- 1 + 9. Claim: bounded retries and bounded concurrency
-- ---------------------------------------------------------------------------
create or replace function public.claim_ingestion_job(p_stale interval default interval '10 minutes')
returns setof public.ingestion_jobs
language plpgsql
set search_path = ''
as $$
declare
  v_max_concurrent constant integer := 3;
  v_running integer;
begin
  -- Serialize claims so the concurrency cap below cannot be raced.
  perform pg_advisory_xact_lock(hashtext('public.claim_ingestion_job'));

  -- A stale processing job that used all its attempts is terminal: never paid for again.
  with dead as (
    update public.ingestion_jobs j
    set status = 'failed',
        locked_at = null,
        last_error = 'El procesamiento tardó demasiado. Inténtalo de nuevo.'
    where j.status = 'processing'
      and j.locked_at < now() - p_stale
      and j.attempts >= j.max_attempts
    returning j.upload_id
  )
  update public.book_uploads u
  set status = 'failed',
      error = 'El procesamiento tardó demasiado. Inténtalo de nuevo.'
  from dead
  where u.id = dead.upload_id
    and u.book_id is null;

  select count(*) into v_running
  from public.ingestion_jobs r
  where r.status = 'processing'
    and r.locked_at >= now() - p_stale;
  if v_running >= v_max_concurrent then
    return;
  end if;

  return query
  update public.ingestion_jobs j
  set status = 'processing',
      attempts = j.attempts + 1,
      locked_at = now()
  where j.id = (
    select c.id
    from public.ingestion_jobs c
    where (c.status = 'queued' and c.run_after <= now())
       or (c.status = 'processing' and c.locked_at < now() - p_stale and c.attempts < c.max_attempts)
    order by c.created_at
    for update skip locked
    limit 1
  )
  returning j.*;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Upload limit: removing a pending upload does not free the slot while its token may be usable
-- ---------------------------------------------------------------------------
create or replace function public.enforce_upload_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  active_count integer;
begin
  -- Serialize concurrent inserts for the same seller.
  perform 1 from public.sellers where id = new.seller_id for update;

  -- Keep in sync with holdsUploadSlot() in src/lib/books/upload-limit.ts (token TTL: 2 hours).
  select count(*) into active_count
  from public.book_uploads
  where seller_id = new.seller_id
    and (
      removed_at is null
      or (status = 'pending' and removed_at > now() - interval '2 hours')
    );

  if new.removed_at is null and active_count >= 12 then
    raise exception 'upload_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6 + 13. Subscription period grant
-- ---------------------------------------------------------------------------
create function public.grant_subscription_period(
  p_seller       uuid,
  p_provider     text,
  p_provider_ref text,
  p_amount_cents integer,
  p_currency     text,
  p_now          timestamptz default now()
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id          uuid;
  v_chain_start timestamptz;
  v_until       timestamptz;
  v_next        timestamptz;
  v_prev        timestamptz;
  v_start       timestamptz;
  v_anchor      integer;
  v_start_utc   timestamp;
  v_first       timestamp;
  v_last_day    integer;
  v_end         timestamptz;
begin
  -- Per-seller lock: concurrent grants for the same seller are serialized.
  perform 1 from public.sellers where id = p_seller for update;
  if not found then
    raise exception 'seller_not_found' using errcode = 'P0001';
  end if;

  -- Idempotent per (provider, provider_ref).
  select s.id into v_id
  from public.subscriptions s
  where s.provider = p_provider and s.provider_ref = p_provider_ref;
  if v_id is not null then
    return v_id;
  end if;

  -- Period covering p_now, then extend through contiguous queued periods.
  select s.period_start, s.period_end into v_chain_start, v_until
  from public.subscriptions s
  where s.seller_id = p_seller and s.period_start <= p_now and s.period_end > p_now
  order by s.period_end desc
  limit 1;

  if v_until is null then
    v_start := p_now;
    v_anchor := extract(day from (p_now at time zone 'UTC'))::integer;
  else
    loop
      select max(s.period_end) into v_next
      from public.subscriptions s
      where s.seller_id = p_seller and s.period_start <= v_until and s.period_end > v_until;
      exit when v_next is null;
      v_until := v_next;
    end loop;

    -- Walk back to the first period of the contiguous chain: its day is the billing anchor.
    loop
      select min(s.period_start) into v_prev
      from public.subscriptions s
      where s.seller_id = p_seller and s.period_start < v_chain_start and s.period_end >= v_chain_start;
      exit when v_prev is null;
      v_chain_start := v_prev;
    end loop;

    v_start := v_until;
    v_anchor := extract(day from (v_chain_start at time zone 'UTC'))::integer;
  end if;

  -- One calendar month in UTC, anchored to the original day and clamped to the month length.
  v_start_utc := v_start at time zone 'UTC';
  v_first := date_trunc('month', v_start_utc) + interval '1 month';
  v_last_day := extract(day from (v_first + interval '1 month' - interval '1 day'))::integer;
  v_end := (v_first + (least(v_anchor, v_last_day) - 1) * interval '1 day' + v_start_utc::time) at time zone 'UTC';

  insert into public.subscriptions (seller_id, provider, provider_ref, amount_cents, currency, period_start, period_end)
  values (p_seller, p_provider, p_provider_ref, p_amount_cents, p_currency, v_start, v_end)
  on conflict (provider, provider_ref) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.grant_subscription_period(uuid, text, text, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grant_subscription_period(uuid, text, text, integer, text, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- 11. sellers: hide user_id (auth user id) from client roles
-- ---------------------------------------------------------------------------
revoke select on public.sellers from anon, authenticated;
grant select (id, slug, store_name, bio, avatar_url, city, instagram, whatsapp, is_platform, created_at)
  on public.sellers to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. Public teasers must not carry recipe steps
-- ---------------------------------------------------------------------------
update public.stores
set teaser = jsonb_set(teaser, '{sample}', (teaser -> 'sample') - 'steps')
where teaser #> '{sample,steps}' is not null;

update public.books
set teaser = jsonb_set(teaser, '{sample}', (teaser -> 'sample') - 'steps')
where teaser #> '{sample,steps}' is not null;
