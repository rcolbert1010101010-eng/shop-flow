-- QuickBooks OAuth support for integration_connections.
-- Tokens are server-only; authenticated clients read from a safe view without token columns.

begin;

do $do$
begin
  if to_regclass('public.integration_connections') is null then
    raise notice 'Skipping: public.integration_connections does not exist';
    return;
  end if;

  alter table public.integration_connections
    add column if not exists external_realm_id text null,
    add column if not exists access_token text null,
    add column if not exists refresh_token text null,
    add column if not exists access_token_expires_at timestamptz null,
    add column if not exists refresh_token_expires_at timestamptz null,
    add column if not exists scopes text[] null,
    add column if not exists last_error text null,
    add column if not exists metadata jsonb null;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.integration_connections'::regclass
      and c.contype = 'u'
      and (
        select array_agg(a.attname order by a.attname)
        from unnest(c.conkey) as k(attnum)
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = k.attnum
      )::text[] = array['provider', 'tenant_id']::text[]
  ) then
    alter table public.integration_connections
      add constraint integration_connections_tenant_provider_key unique (tenant_id, provider);
  end if;

  alter table public.integration_connections enable row level security;
  alter table public.integration_connections force row level security;

  drop policy if exists "integration_connections_select_all" on public.integration_connections;
  drop policy if exists "integration_connections_select_tenant" on public.integration_connections;
  drop policy if exists "integration_connections_write_admin_only" on public.integration_connections;
  drop policy if exists "integration_connections_insert_admin_only" on public.integration_connections;
  drop policy if exists "integration_connections_update_admin_only" on public.integration_connections;

  create policy "integration_connections_select_tenant"
  on public.integration_connections
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

  create policy "integration_connections_insert_admin_only"
  on public.integration_connections
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'ADMIN'
    and tenant_id = public.current_tenant_id()
  );

  create policy "integration_connections_update_admin_only"
  on public.integration_connections
  for update
  to authenticated
  using (
    public.current_app_role() = 'ADMIN'
    and tenant_id = public.current_tenant_id()
  )
  with check (
    public.current_app_role() = 'ADMIN'
    and tenant_id = public.current_tenant_id()
  );

  revoke select on table public.integration_connections from authenticated;
  revoke insert, update on table public.integration_connections from authenticated;

  grant insert (
    tenant_id,
    provider,
    status,
    display_name,
    external_realm_id,
    last_error,
    metadata
  ) on public.integration_connections to authenticated;

  grant update (
    status,
    display_name,
    external_realm_id,
    last_error,
    metadata
  ) on public.integration_connections to authenticated;

  create or replace view public.integration_connections_safe as
  select
    id,
    tenant_id,
    provider,
    status,
    display_name,
    external_realm_id,
    access_token_expires_at,
    refresh_token_expires_at,
    scopes,
    last_error,
    metadata,
    created_at,
    updated_at
  from public.integration_connections;

  revoke all on table public.integration_connections_safe from authenticated;
  grant select on table public.integration_connections_safe to authenticated;
end
$do$;

commit;
