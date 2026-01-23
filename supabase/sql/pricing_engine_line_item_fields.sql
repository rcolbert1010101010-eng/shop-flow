alter table if exists public.work_order_part_lines
  add column if not exists unit_cost_snapshot numeric(12,4) null,
  add column if not exists suggested_unit_price numeric(12,4) null,
  add column if not exists pricing_rule_ids uuid[] null,
  add column if not exists pricing_scopes text[] null,
  add column if not exists pricing_flags text[] null,
  add column if not exists pricing_explanation text null,
  add column if not exists price_overridden boolean not null default false,
  add column if not exists price_override_reason text null,
  add column if not exists price_overridden_by_user_id uuid null,
  add column if not exists price_override_approval_required boolean not null default false,
  add column if not exists price_approved_by_user_id uuid null,
  add column if not exists priced_at timestamptz not null default now();

alter table if exists public.sales_order_lines
  add column if not exists unit_cost_snapshot numeric(12,4) null,
  add column if not exists suggested_unit_price numeric(12,4) null,
  add column if not exists pricing_rule_ids uuid[] null,
  add column if not exists pricing_scopes text[] null,
  add column if not exists pricing_flags text[] null,
  add column if not exists pricing_explanation text null,
  add column if not exists price_overridden boolean not null default false,
  add column if not exists price_override_reason text null,
  add column if not exists price_overridden_by_user_id uuid null,
  add column if not exists price_override_approval_required boolean not null default false,
  add column if not exists price_approved_by_user_id uuid null,
  add column if not exists priced_at timestamptz not null default now();

create index if not exists idx_work_order_part_lines_priced_at_desc
  on public.work_order_part_lines (priced_at desc);

create index if not exists idx_sales_order_lines_priced_at_desc
  on public.sales_order_lines (priced_at desc);
