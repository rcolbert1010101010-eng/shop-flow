import type { Customer, Unit, WorkOrder, WorkOrderStatus, WorkOrderPartLine, Technician } from '@/types';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};

export type WorkOrderWithRefs = WorkOrder & {
  customerName: string;
  unitLabel: string;
};

const buildUnitLabel = (unit?: Unit) => {
  if (!unit) return '-';
  const parts = [unit.year, unit.make, unit.model].filter(Boolean).join(' ');
  return unit.unit_name || parts || unit.vin || '-';
};

export function joinWorkOrders(
  workOrders: WorkOrder[],
  customers: Customer[],
  units: Unit[]
): WorkOrderWithRefs[] {
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const unitMap = new Map(units.map((u) => [u.id, u]));

  return workOrders.map((order) => {
    const customer = customerMap.get(order.customer_id);
    const unit = unitMap.get(order.unit_id);
    return {
      ...order,
      customerName: customer?.company_name || '-',
      unitLabel: buildUnitLabel(unit),
    };
  });
}

export function getDaysOpen(createdAt: string | null | undefined, now: Date = new Date()): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  const diffMs = now.getTime() - created.getTime();
  return Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 0);
}

export function getAgingBucket(daysOpen: number): '0-2' | '3-7' | '8-14' | '15+' {
  if (daysOpen <= 2) return '0-2';
  if (daysOpen <= 7) return '3-7';
  if (daysOpen <= 14) return '8-14';
  return '15+';
}

const pickNumeric = (order: WorkOrder, keys: string[]) => {
  for (const key of keys) {
    const raw = (order as unknown as Record<string, unknown>)[key];
    const value = toNumber(raw as number | string | null | undefined);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return null;
};

export function getWipValue(order: WorkOrder): number {
  const preferred = pickNumeric(order, [
    'total',
    'grand_total',
    'total_amount',
    'total_due',
    'balance_due',
  ]);
  if (preferred !== null) return preferred;

  const estimate = pickNumeric(order, ['estimate_total', 'estimate_amount', 'subtotal', 'parts_subtotal']);
  if (estimate !== null) return estimate;

  return 0;
}

export function getPromisedDate(order: WorkOrder): string | null {
  const maybe = (order as any).promised_at ?? (order as any).promised_date ?? (order as any).due_at ?? null;
  if (!maybe) return null;
  const parsed = new Date(maybe);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function getTechnicianName(order: WorkOrder, technicians: Technician[]): string {
  const explicitName = (order as any).technician_name as string | undefined;
  if (explicitName) return explicitName;
  const techId = (order as any).technician_id as string | undefined;
  if (!techId) return '-';
  const tech = technicians.find((t) => t.id === techId);
  return tech?.name || '-';
}

export function isWaitingOnParts(
  order: WorkOrder,
  partLines: WorkOrderPartLine[],
  parts: { id: string; quantity_on_hand: number }[]
): boolean {
  const status = (order.status as WorkOrderStatus | string) ?? '';
  if (status === 'WAITING_PARTS' || status === 'Waiting Parts') return true;
  const blocker = (order as any).waiting_on_parts || (order as any).blocked_by_parts || (order as any).parts_blocker;
  if (blocker) return true;

  const partsMap = new Map(parts.map((p) => [p.id, p]));
  const lines = partLines.filter((l) => l.work_order_id === order.id);
  return lines.some((line) => {
    const part = partsMap.get(line.part_id);
    if (!part) return false;
    return toNumber(part.quantity_on_hand) < toNumber(line.quantity);
  });
}
