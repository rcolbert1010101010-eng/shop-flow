begin;

alter table public.profiles add column if not exists active_tenant_id uuid;
create index if not exists profiles_active_tenant_id_idx on public.profiles(active_tenant_id);

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (
      select p.active_tenant_id
      from public.profiles p
      join public.tenant_users tu on tu.tenant_id = p.active_tenant_id
      where p.id = auth.uid()
        and tu.user_id = auth.uid()
      limit 1
    ),
    (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = auth.uid()
      order by tu.created_at asc nulls last, tu.tenant_id asc
      limit 1
    )
  );
$$;

create or replace function public.set_active_tenant(p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.tenant_users
    where user_id = auth.uid()
      and tenant_id = p_tenant_id
  ) then
    raise exception 'not a member of tenant';
  end if;

  insert into public.profiles (id, active_tenant_id)
  values (auth.uid(), p_tenant_id)
  on conflict (id)
  do update set active_tenant_id = excluded.active_tenant_id;

  return p_tenant_id;
end;
$$;

grant execute on function public.set_active_tenant(uuid) to authenticated;

commit;
