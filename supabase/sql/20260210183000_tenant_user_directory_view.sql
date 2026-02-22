-- Tenant user directory view + tenant_users RLS hardening

-- 1) Canonical read surface
create or replace view public.tenant_user_directory_v
with (security_invoker=on)
as
select
  tu.tenant_id as tenant_id,
  tu.user_id as user_id,
  tu.role as membership_role,
  up.email as email,
  up.full_name as full_name,
  up.username as username,
  up.is_active as is_active,
  coalesce(up.created_at, tu.created_at, now()) as created_at,
  rolepick.key as role_key
from public.tenant_users tu
left join public.user_profiles up on up.id = tu.user_id
left join public.user_roles ur on ur.user_id = tu.user_id
left join public.roles r on r.id = ur.role_id
left join lateral (
  select r2.key
  from public.user_roles ur2
  join public.roles r2 on r2.id = ur2.role_id
  where ur2.user_id = tu.user_id
  order by (r2.key = 'admin') desc, r2.key asc
  limit 1
) rolepick on true;

-- 2) tenant_users RLS: enable and replace policies
alter table public.tenant_users enable row level security;

-- Remove any existing policies to avoid overlapping behavior
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenant_users', pol.policyname);
  END LOOP;
END $$;

-- Allow tenant members to read membership rows for their tenant
create policy tenant_users_select_member
on public.tenant_users
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_users me
    where me.tenant_id = tenant_users.tenant_id
      and me.user_id = auth.uid()
  )
);

-- Only admins can mutate tenant_users
create policy tenant_users_admin_all
on public.tenant_users
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- 3) Backfill user_profiles for tenant members when email is available
insert into public.user_profiles (id, email, full_name, is_active, created_at)
select
  tu.user_id,
  au.email,
  null,
  true,
  coalesce(tu.created_at, now())
from public.tenant_users tu
join auth.users au on au.id = tu.user_id
left join public.user_profiles up on up.id = tu.user_id
where up.id is null
  and au.email is not null;

-- Report missing profile ids that still lack email (manual follow-up)
-- select tu.user_id
-- from public.tenant_users tu
-- left join public.user_profiles up on up.id = tu.user_id
-- left join auth.users au on au.id = tu.user_id
-- where up.id is null
--   and (au.email is null or au.email = '');
