export type PricingScope = "SPECIAL_ORDER" | "CATEGORY" | "CUSTOMER_TYPE" | "GLOBAL";
export type CustomerType = "RETAIL" | "FLEET" | "GOV" | "WHOLESALE";

export type PricingRule = {
  id?: string;
  scope: PricingScope;
  priority: number;
  categoryCode?: string | null;
  customerType?: CustomerType | null;
  costMin: number;
  costMax: number;
  markupPercent: number;
  minMarginDollars: number;
  maxMarkupPercent?: number | null;
  msrpCapPercent?: number | null;
  isActive?: boolean;
};

export type ResolvePriceInput = {
  cost: number;
  msrp?: number | null;
  categoryCode?: string | null;
  customerType?: CustomerType | null;
  isSpecialOrder?: boolean;
  rules: PricingRule[];
};

export type ResolvePriceResult = {
  unitPrice: number;
  marginDollars: number;
  marginPercent: number | null;
  appliedRuleIds: string[];
  appliedScopes: PricingScope[];
  flags: string[];
  explanation: string;
};

type RuleWithIndex = PricingRule & { __index: number };

const isNumber = (value: number) => Number.isFinite(value);

const roundCurrency = (value: number) =>
  Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));

const matchesCost = (rule: PricingRule, cost: number) =>
  cost >= rule.costMin && cost <= rule.costMax;

const selectBestRule = (rules: RuleWithIndex[]) =>
  rules
    .slice()
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      const rangeA = a.costMax - a.costMin;
      const rangeB = b.costMax - b.costMin;
      if (rangeA !== rangeB) {
        return rangeA - rangeB;
      }
      return a.__index - b.__index;
    })[0] ?? null;

const describeBaseRule = (rule: PricingRule) => {
  if (rule.scope === "CATEGORY") {
    return `CATEGORY(${rule.categoryCode ?? "UNSPECIFIED"})`;
  }
  if (rule.scope === "CUSTOMER_TYPE") {
    return `CUSTOMER_TYPE(${rule.customerType ?? "UNSPECIFIED"})`;
  }
  return rule.scope;
};

export const resolvePartPrice = (input: ResolvePriceInput): ResolvePriceResult => {
  const { cost, msrp, categoryCode, customerType, isSpecialOrder, rules } = input;
  const normalizedCategory = categoryCode?.toUpperCase() ?? null;
  const normalizedCustomerType = customerType ?? null;

  if (!isNumber(cost) || cost < 0) {
    throw new Error("Cost must be a non-negative number.");
  }

  const activeRules = rules
    .map((rule, index) => ({ ...rule, __index: index }))
    .filter((rule) => rule.isActive !== false);

  const categoryRules = activeRules.filter(
    (rule) =>
      rule.scope === "CATEGORY" &&
      matchesCost(rule, cost) &&
      rule.categoryCode != null &&
      (rule.categoryCode ?? "").toUpperCase() === (normalizedCategory ?? "")
  );

  const customerTypeRules = activeRules.filter(
    (rule) =>
      rule.scope === "CUSTOMER_TYPE" &&
      matchesCost(rule, cost) &&
      rule.customerType != null &&
      rule.customerType === normalizedCustomerType
  );

  const globalRules = activeRules.filter(
    (rule) => rule.scope === "GLOBAL" && matchesCost(rule, cost)
  );

  const baseRule =
    selectBestRule(categoryRules) ??
    selectBestRule(customerTypeRules) ??
    selectBestRule(globalRules);

  if (!baseRule) {
    throw new Error("No pricing rule found for the provided cost.");
  }

  const specialOrderRule =
    isSpecialOrder === true
      ? selectBestRule(
          activeRules.filter(
            (rule) => rule.scope === "SPECIAL_ORDER" && matchesCost(rule, cost)
          )
        )
      : null;

  let markupPercent = baseRule.markupPercent;
  let minMarginDollars = baseRule.minMarginDollars;
  let maxMarkupPercent = baseRule.maxMarkupPercent ?? null;
  let msrpCapPercent = baseRule.msrpCapPercent ?? null;

  const appliedRuleIds: string[] = [];
  const appliedScopes: PricingScope[] = [];
  const flags: string[] = [];

  if (baseRule.id) {
    appliedRuleIds.push(baseRule.id);
  }
  appliedScopes.push(baseRule.scope);

  if (specialOrderRule) {
    markupPercent += specialOrderRule.markupPercent;
    minMarginDollars += specialOrderRule.minMarginDollars;
    const soMax = specialOrderRule.maxMarkupPercent ?? null;
    maxMarkupPercent =
      maxMarkupPercent == null
        ? soMax
        : soMax == null
          ? maxMarkupPercent
          : Math.min(maxMarkupPercent, soMax);

    const soMsrpCap = specialOrderRule.msrpCapPercent ?? null;
    msrpCapPercent =
      msrpCapPercent == null
        ? soMsrpCap
        : soMsrpCap == null
          ? msrpCapPercent
          : Math.min(msrpCapPercent, soMsrpCap);

    if (specialOrderRule.id) {
      appliedRuleIds.push(specialOrderRule.id);
    }
    appliedScopes.push("SPECIAL_ORDER");
    flags.push("SPECIAL_ORDER_ADDITIVE");
  }

  let unitPrice = cost * (1 + markupPercent / 100);

  const minAllowed = cost + minMarginDollars;
  if (unitPrice < minAllowed) {
    unitPrice = minAllowed;
    flags.push("MIN_MARGIN_ENFORCED");
  }

  if (maxMarkupPercent != null) {
    const maxAllowedByMarkup = cost * (1 + maxMarkupPercent / 100);
    if (unitPrice > maxAllowedByMarkup) {
      unitPrice = maxAllowedByMarkup;
      flags.push("MAX_MARKUP_CAPPED");
    }
  }

  if (msrp != null && msrpCapPercent != null) {
    const msrpAllowed = msrp * (msrpCapPercent / 100);
    if (unitPrice > msrpAllowed) {
      unitPrice = msrpAllowed;
      flags.push("MSRP_CAP_APPLIED");
    }
  }

  unitPrice = roundCurrency(unitPrice);
  const marginDollars = roundCurrency(unitPrice - cost);
  const marginPercent = cost > 0 ? roundCurrency((marginDollars / cost) * 100) : null;

  const explanationParts = [
    `Base rule: ${describeBaseRule(baseRule)}`,
    specialOrderRule ? "Special order applied" : "No special order",
  ];
  if (flags.length > 0) {
    explanationParts.push(`Flags: ${flags.join(", ")}`);
  }

  return {
    unitPrice,
    marginDollars,
    marginPercent,
    appliedRuleIds,
    appliedScopes,
    flags,
    explanation: explanationParts.join(". "),
  };
};

/* examples
cost=0.50, category=HARDWARE, retail, not special => should hit min margin and produce >= 3.50 (based on tiers once rules are supplied)
cost=1500, category=ELECTRONICS => should select electronics override and respect caps if set
*/
