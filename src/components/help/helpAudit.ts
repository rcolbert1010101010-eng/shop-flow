import type { HelpRole } from '@/help/types';

export type HelpAuditEntry = {
  ts: number;
  moduleKey: string;
  playbookTitle: string;
  userRole: HelpRole;
  renderingMode: 'technician' | 'service_writer' | 'manager_admin';
  question: string;
};

const helpAuditLog: HelpAuditEntry[] = [];

export type AutoHelpAuditEntry = {
  ts: number;
  moduleKey: string;
  playbookTitle: string;
  userRole: HelpRole;
  renderingMode: 'technician' | 'service_writer' | 'manager_admin';
  trigger: string;
  outcome: 'auto_surface' | 'expanded' | 'dismissed' | 'proceeded';
};

const autoHelpAuditLog: AutoHelpAuditEntry[] = [];

export type OnboardingAuditEntry = {
  ts: number;
  userRole: HelpRole;
  stepId: string;
  playbookTitle: string;
  outcome: 'completed' | 'skipped' | 'mastered_auto';
  frictionTag?: string;
};

const onboardingAuditLog: OnboardingAuditEntry[] = [];

export type InsightAuditEntry = {
  ts: number;
  userRole: HelpRole;
  insightId: string;
  category: string;
  confidence: number;
  event: 'generated' | 'viewed' | 'dismissed' | 'acted';
};

const insightAuditLog: InsightAuditEntry[] = [];

export type SimulationAuditEntry = {
  ts: number;
  userRole: HelpRole;
  simulationId: string;
  event: 'run' | 'dismissed' | 'follow_up';
  assumptions?: string;
};

const simulationAuditLog: SimulationAuditEntry[] = [];

export function logHelpInteraction(entry: Omit<HelpAuditEntry, 'ts'>) {
  const record: HelpAuditEntry = { ts: Date.now(), ...entry };
  helpAuditLog.push(record);
  // Keep a reasonable in-memory cap to avoid runaway growth
  if (helpAuditLog.length > 500) {
    helpAuditLog.shift();
  }
}

export function getHelpAuditLog(): HelpAuditEntry[] {
  return [...helpAuditLog];
}

export function logAutoHelpEvent(entry: Omit<AutoHelpAuditEntry, 'ts'>) {
  const record: AutoHelpAuditEntry = { ts: Date.now(), ...entry };
  autoHelpAuditLog.push(record);
  if (autoHelpAuditLog.length > 500) {
    autoHelpAuditLog.shift();
  }
}

export function getAutoHelpAuditLog(): AutoHelpAuditEntry[] {
  return [...autoHelpAuditLog];
}

export function logOnboardingEvent(entry: Omit<OnboardingAuditEntry, 'ts'>) {
  const record: OnboardingAuditEntry = { ts: Date.now(), ...entry };
  onboardingAuditLog.push(record);
  if (onboardingAuditLog.length > 500) {
    onboardingAuditLog.shift();
  }
}

export function getOnboardingAuditLog(): OnboardingAuditEntry[] {
  return [...onboardingAuditLog];
}

export function logInsightEvent(entry: Omit<InsightAuditEntry, 'ts'>) {
  const record: InsightAuditEntry = { ts: Date.now(), ...entry };
  insightAuditLog.push(record);
  if (insightAuditLog.length > 500) {
    insightAuditLog.shift();
  }
}

export function getInsightAuditLog(): InsightAuditEntry[] {
  return [...insightAuditLog];
}

export function logSimulationEvent(entry: Omit<SimulationAuditEntry, 'ts'>) {
  const record: SimulationAuditEntry = { ts: Date.now(), ...entry };
  simulationAuditLog.push(record);
  if (simulationAuditLog.length > 500) {
    simulationAuditLog.shift();
  }
}

export function getSimulationAuditLog(): SimulationAuditEntry[] {
  return [...simulationAuditLog];
}
