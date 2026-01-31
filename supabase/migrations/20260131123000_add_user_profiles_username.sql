-- Add username to user_profiles and enforce uniqueness (case-insensitive)
alter table public.user_profiles add column if not exists username text;

create unique index if not exists user_profiles_username_unique
  on public.user_profiles (lower(username))
  where username is not null;
