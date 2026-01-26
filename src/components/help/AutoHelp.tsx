import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import type { HelpContext, HelpRole, AutoHelpTrigger } from '@/help/types';
import { logAutoHelpEvent } from './helpAudit';

type AutoHelpEntry = {
  trigger: AutoHelpTrigger;
  reason: string;
  playbookTitle: string;
  lines: string[];
};

function resolveHelpRole(context?: HelpContext): HelpRole {
  const role = context?.userRole;
  if (role === 'Manager/Admin' || role === 'Service Writer' || role === 'Technician') return role;
  return 'Technician';
}

const playbookMap: Record<
  AutoHelpTrigger,
  {
    title: string;
    byRole: Record<HelpRole, { reason: string; lines: string[] }>;
  }
> = {
  locked_action: {
    title: 'Why Is This Locked?',
    byRole: {
      'Technician': {
        reason: 'Action is disabled or record is locked.',
        lines: [
          'Locked records allow viewing/notes only—no edits.',
          'Capture what you see; escalate to a Service Writer/Manager.',
          'Do not force edits; wait for direction.',
        ],
      },
      'Service Writer': {
        reason: 'Action blocked due to status (invoiced/hold/approval).',
        lines: [
          'Use returns/credits or a new transaction instead of editing.',
          'Check customer hold/approval status before proceeding.',
          'Avoid unlocking invoiced records; follow billing policy.',
        ],
      },
      'Manager/Admin': {
        reason: 'Financial/locking rule is preventing this action.',
        lines: [
          'Invoiced/locked records stay immutable; use credit/return paths.',
          'Document rationale for any corrective action (audit).',
          'If inventory is involved, ensure adjustments are authorized.',
        ],
      },
    },
  },
};

function dedupeTriggers(triggers: AutoHelpTrigger[] | undefined): AutoHelpTrigger[] {
  if (!triggers) return [];
  const seen = new Set<AutoHelpTrigger>();
  return triggers.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

function detectTriggers(context?: HelpContext): AutoHelpTrigger[] {
  const collected = dedupeTriggers(context?.autoTriggers);
  const status = context?.status?.toUpperCase() || '';
  const recordType = (context?.recordType || '').toLowerCase();
  const actionName = (context?.actionName || '').toLowerCase();

  if (status === 'INVOICED' || context?.lockedReason) collected.push('locked_action');
  if (recordType.includes('invoice') || actionName === 'invoice' || status === 'CLOSING') {
    collected.push('high_risk_transition');
  }
  if (recordType.includes('receive') || recordType.includes('inventory')) {
    collected.push('inventory_impact');
  }
  if (context?.hesitation) collected.push('hesitation');

  return dedupeTriggers(collected);
}

export function getAutoHelpEntry(moduleKey: string, context?: HelpContext): AutoHelpEntry | null {
  const role = resolveHelpRole(context);
  const triggers = detectTriggers(context);
  if (triggers.length === 0) return null;

  for (const trigger of triggers) {
    const playbook = playbookMap[trigger];
    if (!playbook) continue;
    const roleBlock = playbook.byRole[role];
    if (!roleBlock) continue;
    return {
      trigger,
      reason: context?.lockedReason || roleBlock.reason,
      playbookTitle: playbook.title,
      lines: roleBlock.lines,
    };
  }

  return null;
}

type AutoHelpPanelProps = {
  moduleKey: string;
  context?: HelpContext;
};

export function AutoHelpPanel({ moduleKey, context }: AutoHelpPanelProps) {
  const role = resolveHelpRole(context);
  const entry = useMemo(() => getAutoHelpEntry(moduleKey, context), [moduleKey, context]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (entry) {
      logAutoHelpEvent({
        moduleKey,
        playbookTitle: entry.playbookTitle,
        userRole: role,
        renderingMode: role === 'Technician' ? 'technician' : role === 'Service Writer' ? 'service_writer' : 'manager_admin',
        trigger: entry.trigger,
        outcome: 'auto_surface',
      });
    }
  }, [entry, moduleKey, role]);

  if (!entry) return null;

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    logAutoHelpEvent({
      moduleKey,
      playbookTitle: entry.playbookTitle,
      userRole: role,
      renderingMode: role === 'Technician' ? 'technician' : role === 'Service Writer' ? 'service_writer' : 'manager_admin',
      trigger: entry.trigger,
      outcome: next ? 'expanded' : 'dismissed',
    });
  };

  return (
    <div className="rounded-lg border border-amber-400/70 bg-amber-50 text-amber-900 shadow-sm">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
        onClick={handleToggle}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 text-left">
          <ShieldAlert className="w-4 h-4" />
          <span>{entry.playbookTitle}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-amber-900/80">
          <span>{entry.reason}</span>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Role: {role}</div>
          <ul className="list-disc pl-4 space-y-1">
            {entry.lines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
          <p className="text-xs text-amber-800">
            This is auto-surfaced guidance. It does not override system locks or approvals.
          </p>
        </div>
      )}
    </div>
  );
}
