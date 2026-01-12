import type {
  Customer,
  Part,
  SalesOrder,
  SalesOrderChargeLine,
  SalesOrderLine,
  WorkOrder,
  WorkOrderChargeLine,
  WorkOrderLaborLine,
  WorkOrderPartLine,
} from '@/types';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatMoney = (value: number | string | null | undefined) => `$${toNumber(value).toFixed(2)}`;

const buildUnitLabel = (unit?: { unit_name?: string | null; vin?: string | null; year?: number | null; make?: string | null; model?: string | null }) => {
  if (!unit) return '';
  const parts = [unit?.year, unit?.make, unit?.model].filter(Boolean).join(' ');
  return unit?.unit_name || parts || unit?.vin || '';
};

export function summarizeWorkOrder(input: {
  order: WorkOrder;
  customer?: Customer;
  unit?: { unit_name?: string | null; vin?: string | null; year?: number | null; make?: string | null; model?: string | null };
  partLines?: WorkOrderPartLine[];
  laborLines?: WorkOrderLaborLine[];
  chargeLines?: WorkOrderChargeLine[];
}) {
  const { order, customer, unit, partLines = [], laborLines = [], chargeLines = [] } = input;
  const unitLabel = buildUnitLabel(unit);
  const partsCount = partLines.length;
  const laborHours = laborLines.reduce((sum, l) => sum + (l.hours || 0), 0);
  const chargesCount = chargeLines.length;
  const total = order.total ?? order.subtotal ?? order.parts_subtotal ?? 0;
  return [
    `Work Order ${order.order_number || ''} for ${customer?.company_name || 'customer'}`,
    unitLabel ? `(${unitLabel})` : '',
    `is ${order.status || 'in progress'}.`,
    `Includes ${partsCount} part lines, ${laborHours.toFixed(1)} labor hours,`,
    `${chargesCount} other charges.`,
    `Estimated total ${formatMoney(total)}.`,
  ]
    .filter(Boolean)
    .join(' ');
}

export function summarizeSalesOrder(input: {
  order: SalesOrder;
  customer?: Customer;
  unit?: { unit_name?: string | null; vin?: string | null; year?: number | null; make?: string | null; model?: string | null };
  lines?: SalesOrderLine[];
  chargeLines?: SalesOrderChargeLine[];
}) {
  const { order, customer, unit, lines = [], chargeLines = [] } = input;
  const unitLabel = buildUnitLabel(unit);
  const total = order.total ?? order.subtotal ?? 0;
  return [
    `Sales Order ${order.order_number || ''} for ${customer?.company_name || 'customer'}`,
    unitLabel ? `(${unitLabel})` : '',
    `is ${order.status || 'open'}.`,
    `Contains ${lines.length} item lines and ${chargeLines.length} fees.`,
    `Estimated total ${formatMoney(total)}.`,
  ]
    .filter(Boolean)
    .join(' ');
}

export function rewriteCustomerSafe(text: string): string {
  const replacements: Record<string, string> = {
    'asap': 'as soon as possible',
    'asap.': 'as soon as possible.',
    'asap!': 'as soon as possible.',
    'w/': 'with',
    'w/o': 'without',
  };
  let cleaned = text.trim().replace(/\s+/g, ' ');
  Object.entries(replacements).forEach(([key, value]) => {
    cleaned = cleaned.replace(new RegExp(`\\b${key}\\b`, 'gi'), value);
  });
  cleaned = cleaned.replace(/damn|hell|shit|crap/gi, '[removed]');
  if (cleaned.length === 0) return 'No note provided.';
  const sentences = cleaned
    .split(/([.!?])\s*/g)
    .reduce((acc: string[], part) => {
      if (!part) return acc;
      const last = acc.pop();
      if (!last) {
        acc.push(part);
      } else if (['.', '!', '?'].includes(part)) {
        acc.push(last + part);
      } else {
        acc.push(last, part);
      }
      return acc;
    }, [])
    .filter(Boolean)
    .map((s) => s.trim())
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  return sentences.join(' ').trim();
}

export function explainOrder(orderLike: Partial<{
  parts_subtotal: number;
  labor_subtotal: number;
  charge_subtotal: number;
  core_charges_total: number;
  tax_amount: number;
  tax_rate: number;
  subtotal: number;
  total: number;
  estimate_total: number;
}>) {
  const parts = toNumber(orderLike.parts_subtotal);
  const labor = toNumber(orderLike.labor_subtotal);
  const charges = toNumber(orderLike.charge_subtotal) + toNumber(orderLike.core_charges_total);
  const tax = toNumber(orderLike.tax_amount);
  const subtotal = toNumber(orderLike.subtotal || orderLike.estimate_total || parts + labor + charges);
  const total = toNumber(orderLike.total || subtotal + tax);

  const sections = [
    parts ? `Parts cover materials and components: ${formatMoney(parts)}.` : '',
    labor ? `Labor covers technician time: ${formatMoney(labor)}.` : '',
    charges ? `Additional fees/charges: ${formatMoney(charges)}.` : '',
    tax ? `Taxes calculated at ${orderLike.tax_rate ?? 'n/a'}%: ${formatMoney(tax)}.` : '',
    `Total due: ${formatMoney(total)}.`,
  ];
  return sections.filter(Boolean).join(' ');
}

export function suggestParts(query: string, parts: Part[]) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = parts.map((part) => {
    const number = part.part_number?.toLowerCase() || '';
    const desc = part.description?.toLowerCase() || '';
    let score = 0;
    let reason = '';

    if (number.startsWith(q)) {
      score += 5;
      reason = 'Starts with query';
    } else if (number.includes(q)) {
      score += 3;
      reason = 'Matches part #';
    }
    if (desc.includes(q)) {
      score += 3;
      reason = reason || 'Matches description';
    }
    const tokenHits = tokens.reduce((acc, t) => acc + (desc.includes(t) || number.includes(t) ? 1 : 0), 0);
    if (tokenHits) {
      score += tokenHits;
      if (!reason) reason = 'Similar keywords';
    }
    return { part, score, reason: reason || 'Close match' };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => ({
      id: s.part.id,
      partNumber: s.part.part_number,
      description: s.part.description || '',
      score: s.score,
      reason: s.reason,
    }));
}

export function inventoryInsights(input: { parts: Part[]; workOrders: WorkOrder[]; salesOrders: SalesOrder[] }): string[] {
  const insights: string[] = [];
  const lowStock = input.parts.filter((p) => p.is_active && p.min_qty != null && p.quantity_on_hand <= p.min_qty);
  if (lowStock.length > 0) {
    insights.push(`${lowStock.length} parts are at/below min; consider replenishing soon.`);
  }

  const openWip = input.workOrders.filter((wo) => wo.status === 'OPEN' || wo.status === 'IN_PROGRESS');
  if (openWip.length > 0) {
    const total = openWip.reduce((sum, wo) => sum + toNumber(wo.total || wo.subtotal), 0);
    insights.push(`Open WIP: ${openWip.length} work orders, approx ${formatMoney(total)} in value.`);
  }

  const pendingSales = input.salesOrders.filter((so) => so.status === 'OPEN' || so.status === 'PARTIAL');
  if (pendingSales.length > 0) {
    insights.push(`Sales pipeline: ${pendingSales.length} active orders; keep an eye on fulfillment.`);
  }

  if (insights.length === 0) {
    insights.push('Connect data feeds to enable insights.');
  }

  return insights;
}
