-- Seller marketplace: RLS, helper functions and grants.
--
-- Model:
--   * Every marketplace table is read-only for clients. There are NO insert/update/delete policies
--     and write privileges are revoked; only the service role (server-side) writes.
--   * books:   visible when (published AND seller is live) OR owned by me OR purchased by me.
--   * recipes / book_sections: only buyers of the book and the owning seller (drafts included).
--   * categories: visible when the parent book is visible (evaluated under books RLS).
--   * A lapsed seller's books disappear from the marketplace, but existing buyers keep access.

-- ---------------------------------------------------------------------------
-- Private helper functions (schema not exposed through the API)
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- True when the seller is the platform seller or has a subscription period covering now().
create function private.seller_is_live(p_seller uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sellers s
    where s.id = p_seller
      and (
        s.is_platform
        or exists (
          select 1 from public.subscriptions sub
          where sub.seller_id = s.id
            and sub.period_start <= now()
            and sub.period_end > now()
        )
      )
  );
$$;

-- The seller id owned by the calling user (null for buyers / anonymous).
create function private.my_seller_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.sellers s where s.user_id = (select auth.uid());
$$;

revoke execute on function private.seller_is_live(uuid) from public;
revoke execute on function private.my_seller_id() from public;
grant execute on function private.seller_is_live(uuid) to anon, authenticated;
grant execute on function private.my_seller_id() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policies (select only)
-- ---------------------------------------------------------------------------
create policy "profiles are readable by their owner"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "sellers are public"
  on public.sellers for select
  to anon, authenticated
  using (true);

create policy "subscriptions are readable by their seller"
  on public.subscriptions for select
  to authenticated
  using (seller_id = (select private.my_seller_id()));

create policy "uploads are readable by their seller"
  on public.book_uploads for select
  to authenticated
  using (seller_id = (select private.my_seller_id()));

create policy "ingestion jobs are readable by the upload seller"
  on public.ingestion_jobs for select
  to authenticated
  using (exists (
    select 1 from public.book_uploads u
    where u.id = ingestion_jobs.upload_id
      and u.seller_id = (select private.my_seller_id())
  ));

create policy "books are listed, owned or purchased"
  on public.books for select
  to anon, authenticated
  using (
    (status = 'published' and private.seller_is_live(seller_id))
    or seller_id = (select private.my_seller_id())
    or exists (
      select 1 from public.purchases p
      where p.book_id = books.id
        and p.user_id = (select auth.uid())
    )
  );

-- Replace the legacy "public" / store_id based policies.
drop policy "categories are public" on public.recipe_categories;
drop policy "buyers read book sections" on public.book_sections;
drop policy "buyers read recipes" on public.recipes;

create policy "categories follow book visibility"
  on public.recipe_categories for select
  to anon, authenticated
  using (exists (
    select 1 from public.books b where b.id = recipe_categories.book_id
  ));

create policy "buyers and owner read book sections"
  on public.book_sections for select
  to authenticated
  using (
    exists (
      select 1 from public.purchases p
      where p.book_id = book_sections.book_id
        and p.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.books b
      where b.id = book_sections.book_id
        and b.seller_id = (select private.my_seller_id())
    )
  );

create policy "buyers and owner read recipes"
  on public.recipes for select
  to authenticated
  using (
    exists (
      select 1 from public.purchases p
      where p.book_id = recipes.book_id
        and p.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.books b
      where b.id = recipes.book_id
        and b.seller_id = (select private.my_seller_id())
    )
  );

-- ---------------------------------------------------------------------------
-- Grants: select only (defense in depth on top of missing write policies)
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.sellers, public.subscriptions, public.books,
              public.book_uploads, public.ingestion_jobs
  from anon, authenticated;

grant select on public.sellers, public.books to anon, authenticated;
grant select on public.profiles, public.subscriptions, public.book_uploads, public.ingestion_jobs
  to authenticated;
