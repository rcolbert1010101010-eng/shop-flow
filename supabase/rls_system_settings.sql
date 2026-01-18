-- RLS: system_settings
-- Role source: public.user_roles -> roles.key (fallback to public.profiles.role).

-- Helper: reuse current_app_role (defaults to TECH if missing)
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select r.key
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
      limit 1
    ),
    (select role::text from public.profiles where id = auth.uid()),
    'TECH'
  );
$$;

-- Policies
drop policy if exists "system_settings_select_all_authenticated" on public.system_settings;
create policy "system_settings_select_all_authenticated"
on public.system_settings
for select
to authenticated
using (true);

drop policy if exists "system_settings_insert_admin_only" on public.system_settings;
create policy "system_settings_insert_admin_only"
on public.system_settings
for insert
to authenticated
with check (public.current_app_role() in ('ADMIN'));

drop policy if exists "system_settings_update_admin_only" on public.system_settings;
create policy "system_settings_update_admin_only"
on public.system_settings
for update
to authenticated
using (public.current_app_role() in ('ADMIN'))
with check (public.current_app_role() in ('ADMIN'));

-- Enable + force RLS (run after policies to avoid lockouts)
alter table public.system_settings enable row level security;
alter table public.system_settings force row level security;
