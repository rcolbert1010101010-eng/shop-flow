begin;

alter table public.accounting_integration_config
  add column if not exists mode text,
  add column if not exists calculation_source text not null default 'SHOPFLOW',
  add column if not exists auto_create_customers boolean not null default true,
  add column if not exists start_export_from_date date,
  add column if not exists default_terms_name text,
  add column if not exists default_deposit_item_name text,
  add column if not exists class_tracking_enabled boolean not null default false,
  add column if not exists default_class_name text,
  add column if not exists clearing_account_undeposited_funds text,
  add column if not exists line_item_strategy text not null default 'ROLLUP',
  add column if not exists customer_match_strategy text not null default 'DISPLAY_NAME',
  add column if not exists customer_name_format text;

update public.accounting_integration_config
set
  mode = coalesce(mode, 'INVOICE_ONLY'),
  calculation_source = coalesce(calculation_source, 'SHOPFLOW'),
  auto_create_customers = coalesce(auto_create_customers, true),
  class_tracking_enabled = coalesce(class_tracking_enabled, false),
  line_item_strategy = coalesce(line_item_strategy, 'ROLLUP'),
  customer_match_strategy = coalesce(customer_match_strategy, 'DISPLAY_NAME'),
  customer_name_format = coalesce(customer_name_format, '{{companyName}}')
where
  mode is null
  or calculation_source is null
  or auto_create_customers is null
  or class_tracking_enabled is null
  or line_item_strategy is null
  or customer_match_strategy is null
  or customer_name_format is null;

alter table public.accounting_integration_config
  alter column mode set default 'INVOICE_ONLY',
  alter column calculation_source set default 'SHOPFLOW',
  alter column auto_create_customers set default true,
  alter column class_tracking_enabled set default false,
  alter column line_item_strategy set default 'ROLLUP',
  alter column customer_match_strategy set default 'DISPLAY_NAME',
  alter column customer_name_format set default '{{companyName}}';

alter table public.accounting_integration_config
  alter column mode set not null,
  alter column calculation_source set not null,
  alter column auto_create_customers set not null,
  alter column class_tracking_enabled set not null,
  alter column line_item_strategy set not null,
  alter column customer_match_strategy set not null,
  alter column customer_name_format set not null;

commit;
