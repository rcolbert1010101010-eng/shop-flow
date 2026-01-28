alter table public.sales_orders add column if not exists order_kind text not null default 'STANDARD';

alter table public.sales_orders drop constraint if exists sales_orders_order_kind_check;
alter table public.sales_orders
  add constraint sales_orders_order_kind_check
  check (order_kind in ('STANDARD', 'PLASMA'));
