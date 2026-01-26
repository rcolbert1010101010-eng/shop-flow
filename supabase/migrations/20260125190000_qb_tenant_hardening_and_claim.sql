-- Harden QuickBooks integration tables for multi-tenant isolation
-- and add worker claim RPC for "QuickBooks Live Transfer".

begin;

-- 0) Determine a deterministic fallback tenant_id for backfilling existing rows.
-- This assumes the system currently has exactly one tenant (or you are OK assigning legacy rows to the oldest tenant).
do $do$
declare
  v_fallback_tenant uuid;
begin
  select id into v_fallback_tenant from public.tenants order by created_at asc nulls last, id asc limit 1;
  if v_fallback_tenant is null then
    raise exception 'Refusing to backfill QB tables: no rows in public.tenants';
  end if;
end $do$;

-- 1) Add tenant_id columns (nullable first) + backfill + enforce not null + default.
do $do$
declare
  v_fallback_tenant uuid;
begin
  select id into v_fallback_tenant from public.tenants order by created_at asc nulls last, id asc limit 1;

  -- integration_connections
  if to_regclass('public.integration_connections') is not null then
    execute $$alter table public.integration_connections add column if not exists tenant_id uuid$$;
    execute format($$update public.integration_connections set tenant_id = %L::uuid where tenant_id is null$$, v_fallback_tenant);
    execute $$alter table public.integration_connections alter column tenant_id set default public.current_tenant_id()$$;
    execute $$alter table public.integration_connections alter column tenant_id set not null$$;
    execute $$create index if not exists integration_connections_tenant_idx on public.integration_connections(tenant_id)$$;
  end if;

  -- accounting_integration_config
  if to_regclass('public.accounting_integration_config') is not null then
    execute $$alter table public.accounting_integration_config add column if not exists tenant_id uuid$$;
    execute format($$update public.accounting_integration_config set tenant_id = %L::uuid where tenant_id is null$$, v_fallback_tenant);
    execute $$alter table public.accounting_integration_config alter column tenant_id set default public.current_tenant_id()$$;
    execute $$alter table public.accounting_integration_config alter column tenant_id set not null$$;
    execute $$create index if not exists accounting_integration_config_tenant_idx on public.accounting_integration_config(tenant_id)$$;
  end if;

  -- external_references
  if to_regclass('public.external_references') is not null then
    execute $$alter table public.external_references add column if not exists tenant_id uuid$$;
    execute format($$update public.external_references set tenant_id = %L::uuid where tenant_id is null$$, v_fallback_tenant);
    execute $$alter table public.external_references alter column tenant_id set default public.current_tenant_id()$$;
    execute $$alter table public.external_references alter column tenant_id set not null$$;
    execute $$create index if not exists external_references_tenant_idx on public.external_references(tenant_id)$$;
  end if;

  -- accounting_exports
  if to_regclass('public.accounting_exports') is not null then
    execute $$alter table public.accounting_exports add column if not exists tenant_id uuid$$;
    execute format($$update public.accounting_exports set tenant_id = %L::uuid where tenant_id is null$$, v_fallback_tenant);
    execute $$alter table public.accounting_exports alter column tenant_id set default public.current_tenant_id()$$;
    execute $$alter table public.accounting_exports alter column tenant_id set not null$$;
    execute $$create index if not exists accounting_exports_tenant_idx on public.accounting_exports(tenant_id)$$;
  end if;
end $do$;

-- 2) Fix UNIQUE constraints to be tenant-aware.
-- integration_connections: unique(provider) -> unique(tenant_id, provider)
do $do$
begin
  if to_regclass('public.integration_connections') is not null then
    begin
      alter table public.integration_connections drop constraint if exists integration_connections_provider_key;
    exception when undefined_object then null;
    end;

    -- drop any legacy unnamed unique on provider if it exists (best-effort)
    begin
      execute $$alter table public.integration_connections drop constraint if exists integration_connections_provider_unique$$;
    exception when undefined_object then null;
    end;

    alter table public.integration_connections
      add constraint integration_connections_tenant_provider_key unique (tenant_id, provider);
  end if;
end $do$;

-- accounting_integration_config: provider unique -> tenant-aware unique
do $do$
begin
  if to_regclass('public.accounting_integration_config') is not null then
    begin
      alter table public.accounting_integration_config drop constraint if exists accounting_integration_config_provider_key;
    exception when undefined_object then null;
    end;

    begin
      execute $$alter table public.accounting_integration_config drop constraint if exists accounting_integration_config_provider_unique$$;
    exception when undefined_object then null;
    end;

    alter table public.accounting_integration_config
      add constraint accounting_integration_config_tenant_provider_key unique (tenant_id, provider);
  end if;
end $do$;

-- external_references: unique(provider, entity_type, entity_id) -> include tenant_id
do $do$
begin
  if to_regclass('public.external_references') is not null then
    begin
      alter table public.external_references drop constraint if exists external_references_provider_entity_type_entity_id_key;
    exception when undefined_object then null;
    end;

    alter table public.external_references
      add constraint external_references_tenant_provider_entity_key unique (tenant_id, provider, entity_type, entity_id);
  end if;
end $do$;

-- accounting_exports: unique(provider, export_type, payload_hash) -> include tenant_id
do $do$
begin
  if to_regclass('public.accounting_exports') is not null then
    begin
      alter table public.accounting_exports drop constraint if exists accounting_exports_provider_export_type_payload_hash_key;
    exception when undefined_object then null;
    end;

    alter table public.accounting_exports
      add constraint accounting_exports_tenant_provider_type_hash_key unique (tenant_id, provider, export_type, payload_hash);
  end if;
end $do$;

-- 3) Replace RLS policies: remove using(true) and enforce tenant_id = current_tenant_id().
-- integration_connections
do $do$
begin
  if to_regclass('public.integration_connections') is not null then
    alter table public.integration_connections enable row level security;
    alter table public.integration_connections force row level security;

    drop policy if exists "integration_connections_select_all" on public.integration_connections;
    create policy "integration_connections_select_tenant"
    on public.integration_connections
    for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

    drop policy if exists "integration_connections_write_admin_only" on public.integration_connections;
    create policy "integration_connections_write_admin_only"
    on public.integration_connections
    for all
    to authenticated
    using (public.current_app_role() = 'ADMIN' and tenant_id = public.current_tenant_id())
    with check (public.current_app_role() = 'ADMIN' and tenant_id = public.current_tenant_id());
  end if;
end $do$;

-- accounting_integration_config
do $do$
begin
  if to_regclass('public.accounting_integration_config') is not null then
    alter table public.accounting_integration_config enable row level security;
    alter table public.accounting_integration_config force row level security;

    drop policy if exists "accounting_integration_config_select_all" on public.accounting_integration_config;
    create policy "accounting_integration_config_select_tenant"
    on public.accounting_integration_config
    for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

    drop policy if exists "accounting_integration_config_write_admin_only" on public.accounting_integration_config;
    create policy "accounting_integration_config_write_admin_only"
    on public.accounting_integration_config
    for all
    to authenticated
    using (public.current_app_role() = 'ADMIN' and tenant_id = public.current_tenant_id())
    with check (public.current_app_role() = 'ADMIN' and tenant_id = public.current_tenant_id());
  end if;
end $do$;

-- external_references
do $do$
begin
  if to_regclass('public.external_references') is not null then
    alter table public.external_references enable row level security;
    alter table public.external_references force row level security;

    drop policy if exists "external_references_select_all" on public.external_references;
    create policy "external_references_select_tenant"
    on public.external_references
    for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

    drop policy if exists "external_references_write_admin_only" on public.external_references;
    create policy "external_references_write_admin_only"
    on public.external_references
    for all
    to authenticated
    using (public.current_app_role() = 'ADMIN' and tenant_id = public.current_tenant_id())
    with check (public.current_app_role() = 'ADMIN' and tenant_id = public.current_tenant_id());
  end if;
end $do$;

-- accounting_exports
do $do$
begin
  if to_regclass('public.accounting_exports') is not null then
    alter table public.accounting_exports enable row level security;
    alter table public.accounting_exports force row level security;

    drop policy if exists "accounting_exports_select_all" on public.accounting_exports;
    create policy "accounting_exports_select_tenant"
    on public.accounting_exports
    for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

    drop policy if exists "accounting_exports_write_admin_only" on public.accounting_exports;
    create policy "accounting_exports_write_admin_only"
    on public.accounting_exports
    for all
    to authenticated
    using (public.current_app_role() = 'ADMIN' and tenant_id = public.current_tenant_id())
    with check (public.current_app_role() = 'ADMIN' and tenant_id = public.current_tenant_id());
  end if;
end $do$;

-- 4) Update queue functions to insert tenant_id explicitly (so SECURITY DEFINER always writes correctly).
-- NOTE: these are best-effort replacements that match your existing logic but add tenant_id.
-- You can keep the rest of your function body as-is; only insert statements must change.

-- queue_invoice_export: patch insert to include tenant_id
create or replace function public.queue_invoice_export(invoice_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg record;
  inv record;
  payload jsonb;
  payload_hash text;
  status_text text := 'queued';
begin
  if auth.uid() is null then
    return 'unauthenticated';
  end if;

  select *
  into cfg
  from public.accounting_integration_config
  where provider = 'quickbooks'
    and tenant_id = public.current_tenant_id()
  limit 1;

  if cfg is null or cfg.is_enabled is not true then
    return 'skipped';
  end if;

  if coalesce(cfg.export_trigger, '') not like '%ON_INVOICE_FINALIZED%' then
    return 'skipped';
  end if;

  select
    i.id,
    i.invoice_number,
    i.created_at,
    i.issued_at,
    i.invoice_date,
    i.customer_id,
    i.status,
    i.voided_at,
    i.subtotal_parts,
    i.subtotal_labor,
    i.subtotal_fees,
    i.tax_amount,
    i.total,
    c.company_name,
    c.name,
    c.full_name
  into inv
  from public.invoices i
  left join public.customers c on c.id = i.customer_id
  where i.id = invoice_id;

  if inv is null then
    raise exception 'Invoice not found';
  end if;
  if inv.status is distinct from 'ISSUED' or inv.voided_at is not null then
    return 'skipped';
  end if;

  payload := jsonb_build_object(
    'schema_version', 1,
    'provider', 'quickbooks'
  );

  payload_hash := encode(digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex');

  begin
    insert into public.accounting_exports (
      tenant_id,
      provider,
      export_type,
      source_entity_type,
      source_entity_id,
      payload_json,
      payload_hash,
      status
    ) values (
      public.current_tenant_id(),
      'quickbooks',
      'INVOICE',
      'invoice',
      invoice_id,
      payload,
      payload_hash,
      'PENDING'
    );
  exception
    when unique_violation then
      status_text := 'duplicate';
  end;

  return status_text;
end;
$$;

grant execute on function public.queue_invoice_export(uuid) to authenticated;

-- queue_accounting_export_v1: patch insert to include tenant_id and config lookup by tenant
create or replace function public.queue_accounting_export_v1(
  provider text,
  export_type text,
  source_entity_type text,
  source_entity_id uuid,
  payload_json jsonb,
  payload_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg record;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  select *
  into cfg
  from public.accounting_integration_config
  where provider = queue_accounting_export_v1.provider
    and tenant_id = public.current_tenant_id()
  limit 1;

  if cfg is null or cfg.is_enabled is not true then
    return jsonb_build_object('status', 'skipped');
  end if;

  if coalesce(cfg.export_trigger, '') not like '%ON_INVOICE_FINALIZED%' then
    return jsonb_build_object('status', 'skipped');
  end if;

  if cfg.mode is not null and cfg.mode not in ('INVOICE_ONLY','INVOICE_AND_PAYMENTS','EXPORT_ONLY') then
    return jsonb_build_object('status', 'skipped', 'reason', 'mode_disabled');
  end if;

  begin
    insert into public.accounting_exports (
      tenant_id,
      provider,
      export_type,
      source_entity_type,
      source_entity_id,
      payload_json,
      payload_hash,
      status,
      attempt_count
    ) values (
      public.current_tenant_id(),
      queue_accounting_export_v1.provider,
      queue_accounting_export_v1.export_type,
      queue_accounting_export_v1.source_entity_type,
      queue_accounting_export_v1.source_entity_id,
      queue_accounting_export_v1.payload_json,
      queue_accounting_export_v1.payload_hash,
      'PENDING',
      0
    );
  exception
    when unique_violation then
      return jsonb_build_object('status', 'duplicate');
    when others then
      return jsonb_build_object('status', 'failed', 'error', SQLERRM);
  end;

  return jsonb_build_object('status', 'queued');
end;
$$;

grant execute on function public.queue_accounting_export_v1(text, text, text, uuid, jsonb, text) to authenticated;

-- 5) Worker claim RPC for Live Transfer (service role)
drop function if exists public.claim_accounting_exports(text, int);
create or replace function public.claim_accounting_exports(
  p_provider text,
  p_limit int
) returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg record;
begin
  if to_regclass('public.accounting_exports') is null then
    return;
  end if;

  select *
  into cfg
  from public.accounting_integration_config
  where provider = p_provider
    and tenant_id = public.current_tenant_id()
  limit 1;

  if cfg is null or cfg.is_enabled is not true or coalesce(cfg.transfer_mode, 'IMPORT_ONLY') <> 'LIVE_TRANSFER' then
    return;
  end if;

  return query
  with c as (
    select ae.id
    from public.accounting_exports ae
    where ae.tenant_id = public.current_tenant_id()
      and ae.provider = p_provider
      and ae.status = 'PENDING'
      and (ae.next_attempt_at is null or ae.next_attempt_at <= now())
    order by ae.created_at asc
    for update skip locked
    limit greatest(p_limit, 0)
  )
  update public.accounting_exports ae
  set
    status = 'PROCESSING',
    attempt_count = ae.attempt_count + 1,
    last_attempt_at = now(),
    updated_at = now()
  from c
  where ae.id = c.id
  returning ae.id;
end;
$$;

grant execute on function public.claim_accounting_exports(text, int) to service_role;

commit;
