import type { HelpRole } from '@/help/types';
import type {
  Part,
  PlasmaJob,
  PlasmaJobAttachment,
  WorkOrder,
  WorkOrderLaborLine,
  WorkOrderPartLine,
  WorkOrderTimeEntry,
} from '@/types';
import { logSimulationEvent } from '@/components/help/helpAudit';

export type SimulationScenario =
  | 'pricing_sensitivity'
  | 'inventory_min_policy'
  | 'labor_estimate_adjustment'
  | 'process_compliance'
  | 'purchasing_strategy';

export type Simulation = {
  id: SimulationScenario;
  headline: string;
  scenario: string;
  assumptions: string;
  simulated: string;
  outcome: string;
  confidence: number;
  risks: string;
  improveAccuracy: string;
  supportingRecords: { label: string; url: string }[];
};

type SimulationSourceData = {
  workOrders: WorkOrder[];
  laborLines: WorkOrderLaborLine[];
  partLines: WorkOrderPartLine[];
  timeEntries: WorkOrderTimeEntry[];
  parts: Part[];
  plasmaJobs: PlasmaJob[];
  plasmaAttachments: PlasmaJobAttachment[];
};

function isManagerRole(role: HelpRole) {
  return role === 'Manager/Admin';
}

function isOwnerRole(role: HelpRole) {
  return role === 'Manager/Admin';
}

function allowedRole(role: HelpRole) {
  return isManagerRole(role) || isOwnerRole(role);
}

function hoursFromSeconds(seconds: number) {
  return seconds / 3600;
}

function confidenceFromSample(count: number, threshold: number) {
  if (count < threshold) return 0.3;
  if (count >= threshold * 3) return 0.85;
  return Math.min(0.85, 0.4 + (count / threshold) * 0.2);
}

function pricingSensitivitySimulation(
  role: HelpRole,
  workOrders: WorkOrder[],
  laborLines: WorkOrderLaborLine[]
): Simulation | null {
  if (!allowedRole(role)) return null;
  const invoicedIds = new Set(workOrders.filter((wo) => wo.status === 'INVOICED').map((wo) => wo.id));
  const invoicedLabor = laborLines.filter((l) => invoicedIds.has(l.work_order_id));
  const totalHours = invoicedLabor.reduce((sum, l) => sum + l.hours, 0);
  const avgRate = invoicedLabor.length
    ? invoicedLabor.reduce((sum, l) => sum + l.rate, 0) / invoicedLabor.length
    : 0;
  if (totalHours <= 0 || avgRate <= 0) return null;
  const rateDelta = avgRate * 0.1; // +10%
  const projected = totalHours * rateDelta;
  const confidence = confidenceFromSample(invoicedLabor.length, 10);
  if (confidence < 0.35) return null;
  return {
    id: 'pricing_sensitivity',
    headline: 'Pricing sensitivity: +10% labor rate',
    scenario: 'Increase labor rates by 10% on current pricing model.',
    assumptions: 'Based on invoiced labor hours and current average rate; no change in demand.',
    simulated: `Applied +10% to avg labor rate (${avgRate.toFixed(2)} → ${(avgRate + rateDelta).toFixed(2)}).`,
    outcome: `Projected additional revenue: $${projected.toFixed(2)} across historical invoiced labor.`,
    confidence,
    risks: 'Potential pushback from customers; ensure value and approvals before applying.',
    improveAccuracy: 'Segment by job type and customer, and include win/loss impact before changing rates.',
    supportingRecords: invoicedLabor.slice(0, 5).map((l) => ({
      label: `WO ${l.work_order_id} — ${l.hours.toFixed(1)}h @ $${l.rate}`,
      url: `/work-orders/${l.work_order_id}`,
    })),
  };
}

function inventoryMinPolicySimulation(role: HelpRole, parts: Part[]): Simulation | null {
  if (!allowedRole(role)) return null;
  const withMin = parts.filter((p) => typeof p.min_qty === 'number' && p.min_qty !== null);
  if (withMin.length < 3) return null;
  const factor = 1.2;
  const impacted = withMin.filter((p) => p.quantity_on_hand < (p.min_qty ?? 0) * factor);
  const confidence = confidenceFromSample(withMin.length, 10);
  if (confidence < 0.35) return null;
  return {
    id: 'inventory_min_policy',
    headline: 'Inventory minimum policy: +20% safety stock',
    scenario: 'Increase minimum stock thresholds by 20% for tracked items.',
    assumptions: 'Uses current min_qty and on-hand; no lead time changes.',
    simulated: `Flagged items below new min (min * ${factor}).`,
    outcome: `${impacted.length} items would need replenishment under the higher minimum.`,
    confidence,
    risks: 'Higher carrying cost and cash tied in inventory.',
    improveAccuracy: 'Model vendor lead times and demand variability before changing mins.',
    supportingRecords: impacted.slice(0, 5).map((p) => ({
      label: `${p.part_number} — QOH ${p.quantity_on_hand}, Min ${p.min_qty}`,
      url: `/inventory/parts/${p.id}`,
    })),
  };
}

function laborEstimateAdjustmentSimulation(
  role: HelpRole,
  workOrders: WorkOrder[],
  laborLines: WorkOrderLaborLine[],
  timeEntries: WorkOrderTimeEntry[]
): Simulation | null {
  if (!allowedRole(role)) return null;
  const invoiced = workOrders.filter((wo) => wo.status === 'INVOICED');
  const plannedByWo = laborLines.reduce<Record<string, number>>((acc, l) => {
    acc[l.work_order_id] = (acc[l.work_order_id] || 0) + l.hours;
    return acc;
  }, {});
  const actualByWo = timeEntries.reduce<Record<string, number>>((acc, t) => {
    acc[t.work_order_id] = (acc[t.work_order_id] || 0) + hoursFromSeconds(t.seconds);
    return acc;
  }, {});
  const overruns = invoiced
    .map((wo) => {
      const planned = plannedByWo[wo.id] || 0;
      const actual = actualByWo[wo.id] || 0;
      const ratio = planned > 0 ? actual / planned : 0;
      return { wo, planned, actual, ratio };
    })
    .filter(({ planned, actual }) => planned > 0 && actual > planned);
  if (overruns.length < 3) return null;
  const avgOverrun = overruns.reduce((sum, o) => sum + (o.actual - o.planned), 0) / overruns.length;
  const adjustFactor = 1.1;
  const confidence = confidenceFromSample(overruns.length, 10);
  if (confidence < 0.35) return null;
  return {
    id: 'labor_estimate_adjustment',
    headline: 'Labor estimate adjustment impact',
    scenario: 'Increase estimated labor by 10% on jobs with historical overruns.',
    assumptions: 'Uses invoiced jobs with time tracked; no scope change assumed.',
    simulated: `Applied ${Math.round((adjustFactor - 1) * 100)}% uplift to planned hours for similar jobs.`,
    outcome: `Average overrun ${avgOverrun.toFixed(1)}h could be offset; margin risk reduced on these jobs.`,
    confidence,
    risks: 'Higher estimates may affect approvals; ensure clarity on scope before using higher hours.',
    improveAccuracy: 'Segment by job type and technician; include recent variance trends.',
    supportingRecords: overruns.slice(0, 5).map(({ wo, planned, actual }) => ({
      label: `${wo.order_number || wo.id} — planned ${planned.toFixed(1)}h / actual ${actual.toFixed(1)}h`,
      url: `/work-orders/${wo.id}`,
    })),
  };
}

function processComplianceSimulation(
  role: HelpRole,
  plasmaJobs: PlasmaJob[],
  plasmaAttachments: PlasmaJobAttachment[]
): Simulation | null {
  if (!allowedRole(role)) return null;
  const attachmentsByJob = plasmaAttachments.reduce<Record<string, number>>((acc, att) => {
    acc[att.plasma_job_id] = (acc[att.plasma_job_id] || 0) + 1;
    return acc;
  }, {});
  const missing = plasmaJobs.filter((job) => (job.status === 'APPROVED' || job.status === 'CUT') && (attachmentsByJob[job.id] || 0) === 0);
  if (missing.length === 0) return null;
  const confidence = confidenceFromSample(missing.length, 5);
  if (confidence < 0.35) return null;
  return {
    id: 'process_compliance',
    headline: 'Process compliance: require attachments before cutting',
    scenario: 'Gate fab jobs on attachment presence.',
    assumptions: 'Uses current approved/cut jobs missing attachments.',
    simulated: 'Evaluated enforcing attachment requirement pre-cut.',
    outcome: `${missing.length} jobs would be paused until attachments are added.`,
    confidence,
    risks: 'Could delay start if uploads are slow; prevents costly rework.',
    improveAccuracy: 'Track cycle time impact when attachments are enforced vs absent.',
    supportingRecords: missing.slice(0, 5).map((job) => ({
      label: `Plasma job ${job.id} (${job.status})`,
      url: job.work_order_id ? `/work-orders/${job.work_order_id}` : '/plasma',
    })),
  };
}

function purchasingStrategySimulation(role: HelpRole, parts: Part[]): Simulation | null {
  if (!allowedRole(role)) return null;
  const remnants = parts.filter((p) => p.is_remnant);
  const sheets = parts.filter((p) => p.material_kind === 'SHEET' && !p.is_remnant);
  if (sheets.length < 3) return null;
  const idleRemnants = remnants.filter((p) => p.quantity_on_hand > 0);
  const convertCount = Math.min(sheets.length * 0.2, idleRemnants.length);
  const confidence = confidenceFromSample(sheets.length, 10);
  if (confidence < 0.35) return null;
  return {
    id: 'purchasing_strategy',
    headline: 'Purchasing strategy: sheet vs partial buying',
    scenario: 'Shift 20% of sheet purchases to partial buys when remnants are idle.',
    assumptions: 'Based on current sheet/remnant counts; assumes supplier partials available.',
    simulated: `Consider diverting ~${Math.round(sheets.length * 0.2)} sheet purchases to partials.`,
    outcome: `Could reduce idle remnants by ~${Math.round(convertCount)} and free storage.`,
    confidence,
    risks: 'Partial buys may raise unit cost; confirm supplier terms.',
    improveAccuracy: 'Model supplier pricing and actual remnant reuse rates.',
    supportingRecords: idleRemnants.slice(0, 5).map((p) => ({
      label: `${p.part_number} remnant`,
      url: `/inventory/parts/${p.id}`,
    })),
  };
}

export function runSimulations(role: HelpRole, data: SimulationSourceData): Simulation[] {
  if (!allowedRole(role)) return [];

  const sims: (Simulation | null)[] = [
    pricingSensitivitySimulation(role, data.workOrders, data.laborLines),
    inventoryMinPolicySimulation(role, data.parts),
    laborEstimateAdjustmentSimulation(role, data.workOrders, data.laborLines, data.timeEntries),
    processComplianceSimulation(role, data.plasmaJobs, data.plasmaAttachments),
    purchasingStrategySimulation(role, data.parts),
  ];

  const simulations = sims.filter((s): s is Simulation => Boolean(s));

  simulations.forEach((sim) => {
    logSimulationEvent({
      userRole: role,
      simulationId: sim.id,
      event: 'run',
      assumptions: sim.assumptions,
    });
  });

  return simulations;
}
