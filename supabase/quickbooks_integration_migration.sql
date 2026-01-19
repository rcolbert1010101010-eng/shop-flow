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
