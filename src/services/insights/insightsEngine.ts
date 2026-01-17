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
import { getAutoHelpAuditLog, logInsightEvent } from '@/components/help/helpAudit';

export type InsightCategory =
  | 'Financial performance'
  | 'Inventory & purchasing'
  | 'Labor & productivity'
  | 'Process & system health';

export type Insight = {
  id: string;
  headline: string;
  prediction?: string;
  observation: string;
  supportingEvidence?: string;
  whyMatters: string;
  action: string;
  riskReduction?: string;
  confidence: number;
  category: InsightCategory;
  supportingRecords: { label: string; url: string }[];
};

type InsightSourceData = {
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
  // Owner is represented by ADMIN in current role set
  return role === 'Manager/Admin';
}

function allowedRole(role: HelpRole) {
  return isManagerRole(role) || isOwnerRole(role);
}

function allowLimited(role: HelpRole) {
  return role === 'Service Writer';
}

function hoursFromSeconds(seconds: number) {
  return seconds / 3600;
}

function getLaborOverruns(
  role: HelpRole,
  workOrders: WorkOrder[],
  laborLines: WorkOrderLaborLine[],
  timeEntries: WorkOrderTimeEntry[]
): Insight[] {
  if (!allowedRole(role)) return [];
  const laborByWo = laborLines.reduce<Record<string, number>>((acc, line) => {
    acc[line.work_order_id] = (acc[line.work_order_id] || 0) + line.hours;
    return acc;
  }, {});
  const timeByWo = timeEntries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.work_order_id] = (acc[entry.work_order_id] || 0) + hoursFromSeconds(entry.seconds);
    return acc;
  }, {});

  const candidates = workOrders
    .filter((wo) => wo.status === 'INVOICED')
    .map((wo) => {
      const billed = laborByWo[wo.id] || 0;
      const actual = timeByWo[wo.id] || 0;
      return { wo, billed, actual };
    })
    .filter(({ billed, actual }) => billed > 0 && actual > billed * 1.2);

  if (candidates.length === 0) return [];

  const top = candidates.slice(0, 3);
  return [
    {
      id: 'labor-overrun',
      headline: 'Estimated vs Actual labor overruns',
      prediction: undefined,
      observation: `${candidates.length} invoiced jobs show actual hours above billed hours.`,
      whyMatters: 'Labor overruns reduce margin and signal estimate gaps on locked jobs.',
      action: 'Review affected invoices and adjust estimating guidance for similar work.',
      riskReduction: 'Tighten estimate templates and require time entry before invoicing.',
      confidence: Math.min(0.9, 0.4 + candidates.length * 0.1),
      category: 'Labor & productivity',
      supportingRecords: top.map(({ wo, billed, actual }) => ({
        label: `${wo.order_number || wo.id} — billed ${billed.toFixed(1)}h vs actual ${actual.toFixed(1)}h`,
        url: `/work-orders/${wo.id}`,
      })),
    },
  ];
}

function getInvoicedNoLabor(
  role: HelpRole,
  workOrders: WorkOrder[],
  laborLines: WorkOrderLaborLine[]
): Insight[] {
  if (!allowedRole(role)) return [];
  const laborByWo = new Set(laborLines.map((l) => l.work_order_id));
  const candidates = workOrders.filter((wo) => wo.status === 'INVOICED' && !laborByWo.has(wo.id));
  if (candidates.length === 0) return [];
  return [
    {
      id: 'invoiced-no-labor',
      headline: 'Jobs invoiced without recorded labor',
      prediction: undefined,
      observation: `${candidates.length} invoiced jobs have no labor lines.`,
      whyMatters: 'Billing without labor may understate revenue and distort profitability.',
      action: 'Validate if labor should be added via a corrective credit/rebill workflow.',
      riskReduction: 'Require labor/time entry validation before invoicing.',
      confidence: Math.min(0.9, 0.4 + candidates.length * 0.1),
      category: 'Financial performance',
      supportingRecords: candidates.slice(0, 5).map((wo) => ({
        label: wo.order_number || wo.id,
        url: `/work-orders/${wo.id}`,
      })),
    },
  ];
}

function getNegativeSheetQoh(role: HelpRole, parts: Part[]): Insight[] {
  if (!allowedRole(role)) return [];
  const offenders = parts.filter((p) => p.material_kind === 'SHEET' && p.quantity_on_hand < 0);
  if (offenders.length === 0) return [];
  return [
    {
      id: 'sheet-negative-qoh',
      headline: 'Frequent negative QOH on sheet goods',
      prediction: undefined,
      observation: `${offenders.length} sheet items show negative on-hand.`,
      whyMatters: 'Negative QOH signals inventory/control issues and incorrect costing.',
      action: 'Run sheet inventory true-up and align UOM/receiving for these items.',
      riskReduction: 'Enforce receiving vs adjust rules for sheet goods and track remnants.',
      confidence: Math.min(0.9, 0.5 + offenders.length * 0.1),
      category: 'Inventory & purchasing',
      supportingRecords: offenders.slice(0, 5).map((p) => ({
        label: `${p.part_number} (${p.description ?? 'Sheet'})`,
        url: `/inventory/parts/${p.id}`,
      })),
    },
  ];
}

function getRemnantsNotReused(role: HelpRole, parts: Part[]): Insight[] {
  if (!allowedRole(role)) return [];
  const now = Date.now();
  const stale = parts.filter((p) => {
    if (!p.is_remnant) return false;
    const created = new Date(p.created_at).getTime();
    return p.quantity_on_hand > 0 && now - created > 14 * 24 * 60 * 60 * 1000;
  });
  if (stale.length === 0) return [];
  return [
    {
      id: 'remnants-idle',
      headline: 'Remnants created but not reused',
      prediction: undefined,
      observation: `${stale.length} remnants remain unused after 14+ days.`,
      whyMatters: 'Idle remnants increase carrying cost and clutter storage.',
      action: 'Schedule reuse or scrap decisions using the Remnants & Drops playbook.',
      riskReduction: 'Include remnant reuse checks in job planning for sheet work.',
      confidence: Math.min(0.85, 0.45 + stale.length * 0.08),
      category: 'Inventory & purchasing',
      supportingRecords: stale.slice(0, 5).map((p) => ({
        label: `${p.part_number} remnant`,
        url: `/inventory/parts/${p.id}`,
      })),
    },
  ];
}

function getMissingLaborEntries(
  role: HelpRole,
  workOrders: WorkOrder[],
  laborLines: WorkOrderLaborLine[],
  timeEntries: WorkOrderTimeEntry[]
): Insight[] {
  if (!allowedRole(role)) return [];
  const hasLabor = new Set(laborLines.map((l) => l.work_order_id));
  const hasTime = new Set(timeEntries.map((t) => t.work_order_id));
  const candidates = workOrders.filter(
    (wo) => wo.status === 'INVOICED' && !hasLabor.has(wo.id) && !hasTime.has(wo.id)
  );
  if (candidates.length === 0) return [];
  return [
    {
      id: 'missing-labor',
      headline: 'Missing labor entries on closed jobs',
      prediction: undefined,
      observation: `${candidates.length} invoiced jobs have no labor recorded.`,
      whyMatters: 'Missing labor causes underbilling and inaccurate job costing.',
      action: 'Add labor or time entries per the Estimated vs Actual playbook.',
      riskReduction: 'Require timecard check before invoicing or closing jobs.',
      confidence: Math.min(0.85, 0.4 + candidates.length * 0.1),
      category: 'Labor & productivity',
      supportingRecords: candidates.slice(0, 5).map((wo) => ({
        label: wo.order_number || wo.id,
        url: `/work-orders/${wo.id}`,
      })),
    },
  ];
}

function getPhaseOverrunsNoAttachments(
  role: HelpRole,
  plasmaJobs: PlasmaJob[],
  plasmaAttachments: PlasmaJobAttachment[]
): Insight[] {
  if (!allowedRole(role)) return [];
  const attachmentByJob = plasmaAttachments.reduce<Record<string, number>>((acc, att) => {
    acc[att.plasma_job_id] = (acc[att.plasma_job_id] || 0) + 1;
    return acc;
  }, {});
  const risky = plasmaJobs.filter((job) => {
    const attachCount = attachmentByJob[job.id] || 0;
    const agingDays = (Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return (job.status === 'CUT' || job.status === 'COMPLETED') && attachCount === 0 && agingDays >= 3;
  });
  if (risky.length === 0) return [];
  return [
    {
      id: 'phase-overrun-no-attachments',
      headline: 'Phase overruns correlated with missing attachments',
      prediction: undefined,
      observation: `${risky.length} cut/completed fab jobs lack reference attachments.`,
      whyMatters: 'Missing attachments increase rework risk and hide overruns.',
      action: 'Attach drawings/DXF and review phase timing before closing jobs.',
      riskReduction: 'Enforce attachment upload before cutting/completing fab jobs.',
      confidence: Math.min(0.8, 0.4 + risky.length * 0.1),
      category: 'Process & system health',
      supportingRecords: risky.slice(0, 5).map((job) => ({
        label: `Plasma job ${job.id} (${job.status})`,
        url: job.work_order_id ? `/work-orders/${job.work_order_id}` : '/plasma',
      })),
    },
  ];
}

function getMarginRiskPredictions(
  role: HelpRole,
  workOrders: WorkOrder[],
  laborLines: WorkOrderLaborLine[],
  partLines: WorkOrderPartLine[]
): Insight[] {
  if (!allowedRole(role)) return [];
  const open = workOrders.filter((wo) => wo.status !== 'INVOICED');
  if (open.length < 3) return [];
  const laborByWo = laborLines.reduce<Record<string, number>>((acc, l) => {
    acc[l.work_order_id] = (acc[l.work_order_id] || 0) + l.hours * l.rate;
    return acc;
  }, {});
  const partsByWo = partLines.reduce<Record<string, number>>((acc, l) => {
    acc[l.work_order_id] = (acc[l.work_order_id] || 0) + l.line_total;
    return acc;
  }, {});
  const atRisk = open
    .map((wo) => {
      const cost = (wo.labor_cost ?? 0) + (partsByWo[wo.id] || 0);
      const billed = Math.max(wo.subtotal ?? 0, wo.total ?? 0);
      const ratio = billed > 0 ? cost / billed : 0;
      return { wo, ratio, cost, billed };
    })
    .filter(({ ratio }) => ratio >= 0.8)
    .sort((a, b) => b.ratio - a.ratio);
  if (atRisk.length === 0) return [];
  const top = atRisk.slice(0, 5);
  const confidence = Math.min(0.9, 0.5 + atRisk.length * 0.05);
  if (confidence < 0.45) return [];
  return [
    {
      id: 'margin-risk-open',
      headline: 'Margin risk on open jobs',
      prediction: 'These open jobs are trending toward thin margins based on current cost vs billed amounts.',
      observation: `${atRisk.length} open jobs show cost/bill ratios above 80%.`,
      supportingEvidence: `Cost/bill ratios: ${top.map((t) => t.ratio.toFixed(2)).join(', ')}`,
      whyMatters: 'Thin margins before invoicing risk unprofitable billing and lock in losses.',
      action: 'Review pricing and costs now; adjust estimates or scope before invoicing.',
      riskReduction: 'Require pre-invoice margin check on at-risk jobs.',
      confidence,
      category: 'Financial performance',
      supportingRecords: top.map(({ wo, ratio }) => ({
        label: `${wo.order_number || wo.id} — ratio ${ratio.toFixed(2)}`,
        url: `/work-orders/${wo.id}`,
      })),
    },
  ];
}

function getStockoutPredictions(role: HelpRole, parts: Part[], partLines: WorkOrderPartLine[]): Insight[] {
  if (!allowedRole(role)) return [];
  const usageByPart = partLines.reduce<Record<string, number>>((acc, l) => {
    acc[l.part_id] = (acc[l.part_id] || 0) + l.quantity;
    return acc;
  }, {});
  const atRisk = parts
    .filter((p) => p.material_kind === 'SHEET')
    .map((p) => {
      const demand = usageByPart[p.id] || 0;
      return { part: p, demand };
    })
    .filter(({ part, demand }) => {
      const min = part.min_qty ?? 0;
      return part.quantity_on_hand - demand < min || part.quantity_on_hand < 0;
    });
  if (atRisk.length === 0) return [];
  const top = atRisk.slice(0, 5);
  const confidence = Math.min(0.9, 0.5 + atRisk.length * 0.08);
  if (confidence < 0.45) return [];
  return [
    {
      id: 'stockout-risk',
      headline: 'Inventory stockout risk',
      prediction: 'Sheet goods tied to open demand are likely to stock out.',
      observation: `${atRisk.length} sheet items have demand exceeding safe on-hand levels.`,
      supportingEvidence: `On-hand minus demand is below min for these items.`,
      whyMatters: 'Stockouts delay jobs and force costly rush purchases.',
      action: 'Place replenishment POs for at-risk sheets; verify UOM with vendors.',
      riskReduction: 'Tighten reorder points and link shortages to purchasing playbook.',
      confidence,
      category: 'Inventory & purchasing',
      supportingRecords: top.map(({ part }) => ({
        label: `${part.part_number} (${part.description ?? 'Sheet'})`,
        url: `/inventory/parts/${part.id}`,
      })),
    },
  ];
}

function getLaborOverrunPredictions(
  role: HelpRole,
  workOrders: WorkOrder[],
  laborLines: WorkOrderLaborLine[],
  timeEntries: WorkOrderTimeEntry[]
): Insight[] {
  if (!allowedRole(role) && !allowLimited(role)) return [];
  const byWoHours = laborLines.reduce<Record<string, number>>((acc, l) => {
    acc[l.work_order_id] = (acc[l.work_order_id] || 0) + l.hours;
    return acc;
  }, {});
  const timeByWo = timeEntries.reduce<Record<string, number>>((acc, t) => {
    acc[t.work_order_id] = (acc[t.work_order_id] || 0) + hoursFromSeconds(t.seconds);
    return acc;
  }, {});
  const candidates = workOrders
    .filter((wo) => wo.status !== 'INVOICED')
    .map((wo) => {
      const planned = byWoHours[wo.id] || 0;
      const actual = timeByWo[wo.id] || 0;
      const ratio = planned > 0 ? actual / planned : 0;
      return { wo, planned, actual, ratio };
    })
    .filter(({ planned, ratio }) => planned > 0 && ratio >= 0.8);
  if (candidates.length === 0) return [];
  const top = candidates.slice(0, 5);
  const confidence = Math.min(0.9, 0.5 + candidates.length * 0.06);
  if (confidence < 0.45) return [];
  const insight: Insight = {
    id: 'labor-overrun-risk',
    headline: 'Labor overrun risk',
    prediction: 'Actual time is approaching or exceeding planned hours on open jobs.',
    observation: `${candidates.length} open jobs have time >= 80% of planned hours.`,
    supportingEvidence: `Planned vs actual hours ratios: ${top.map((t) => t.ratio.toFixed(2)).join(', ')}`,
    whyMatters: 'Overruns reduce margin and delay billing.',
    action: 'Re-plan labor or adjust estimates before invoicing.',
    riskReduction: 'Require time review checkpoints mid-job.',
    confidence,
    category: 'Labor & productivity',
    supportingRecords: top.map(({ wo, planned, actual }) => ({
      label: `${wo.order_number || wo.id} — planned ${planned.toFixed(1)}h / actual ${actual.toFixed(1)}h`,
      url: `/work-orders/${wo.id}`,
    })),
  };
  if (role === 'Service Writer') {
    // limited job-level warning: keep same insight but rely on filter in caller
  }
  return [insight];
}

function getProcessFailurePredictions(
  role: HelpRole,
  plasmaJobs: PlasmaJob[],
  plasmaAttachments: PlasmaJobAttachment[]
): Insight[] {
  if (!allowedRole(role) && !allowLimited(role)) return [];
  const attachCount = plasmaAttachments.reduce<Record<string, number>>((acc, att) => {
    acc[att.plasma_job_id] = (acc[att.plasma_job_id] || 0) + 1;
    return acc;
  }, {});
  const risky = plasmaJobs.filter((job) => {
    const count = attachCount[job.id] || 0;
    return (job.status === 'APPROVED' || job.status === 'CUT' || job.status === 'IN_PROGRESS') && count === 0;
  });
  if (risky.length < 2) return [];
  const confidence = Math.min(0.85, 0.4 + risky.length * 0.06);
  if (confidence < 0.45) return [];
  const top = risky.slice(0, 5);
  return [
    {
      id: 'process-risk-attachments',
      headline: 'Process failure risk: missing attachments',
      prediction: 'Approved or in-progress fab jobs without attachments may fail or rework.',
      observation: `${risky.length} fab jobs are active without attachments.`,
      supportingEvidence: 'Attachments missing on approved/in-progress jobs.',
      whyMatters: 'Missing references increase errors and overruns.',
      action: 'Upload required drawings/DXF before cutting; pause work if absent.',
      riskReduction: 'Make attachment a gate before cutting/finishing.',
      confidence,
      category: 'Process & system health',
      supportingRecords: top.map((job) => ({
        label: `Plasma job ${job.id} (${job.status})`,
        url: job.work_order_id ? `/work-orders/${job.work_order_id}` : '/plasma',
      })),
    },
  ];
}

export function generateInsights(role: HelpRole, data: InsightSourceData): Insight[] {
  if (!allowedRole(role) && !allowLimited(role)) return [];

  const insights: Insight[] = [
    // Phase 1 (historical) insights
    ...getLaborOverruns(role, data.workOrders, data.laborLines, data.timeEntries),
    ...getInvoicedNoLabor(role, data.workOrders, data.laborLines),
    ...getNegativeSheetQoh(role, data.parts),
    ...getRemnantsNotReused(role, data.parts),
    ...getMissingLaborEntries(role, data.workOrders, data.laborLines, data.timeEntries),
    ...getPhaseOverrunsNoAttachments(role, data.plasmaJobs, data.plasmaAttachments),
    // Phase 2 predictive insights
    ...getMarginRiskPredictions(role, data.workOrders, data.laborLines, data.partLines),
    ...getStockoutPredictions(role, data.parts, data.partLines),
    ...getLaborOverrunPredictions(role, data.workOrders, data.laborLines, data.timeEntries),
    ...getProcessFailurePredictions(role, data.plasmaJobs, data.plasmaAttachments),
  ];

  const filtered =
    role === 'Service Writer'
      ? insights.filter((i) => i.id === 'labor-overrun-risk' || i.id === 'process-risk-attachments')
      : insights;

  filtered.forEach((insight) => {
    logInsightEvent({
      userRole: role,
      insightId: insight.id,
      category: insight.category,
      confidence: insight.confidence,
      event: 'generated',
    });
  });

  return filtered;
}
