-- Fix: the books SELECT policy queried public.purchases directly, but `anon` has no
-- privileges on purchases, so any anonymous read of books failed with
-- "permission denied for table purchases". Move the purchase lookup into a
-- SECURITY DEFINER helper (scoped to the calling user) and re-point the policy.

create function private.has_purchased(p_book uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.purchases p
    where p.book_id = p_book
      and p.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.has_purchased(uuid) from public;
grant execute on function private.has_purchased(uuid) to anon, authenticated;

alter policy "books are listed, owned or purchased" on public.books
  using (
    (status = 'published' and private.seller_is_live(seller_id))
    or seller_id = (select private.my_seller_id())
    or private.has_purchased(id)
  );
