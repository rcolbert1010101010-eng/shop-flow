begin;

alter table public.accounting_integration_config
  add column if not exists qb_customer_ref text,
  add column if not exists qb_item_ref_parts text,
  add column if not exists qb_item_ref_labor text,
  add column if not exists qb_item_ref_fees_sublet text;

commit;
