-- Custom image quota enforced at insert time (additive: CREATE FUNCTION / CREATE TRIGGER only).
-- No DELETE and no DROP POLICY, so it can be applied through the Supabase MCP.
--
-- The app pre-checks the 300-per-seller quota, but two concurrent confirms could both pass the check.
-- This trigger serializes custom inserts per seller with a transaction-scoped advisory lock and counts
-- again, so the quota can never be exceeded. The app maps `custom_image_quota` to its Spanish message.

create function public.enforce_custom_image_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'custom' then
    perform pg_advisory_xact_lock(hashtext('book_images_quota:' || new.seller_id::text));
    if (
      select count(*)
      from public.book_images b
      where b.seller_id = new.seller_id and b.kind = 'custom'
    ) >= 300 then
      raise exception 'custom_image_quota' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_custom_image_quota() from public, anon, authenticated;

create trigger book_images_custom_quota
  before insert on public.book_images
  for each row execute function public.enforce_custom_image_quota();
