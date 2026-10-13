-- Records when the user accepted the terms while creating their account.
-- Additive and nullable: existing profiles are not backfilled.
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
