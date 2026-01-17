import type { HelpRole } from './types';
import { getHelpAuditLog, getAutoHelpAuditLog, getOnboardingAuditLog, logOnboardingEvent } from '@/components/help/helpAudit';

export type OnboardingStep = {
  id: string;
  playbookTitle: string;
  purpose: string;
  whyMatters: string;
  guidedAction: string;
  watchOut: string;
  verify: string;
  related: string[];
  status: 'pending' | 'completed' | 'mastered';
  frictionTag?: string;
};

type BaseStep = Omit<OnboardingStep, 'status'>;

const basePaths: Record<HelpRole, BaseStep[]> = {
  Technician: [
    {
      id: 'tech-pre-action',
      playbookTitle: 'What Happens If I Do This? (Pre-Action Impact & Consequences)',
      purpose: 'Avoid irreversible actions while working jobs.',
      whyMatters: 'Prevents bad posts or edits that need admin reversal.',
      guidedAction: 'Review the pre-action checklist before posting or closing work.',
      watchOut: 'Do not bypass locks; stop if unsure and escalate.',
      verify: 'You can describe the safe correction path (return/credit) before acting.',
      related: ['Why Is This Locked? (System Locks, Reasons & Safe Next Steps)'],
    },
    {
      id: 'tech-repair-sheet',
      playbookTitle: 'Create a Work Order Using Sheet Material (Repair)',
      purpose: 'Follow the repair sheet-material workflow.',
      whyMatters: 'Ensures correct material entry and avoids rework.',
      guidedAction: 'Use the repair sheet-material steps when adding sheet goods.',
      watchOut: 'Use the correct UOM and avoid negative QOH.',
      verify: 'Work order shows correct sheet material lines and notes.',
      related: ['Inventory: Advanced Units of Measure (Area, Length, Weight, Conversions)'],
    },
    {
      id: 'tech-remnants',
      playbookTitle: 'Inventory: Remnants & Drops (Partial Sheet & Cutoff Tracking)',
      purpose: 'Track and reuse remnants safely.',
      whyMatters: 'Prevents lost material and keeps inventory accurate.',
      guidedAction: 'Follow remnant steps after cutting sheet goods.',
      watchOut: 'Preserve dimensions and do not overwrite cost.',
      verify: 'Remnant created with correct size and cost shows in inventory.',
      related: ['Inventory: Set Up Sheet Goods (Plate, Sheet, Raw Stock)'],
    },
  ],
  'Service Writer': [
    {
      id: 'sw-locks',
      playbookTitle: 'Why Is This Locked? (System Locks, Reasons & Safe Next Steps)',
      purpose: 'Handle locked/disabled actions correctly.',
      whyMatters: 'Prevents improper edits to invoiced/locked records.',
      guidedAction: 'Use the locked playbook to choose the correct correction path.',
      watchOut: 'Do not unlock or bypass invoiced records; use returns/credits.',
      verify: 'You can state why a record is locked and the approved next step.',
      related: ['What Happens If I Do This? (Pre-Action Impact & Consequences)'],
    },
    {
      id: 'sw-invoice-locking',
      playbookTitle: 'Work Orders: Invoicing & Financial Locking',
      purpose: 'Invoice and lock work orders correctly.',
      whyMatters: 'Ensures billing is correct and locks are respected.',
      guidedAction: 'Follow invoicing steps and note what becomes locked.',
      watchOut: 'Check customer hold and payments before invoicing.',
      verify: 'WO/SO shows correct invoice status and locked fields.',
      related: ['Work Orders: Estimated vs Actual (Material & Labor Variance)'],
    },
    {
      id: 'sw-uom',
      playbookTitle: 'Inventory: Advanced Units of Measure (Area, Length, Weight, Conversions)',
      purpose: 'Keep UOM consistent across purchasing/consumption.',
      whyMatters: 'Prevents billing errors and inventory mismatches.',
      guidedAction: 'Configure primary/purchasing/consumption UOM per playbook.',
      watchOut: 'Mismatch between vendor invoice UOM and consumption UOM.',
      verify: 'Item shows correct conversions and pricing behavior.',
      related: ['Inventory: Set Up Sheet Goods (Plate, Sheet, Raw Stock)'],
    },
    {
      id: 'sw-po-shortage',
      playbookTitle: 'Purchasing: Create a Purchase Order from Sheet Material Shortage',
      purpose: 'Order sheet goods correctly when shortages occur.',
      whyMatters: 'Avoids wrong quantities and billing disputes.',
      guidedAction: 'Use the shortage-to-PO steps tied to the correct order.',
      watchOut: 'Align UOM with vendor invoicing before submitting.',
      verify: 'PO reflects shortage quantity and correct UOM/cost.',
      related: ['Inventory: Remnants & Drops (Partial Sheet & Cutoff Tracking)'],
    },
  ],
  'Manager/Admin': [
    {
      id: 'admin-locking',
      playbookTitle: 'Why Is This Locked? (System Locks, Reasons & Safe Next Steps)',
      purpose: 'Understand and enforce locking rules.',
      whyMatters: 'Protects financial integrity and audit trail.',
      guidedAction: 'Use the locking playbook to decide credit/return vs new transaction.',
      watchOut: 'Never unlock invoiced/locked records; use correction paths only.',
      verify: 'You can cite the lock reason and the approved resolution path.',
      related: ['Work Orders: Invoicing & Financial Locking'],
    },
    {
      id: 'admin-preaction',
      playbookTitle: 'What Happens If I Do This? (Pre-Action Impact & Consequences)',
      purpose: 'Preview impact of irreversible actions.',
      whyMatters: 'Prevents financial and inventory errors before posting.',
      guidedAction: 'Run through pre-action guardrails before invoicing/receiving/closing.',
      watchOut: 'Costing/UOM mismatches and inventory locks after posting.',
      verify: 'Action posted with no follow-up corrections needed.',
      related: ['Inventory: Advanced Units of Measure (Area, Length, Weight, Conversions)'],
    },
    {
      id: 'admin-invoice-locking',
      playbookTitle: 'Work Orders: Invoicing & Financial Locking',
      purpose: 'Apply correct invoicing and understand locks.',
      whyMatters: 'Ensures post-invoice immutability and auditability.',
      guidedAction: 'Follow invoicing steps; document corrections via credit/return.',
      watchOut: 'Do not edit invoiced records; use governed corrections.',
      verify: 'Invoices show correct status; audit notes captured for corrections.',
      related: ['Work Orders: Estimated vs Actual (Material & Labor Variance)'],
    },
    {
      id: 'admin-uom',
      playbookTitle: 'Inventory: Advanced Units of Measure (Area, Length, Weight, Conversions)',
      purpose: 'Normalize UOM and conversions across purchasing/consumption.',
      whyMatters: 'Prevents cost/stock errors across sheet goods and remnants.',
      guidedAction: 'Set primary/purchasing/consumption UOM and conversions per playbook.',
      watchOut: 'Partial usage without correct conversion factors.',
      verify: 'UOM conversions produce correct cost and QOH changes.',
      related: ['Inventory: Set Up Sheet Goods (Plate, Sheet, Raw Stock)', 'Inventory: Remnants & Drops (Partial Sheet & Cutoff Tracking)'],
    },
    {
      id: 'admin-po-shortage',
      playbookTitle: 'Purchasing: Create a Purchase Order from Sheet Material Shortage',
      purpose: 'Control purchasing tied to shortages.',
      whyMatters: 'Keeps costing, UOM, and inventory aligned to shortages.',
      guidedAction: 'Follow shortage-to-PO steps with vendor UOM alignment.',
      watchOut: 'Quantity or UOM mismatches vs shortage and vendor invoice.',
      verify: 'PO matches shortage, UOM, and approved costing; receiving aligns.',
      related: ['Inventory: Advanced Units of Measure (Area, Length, Weight, Conversions)'],
    },
  ],
};

function deriveFrictionTags(role: HelpRole): Set<string> {
  const tags = new Set<string>();
  const autoLogs = getAutoHelpAuditLog().filter((l) => l.userRole === role);
  const helpLogs = getHelpAuditLog().filter((l) => l.userRole === role);
  const hasLocked = autoLogs.some((l) => l.trigger === 'locked_action');
  const hasHighRisk = autoLogs.some((l) => l.trigger === 'high_risk_transition');
  const hasInventory = autoLogs.some((l) => l.trigger === 'inventory_impact');
  const frequentPlaybook = helpLogs.reduce<Record<string, number>>((acc, log) => {
    acc[log.playbookTitle] = (acc[log.playbookTitle] || 0) + 1;
    return acc;
  }, {});
  const topPlaybook = Object.entries(frequentPlaybook).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (hasLocked) tags.add('locks');
  if (hasHighRisk) tags.add('pre_action');
  if (hasInventory) tags.add('inventory');
  if (topPlaybook) tags.add(`focus:${topPlaybook}`);
  return tags;
}

function isMastered(role: HelpRole, stepId: string, playbookTitle: string): boolean {
  const helpLogs = getHelpAuditLog().filter((l) => l.userRole === role && l.playbookTitle === playbookTitle);
  const autoLogs = getAutoHelpAuditLog().filter((l) => l.userRole === role && l.playbookTitle === playbookTitle);
  const onboardingLogs = getOnboardingAuditLog().filter((l) => l.userRole === role && l.stepId === stepId);
  const completed = onboardingLogs.some((l) => l.outcome === 'completed' || l.outcome === 'mastered_auto');

  if (completed) return true;
  const proceededCount = autoLogs.filter((l) => l.outcome === 'proceeded').length;
  const dismissCount = autoLogs.filter((l) => l.outcome === 'dismissed').length;
  const helpCount = helpLogs.length;
  return helpCount >= 3 && proceededCount >= dismissCount + 1;
}

export function generateOnboardingPlan(role: HelpRole): OnboardingStep[] {
  const frictionTags = deriveFrictionTags(role);
  const steps = basePaths[role] || [];

  const ordered = [...steps].sort((a, b) => {
    const aPriority =
      (frictionTags.has('locks') && a.playbookTitle.includes('Locked')) ||
      (frictionTags.has('pre_action') && a.playbookTitle.includes('What Happens')) ||
      (frictionTags.has('inventory') && a.playbookTitle.includes('Inventory'))
        ? -1
        : 0;
    const bPriority =
      (frictionTags.has('locks') && b.playbookTitle.includes('Locked')) ||
      (frictionTags.has('pre_action') && b.playbookTitle.includes('What Happens')) ||
      (frictionTags.has('inventory') && b.playbookTitle.includes('Inventory'))
        ? -1
        : 0;
    return bPriority - aPriority;
  });

  return ordered.map((step) => ({
    ...step,
    status: isMastered(role, step.id, step.playbookTitle) ? 'mastered' : 'pending',
    frictionTag: Array.from(frictionTags).find((tag) => step.playbookTitle.includes('Locked') && tag === 'locks') || undefined,
  }));
}

export function markOnboardingStep(
  role: HelpRole,
  stepId: string,
  playbookTitle: string,
  outcome: 'completed' | 'skipped' | 'mastered_auto',
  frictionTag?: string
) {
  logOnboardingEvent({ userRole: role, stepId, playbookTitle, outcome, frictionTag });
}
