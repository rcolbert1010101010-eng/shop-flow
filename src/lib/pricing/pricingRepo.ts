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
  category_code?: string | null;
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
    row.category_code ??
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

export async function fetchPricingRulesForTenant(): Promise<PricingRule[]> {
  const { data, error } = await supabase.rpc('fetch_pricing_rules_for_current_tenant');

  if (error) {
    console.error('Error fetching pricing rules', error);
    throw new Error(`pricing_rules fetch failed: ${error.message ?? 'Unknown error'}`);
  }

  return (data ?? []).map((row) => mapPricingRule(row as DbPricingRuleRow));
}

export async function fetchCustomerPricingProfile(
  customerId: string
): Promise<{ profileType: CustomerType; discountPercent: number } | null> {
  const { data, error } = await supabase
    .rpc('fetch_customer_pricing_profile_for_current_tenant', {
      p_customer_id: customerId,
    })
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
