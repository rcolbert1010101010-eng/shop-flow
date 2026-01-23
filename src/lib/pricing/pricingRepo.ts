import { supabase } from '@/integrations/supabase/client';
import type { CustomerType, PricingRule } from './resolvePartPrice';

export type DbPricingCategoryRow = {
  id: string;
  code: string;
  tenant_id?: string | null;
};

export type DbPricingRuleRow = {
  id: string;
  scope: PricingRule['scope'];
  priority: number | string;
  category_id?: string | null;
  customer_type?: CustomerType | null;
  cost_min: number | string;
  cost_max: number | string;
  markup_percent: number | string;
  min_margin_dollars: number | string;
  max_markup_percent?: number | string | null;
  msrp_cap_percent?: number | string | null;
  is_active?: boolean;
  pricing_categories?: { code: string | null } | null;
};

export type DbCustomerPricingProfileRow = {
  id: string;
  tenant_id?: string | null;
  customer_id: string;
  profile_type: CustomerType;
  discount_percent: number | string;
  is_active?: boolean;
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toOptionalNumber = (value: unknown) => {
  if (value == null) return null;
  const parsed = toNumber(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapPricingRule = (
  row: DbPricingRuleRow,
  categoryCodeById?: Map<string, string>
): PricingRule => ({
  id: row.id,
  scope: row.scope,
  priority: toNumber(row.priority),
  categoryCode:
    row.pricing_categories?.code ??
    (row.category_id ? categoryCodeById?.get(row.category_id) ?? null : null),
  customerType: row.customer_type ?? null,
  costMin: toNumber(row.cost_min),
  costMax: toNumber(row.cost_max),
  markupPercent: toNumber(row.markup_percent),
  minMarginDollars: toNumber(row.min_margin_dollars),
  maxMarkupPercent: toOptionalNumber(row.max_markup_percent),
  msrpCapPercent: toOptionalNumber(row.msrp_cap_percent),
  isActive: row.is_active ?? true,
});

const PRICING_RULE_SELECT =
  'id,scope,priority,category_id,customer_type,cost_min,cost_max,markup_percent,min_margin_dollars,max_markup_percent,msrp_cap_percent,is_active';

export async function fetchPricingRulesForTenant(tenantId: string): Promise<PricingRule[]> {
  const tenantOr = `tenant_id.eq.${tenantId},tenant_id.is.null`;
  const { data: joinedData, error: joinedError } = await supabase
    .from('pricing_rules')
    .select(`${PRICING_RULE_SELECT},pricing_categories(code)`)
    .or(tenantOr)
    .eq('is_active', true);

  if (!joinedError) {
    return (joinedData ?? []).map((row) => mapPricingRule(row as DbPricingRuleRow));
  }

  console.error('Error fetching pricing rules with category join', joinedError);

  const { data: rulesData, error: rulesError } = await supabase
    .from('pricing_rules')
    .select(PRICING_RULE_SELECT)
    .or(tenantOr)
    .eq('is_active', true);

  if (rulesError) {
    console.error('Error fetching pricing rules', rulesError);
    throw new Error(`pricing_rules fetch failed: ${rulesError.message ?? 'Unknown error'}`);
  }

  const { data: categoryData, error: categoryError } = await supabase
    .from('pricing_categories')
    .select('id,code,tenant_id')
    .or(tenantOr);

  if (categoryError) {
    console.error('Error fetching pricing categories', categoryError);
    throw new Error(`pricing_categories fetch failed: ${categoryError.message ?? 'Unknown error'}`);
  }

  const categoryCodeById = new Map(
    (categoryData ?? []).map((row) => [row.id, row.code])
  );

  return (rulesData ?? []).map((row) =>
    mapPricingRule(row as DbPricingRuleRow, categoryCodeById)
  );
}

export async function fetchCustomerPricingProfile(
  tenantId: string,
  customerId: string
): Promise<{ profileType: CustomerType; discountPercent: number } | null> {
  const { data, error } = await supabase
    .from('customer_pricing_profiles')
    .select('profile_type,discount_percent')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching customer pricing profile', error);
    throw new Error(error.message ?? 'Failed to fetch customer pricing profile');
  }

  if (!data) {
    return null;
  }

  return {
    profileType: data.profile_type as CustomerType,
    discountPercent: toNumber(data.discount_percent),
  };
}
