-- Phase 6 Pricing Engine Core
-- Evaluation order: SPECIAL_ORDER -> CATEGORY -> CUSTOMER_TYPE -> GLOBAL.
-- Resolver enforces min margin + caps (max markup % and MSRP cap %).

create table if not exists pricing_categories (
  id uuid primary key default gen_random_uuid(),
  -- TODO: link tenant_id to tenants table when available.
  tenant_id uuid null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_pricing_categories_tenant_code
  on pricing_categories (tenant_id, code)
  where tenant_id is not null;

create unique index if not exists idx_pricing_categories_code_global
  on pricing_categories (code)
  where tenant_id is null;

create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  -- TODO: link tenant_id to tenants table when available.
  tenant_id uuid null,
  name text not null,
  scope text not null check (scope in ('GLOBAL', 'CATEGORY', 'CUSTOMER_TYPE', 'SPECIAL_ORDER')),
  category_id uuid null references pricing_categories(id),
  customer_type text null check (customer_type in ('RETAIL', 'FLEET', 'GOV', 'WHOLESALE')),
  cost_min numeric(12,4) not null,
  cost_max numeric(12,4) not null,
  markup_percent numeric(9,4) not null,
  min_margin_dollars numeric(12,4) not null,
  max_markup_percent numeric(9,4) null,
  msrp_cap_percent numeric(9,4) null,
  priority int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_pricing_rules_tenant_id
  on pricing_rules (tenant_id);

create index if not exists idx_pricing_rules_tenant_scope_priority
  on pricing_rules (tenant_id, scope, priority);

create index if not exists idx_pricing_rules_tenant_cost_range
  on pricing_rules (tenant_id, cost_min, cost_max);

create index if not exists idx_pricing_rules_category_id
  on pricing_rules (category_id);

create index if not exists idx_pricing_rules_customer_type
  on pricing_rules (customer_type);

create table if not exists customer_pricing_profiles (
  id uuid primary key default gen_random_uuid(),
  -- TODO: link tenant_id to tenants table when available.
  tenant_id uuid null,
  customer_id uuid not null references customers(id),
  profile_type text not null check (profile_type in ('RETAIL', 'FLEET', 'GOV', 'WHOLESALE')),
  discount_percent numeric(9,4) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_customer_pricing_profiles_tenant_customer
  on customer_pricing_profiles (tenant_id, customer_id)
  where tenant_id is not null;

create unique index if not exists idx_customer_pricing_profiles_customer_global
  on customer_pricing_profiles (customer_id)
  where tenant_id is null;

create table if not exists pricing_override_log (
  id uuid primary key default gen_random_uuid(),
  -- TODO: link tenant_id to tenants table when available.
  tenant_id uuid null,
  order_type text not null check (order_type in ('WO', 'SO')),
  order_id uuid not null,
  line_id uuid not null,
  part_id uuid null references parts(id),
  old_price numeric(12,4) not null,
  new_price numeric(12,4) not null,
  old_margin numeric(12,4) null,
  new_margin numeric(12,4) null,
  override_reason text not null,
  overridden_by_user_id uuid null,
  approval_required boolean not null default false,
  approved_by_user_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pricing_override_log_order_id
  on pricing_override_log (order_id);

create index if not exists idx_pricing_override_log_line_id
  on pricing_override_log (line_id);

create index if not exists idx_pricing_override_log_created_at_desc
  on pricing_override_log (created_at desc);

create index if not exists idx_pricing_override_log_tenant_id
  on pricing_override_log (tenant_id);

alter table if exists parts
  add column if not exists pricing_category_id uuid null references pricing_categories(id);

do $$
begin
  if to_regclass('public.parts') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'parts'
        and column_name = 'tenant_id'
    ) then
      create index if not exists idx_parts_tenant_pricing_category_id
        on parts (tenant_id, pricing_category_id);
    else
      create index if not exists idx_parts_pricing_category_id
        on parts (pricing_category_id);
    end if;
  end if;
end $$;

-- Seed default categories (global/default tenant)
insert into pricing_categories (tenant_id, code, name)
select null, v.code, v.name
from (values
  ('GENERAL', 'General'),
  ('HARDWARE', 'Hardware'),
  ('FLUIDS', 'Fluids'),
  ('ELECTRONICS', 'Electronics'),
  ('CONSUMABLE', 'Consumable')
) as v(code, name)
where not exists (
  select 1
  from pricing_categories c
  where c.tenant_id is null
    and c.code = v.code
);

insert into pricing_rules (
  tenant_id,
  name,
  scope,
  category_id,
  customer_type,
  cost_min,
  cost_max,
  markup_percent,
  min_margin_dollars,
  max_markup_percent,
  msrp_cap_percent,
  priority
)
select
  null,
  rules.name,
  rules.scope,
  rules.category_id,
  rules.customer_type,
  rules.cost_min,
  rules.cost_max,
  rules.markup_percent,
  rules.min_margin_dollars,
  rules.max_markup_percent,
  rules.msrp_cap_percent,
  rules.priority
from (
  values
    ('GLOBAL Tier 1', 'GLOBAL', null, null, 0.00, 0.99, 400.0000, 3.0000, null, null, 100),
    ('GLOBAL Tier 2', 'GLOBAL', null, null, 1.00, 9.99, 200.0000, 5.0000, null, null, 100),
    ('GLOBAL Tier 3', 'GLOBAL', null, null, 10.00, 49.99, 100.0000, 10.0000, null, null, 100),
    ('GLOBAL Tier 4', 'GLOBAL', null, null, 50.00, 249.99, 60.0000, 25.0000, null, null, 100),
    ('GLOBAL Tier 5', 'GLOBAL', null, null, 250.00, 999.99, 40.0000, 50.0000, null, null, 100),
    ('GLOBAL Tier 6', 'GLOBAL', null, null, 1000.00, 999999.00, 25.0000, 100.0000, 35.0000, null, 100)
) as rules (
  name,
  scope,
  category_id,
  customer_type,
  cost_min,
  cost_max,
  markup_percent,
  min_margin_dollars,
  max_markup_percent,
  msrp_cap_percent,
  priority
)
where not exists (
  select 1
  from pricing_rules existing
  where existing.tenant_id is null
    and existing.scope = rules.scope
    and existing.cost_min = rules.cost_min
    and existing.cost_max = rules.cost_max
);

-- Resolver treats SPECIAL_ORDER as additive surcharge.
insert into pricing_rules (
  tenant_id,
  name,
  scope,
  category_id,
  customer_type,
  cost_min,
  cost_max,
  markup_percent,
  min_margin_dollars,
  max_markup_percent,
  msrp_cap_percent,
  priority
)
select
  null,
  'SPECIAL_ORDER Surcharge',
  'SPECIAL_ORDER',
  null,
  null,
  0.00,
  999999.00,
  10.0000,
  25.0000,
  null,
  null,
  1
where not exists (
  select 1
  from pricing_rules existing
  where existing.tenant_id is null
    and existing.scope = 'SPECIAL_ORDER'
    and existing.cost_min = 0.00
    and existing.cost_max = 999999.00
);

with electronics_category as (
  select id
  from pricing_categories
  where code = 'ELECTRONICS'
    and tenant_id is null
)
insert into pricing_rules (
  tenant_id,
  name,
  scope,
  category_id,
  customer_type,
  cost_min,
  cost_max,
  markup_percent,
  min_margin_dollars,
  max_markup_percent,
  msrp_cap_percent,
  priority
)
select
  null,
  'ELECTRONICS Override',
  'CATEGORY',
  electronics_category.id,
  null,
  0.00,
  999999.00,
  25.0000,
  75.0000,
  30.0000,
  null,
  10
from electronics_category
where not exists (
  select 1
  from pricing_rules existing
  where existing.tenant_id is null
    and existing.scope = 'CATEGORY'
    and existing.category_id = electronics_category.id
    and existing.cost_min = 0.00
    and existing.cost_max = 999999.00
);
