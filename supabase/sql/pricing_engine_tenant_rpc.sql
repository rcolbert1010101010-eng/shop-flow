begin;

create or replace function public.fetch_pricing_rules_for_current_tenant()
returns table (
  id uuid,
  scope text,
  priority int,
  category_id uuid,
  customer_type text,
  cost_min numeric,
  cost_max numeric,
  markup_percent numeric,
  min_margin_dollars numeric,
  max_markup_percent numeric,
  msrp_cap_percent numeric,
  is_active boolean,
  category_code text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.id,
    pr.scope,
    pr.priority,
    pr.category_id,
    pr.customer_type,
    pr.cost_min,
    pr.cost_max,
    pr.markup_percent,
    pr.min_margin_dollars,
    pr.max_markup_percent,
    pr.msrp_cap_percent,
    pr.is_active,
    pc.code as category_code
  from public.pricing_rules pr
  left join public.pricing_categories pc
    on pc.id = pr.category_id
  where pr.is_active = true
    and (pr.tenant_id = public.current_tenant_id() or pr.tenant_id is null);
$$;

grant execute on function public.fetch_pricing_rules_for_current_tenant() to authenticated;

create or replace function public.fetch_customer_pricing_profile_for_current_tenant(p_customer_id uuid)
returns table (
  profile_type text,
  discount_percent numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cpp.profile_type,
    cpp.discount_percent
  from public.customer_pricing_profiles cpp
  where cpp.customer_id = p_customer_id
    and cpp.tenant_id = public.current_tenant_id()
    and cpp.is_active = true
  limit 1;
$$;

grant execute on function public.fetch_customer_pricing_profile_for_current_tenant(uuid) to authenticated;

commit;
