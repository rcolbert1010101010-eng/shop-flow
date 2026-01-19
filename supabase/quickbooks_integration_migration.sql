-- QuickBooks integration shell tables and RLS

-- integration_connections
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null default 'DISCONNECTED', -- DISCONNECTED|CONNECTED|EXPIRED|ERROR
  realm_id text null,
  display_name text null,
  scopes text[] null,
  token_encrypted text null,
  refresh_token_encrypted text null,
  token_expires_at timestamptz null,
  last_health_check_at timestamptz null,
  last_health_check_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  unique(provider)
);

-- accounting_integration_config
create table if not exists public.accounting_integration_config (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'quickbooks' unique,
  is_enabled boolean not null default false,
  mode text not null default 'INVOICE_ONLY', -- INVOICE_ONLY|INVOICE_AND_PAYMENTS|EXPORT_ONLY
  calculation_source text not null default 'SHOPFLOW', -- SHOPFLOW|QUICKBOOKS
  auto_create_customers boolean not null default true,
  export_trigger text not null default 'ON_INVOICE_FINALIZED',
  start_export_from_date date null,
  default_terms_name text null,
  default_deposit_item_name text null,
  class_tracking_enabled boolean not null default false,
  default_class_name text null,
  income_account_labor text null,
  income_account_parts text null,
  income_account_fees text null,
  income_account_sublet text null,
  liability_account_sales_tax text null,
  clearing_account_undeposited_funds text null,
  line_item_strategy text not null default 'ROLLUP', -- ROLLUP|DETAILED
  customer_match_strategy text not null default 'DISPLAY_NAME', -- DISPLAY_NAME|NAME_PLUS_PHONE|EXTERNAL_REF_ONLY
  customer_name_format text not null default '{{companyName}}',
  config_version int not null default 1,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

-- external_references
create table if not exists public.external_references (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  entity_type text not null, -- customer|invoice|payment|item|account
  entity_id uuid not null,
  external_id text not null,
  external_key text null,
  status text not null default 'PENDING', -- LINKED|PENDING|FAILED
  last_synced_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, entity_type, entity_id)
);
create index if not exists external_references_provider_entity_type_idx on public.external_references (provider, entity_type);

-- accounting_exports
create table if not exists public.accounting_exports (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'quickbooks',
  export_type text not null, -- INVOICE|PAYMENT|CUSTOMER
  source_entity_type text not null, -- work_order|sales_order|invoice|payment
  source_entity_id uuid not null,
  snapshot_id uuid null,
  payload_json jsonb not null,
  payload_hash text not null,
  status text not null default 'PENDING', -- PENDING|SENT|SUCCESS|FAILED|BLOCKED
  attempt_count int not null default 0,
  last_attempt_at timestamptz null,
  last_error text null,
  external_result_json jsonb null,
  external_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  unique(provider, export_type, payload_hash)
);
create index if not exists accounting_exports_status_created_at_idx on public.accounting_exports (status, created_at);
create index if not exists accounting_exports_source_entity_id_idx on public.accounting_exports (source_entity_id);

-- RLS policies using public.current_app_role()
alter table public.integration_connections enable row level security;
alter table public.integration_connections force row level security;
drop policy if exists "integration_connections_select_all" on public.integration_connections;
create policy "integration_connections_select_all"
on public.integration_connections
for select
to authenticated
using (true);
drop policy if exists "integration_connections_write_admin_only" on public.integration_connections;
create policy "integration_connections_write_admin_only"
on public.integration_connections
for all
to authenticated
using (public.current_app_role() = 'ADMIN')
with check (public.current_app_role() = 'ADMIN');

alter table public.accounting_integration_config enable row level security;
alter table public.accounting_integration_config force row level security;
drop policy if exists "accounting_integration_config_select_all" on public.accounting_integration_config;
create policy "accounting_integration_config_select_all"
on public.accounting_integration_config
for select
to authenticated
using (true);
drop policy if exists "accounting_integration_config_write_admin_only" on public.accounting_integration_config;
create policy "accounting_integration_config_write_admin_only"
on public.accounting_integration_config
for all
to authenticated
using (public.current_app_role() = 'ADMIN')
with check (public.current_app_role() = 'ADMIN');

alter table public.external_references enable row level security;
alter table public.external_references force row level security;
drop policy if exists "external_references_select_all" on public.external_references;
create policy "external_references_select_all"
on public.external_references
for select
to authenticated
using (true);
drop policy if exists "external_references_write_admin_only" on public.external_references;
create policy "external_references_write_admin_only"
on public.external_references
for all
to authenticated
using (public.current_app_role() = 'ADMIN')
with check (public.current_app_role() = 'ADMIN');

alter table public.accounting_exports enable row level security;
alter table public.accounting_exports force row level security;
drop policy if exists "accounting_exports_select_all" on public.accounting_exports;
create policy "accounting_exports_select_all"
on public.accounting_exports
for select
to authenticated
using (true);
drop policy if exists "accounting_exports_write_admin_only" on public.accounting_exports;
create policy "accounting_exports_write_admin_only"
on public.accounting_exports
for all
to authenticated
using (public.current_app_role() = 'ADMIN')
with check (public.current_app_role() = 'ADMIN');

-- Helper RPC to queue invoice export without relaxing RLS on accounting_exports
drop function if exists public.queue_invoice_export(uuid);
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
    'provider', 'quickbooks',
    'source', jsonb_build_object(
      'type', 'INVOICE',
      'id', inv.id,
      'number', coalesce(inv.invoice_number, inv.id::text),
      'date', coalesce(inv.invoice_date, inv.issued_at, inv.created_at)
    ),
    'customer', jsonb_build_object(
      'shopflow_customer_id', inv.customer_id,
      'display_name', coalesce(inv.company_name, inv.name, inv.full_name, 'Unknown Customer')
    ),
    'lines', jsonb_build_array(
      jsonb_build_object(
        'kind', 'LABOR',
        'amount', coalesce(inv.subtotal_labor, 0),
        'account_ref', cfg.income_account_labor
      ),
      jsonb_build_object(
        'kind', 'PARTS',
        'amount', coalesce(inv.subtotal_parts, 0),
        'account_ref', cfg.income_account_parts
      ),
      jsonb_build_object(
        'kind', 'FEES_SUBLET',
        'amount', coalesce(inv.subtotal_fees, 0),
        'account_ref', coalesce(cfg.income_account_fees, cfg.income_account_sublet)
      )
    ),
    'tax', jsonb_build_object(
      'amount', coalesce(inv.tax_amount, 0),
      'liability_account_ref', cfg.liability_account_sales_tax
    ),
    'total', coalesce(inv.total, coalesce(inv.subtotal_labor,0) + coalesce(inv.subtotal_parts,0) + coalesce(inv.subtotal_fees,0) + coalesce(inv.tax_amount,0))
  );

  payload_hash := encode(digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex');

  begin
    insert into public.accounting_exports (
      provider,
      export_type,
      source_entity_type,
      source_entity_id,
      payload_json,
      payload_hash,
      status
    ) values (
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

-- Generic RPC to queue accounting export without widening table RLS
drop function if exists public.queue_accounting_export_v1(text, text, text, uuid, jsonb, text);
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
      provider,
      export_type,
      source_entity_type,
      source_entity_id,
      payload_json,
      payload_hash,
      status,
      attempt_count
    ) values (
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

-- Payment export RPC (v1) with config gating
drop function if exists public.queue_payment_export_v1(uuid);
create or replace function public.queue_payment_export_v1(payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg record;
  p record;
  inv record;
  payload jsonb;
  payload_hash text;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  select *
  into cfg
  from public.accounting_integration_config
  where provider = 'quickbooks'
  limit 1;

  if cfg is null or cfg.is_enabled is not true then
    return jsonb_build_object('status', 'skipped');
  end if;

  if coalesce(cfg.export_trigger, '') not like '%ON_PAYMENT_RECORDED%' then
    return jsonb_build_object('status', 'skipped');
  end if;

  if cfg.mode is distinct from 'INVOICE_AND_PAYMENTS' then
    return jsonb_build_object('status', 'skipped', 'reason', 'mode_disabled');
  end if;

  select *
  into p
  from public.payments
  where id = payment_id;

  if p is null then
    return jsonb_build_object('status', 'failed', 'error', 'payment_not_found');
  end if;

  -- attempt to load linked invoice if column exists
  begin
    select *
    into inv
    from public.invoices i
    where i.id = (p).invoice_id;
  exception
    when undefined_column then
      inv := null;
  end;

  payload := jsonb_build_object(
    'schema_version', 1,
    'provider', 'quickbooks',
    'source', jsonb_build_object(
      'type', 'PAYMENT',
      'id', p.id,
      'date', coalesce((p).created_at, now()),
      'reference', (p).reference
    ),
    'invoice', jsonb_build_object(
      'id', coalesce((p).invoice_id, inv.id),
      'number', coalesce(inv.invoice_number, inv.id::text, (p).invoice_id::text)
    ),
    'amount', coalesce((p).amount, 0),
    'method', (p).method,
    'clearing_account_ref', cfg.clearing_account_undeposited_funds
  );

  payload_hash := encode(digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex');

  begin
    insert into public.accounting_exports (
      provider,
      export_type,
      source_entity_type,
      source_entity_id,
      payload_json,
      payload_hash,
      status,
      attempt_count
    ) values (
      'quickbooks',
      'PAYMENT',
      'payment',
      payment_id,
      payload,
      payload_hash,
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

grant execute on function public.queue_payment_export_v1(uuid) to authenticated;

-- Phase 2A.1: Tenant-level QuickBooks connection storage
create table if not exists public.quickbooks_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  realm_id text null,
  status text not null default 'DISCONNECTED',
  access_token_enc text null,
  refresh_token_enc text null,
  expires_at timestamptz null,
  scope text null,
  company_name text null,
  connected_by uuid null,
  connected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id)
);

create table if not exists public.quickbooks_customer_map (
  tenant_id uuid not null,
  customer_id uuid not null,
  qb_customer_id text not null,
  created_at timestamptz not null default now(),
  unique(tenant_id, customer_id),
  unique(tenant_id, qb_customer_id)
);

-- Enhance accounting_exports for live-send auditing
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='accounting_exports' and column_name='remote_id') then
    alter table public.accounting_exports add column remote_id text null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='accounting_exports' and column_name='provider_meta_json') then
    alter table public.accounting_exports add column provider_meta_json jsonb null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='accounting_exports' and column_name='sent_at') then
    alter table public.accounting_exports add column sent_at timestamptz null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='accounting_exports' and column_name='next_attempt_at') then
    alter table public.accounting_exports add column next_attempt_at timestamptz null;
  end if;
end$$;

create index if not exists accounting_exports_poll_idx on public.accounting_exports (provider, status, export_type, next_attempt_at);

-- RLS for quickbooks_connections (restrict token access)
alter table public.quickbooks_connections enable row level security;
alter table public.quickbooks_connections force row level security;
drop policy if exists "quickbooks_connections_select_admin" on public.quickbooks_connections;
create policy "quickbooks_connections_select_admin"
on public.quickbooks_connections
for select
to authenticated
using (public.current_app_role() = 'ADMIN');
drop policy if exists "quickbooks_connections_write_service_only" on public.quickbooks_connections;
create policy "quickbooks_connections_write_service_only"
on public.quickbooks_connections
for all
to authenticated
using (false)
with check (false);

-- RLS for quickbooks_customer_map
alter table public.quickbooks_customer_map enable row level security;
alter table public.quickbooks_customer_map force row level security;
drop policy if exists "quickbooks_customer_map_select_admin" on public.quickbooks_customer_map;
create policy "quickbooks_customer_map_select_admin"
on public.quickbooks_customer_map
for select
to authenticated
using (public.current_app_role() = 'ADMIN');
drop policy if exists "quickbooks_customer_map_write_service_only" on public.quickbooks_customer_map;
create policy "quickbooks_customer_map_write_service_only"
on public.quickbooks_customer_map
for all
to authenticated
using (false)
with check (false);

-- UI-safe view for connection status (no tokens)
drop view if exists public.v_quickbooks_connection_status;
create view public.v_quickbooks_connection_status as
select
  tenant_id,
  status,
  realm_id,
  company_name,
  connected_at,
  expires_at
from public.quickbooks_connections;
