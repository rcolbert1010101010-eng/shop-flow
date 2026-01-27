alter table if exists public.plasma_jobs
  add column if not exists title text;
