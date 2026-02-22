-- Enable RLS on tenant_users and enforce tenant-scoped access.
-- Authoritative membership model: existence of row == membership. Role stored on row.

alter table public.tenant_users enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenant_users'
  loop
    execute format('drop policy if exists %I on public.tenant_users', pol.policyname);
  end loop;
end $$;

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

create policy tenant_users_admin_all
on public.tenant_users
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
