import { useEffect, useMemo, useState } from 'react';
import { runSimulations, type Simulation } from '@/services/insights/simulationEngine';
import { useShopStore } from '@/stores/shopStore';
import { usePermissions } from '@/security/usePermissions';
import type { Role } from '@/security/rbac';
import type { HelpRole } from '@/help/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { logSimulationEvent } from '@/components/help/helpAudit';

function mapRole(role: Role | undefined): HelpRole {
  if (role === 'ADMIN' || role === 'MANAGER') return 'Manager/Admin';
  if (role === 'SERVICE_WRITER') return 'Service Writer';
  return 'Technician';
}

type SimulationRowProps = {
  sim: Simulation;
  onDismiss: () => void;
  onFollowUp: () => void;
};

function SimulationRow({ sim, onDismiss, onFollowUp }: SimulationRowProps) {
  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline">Simulation</Badge>
        <span className="text-xs text-muted-foreground">Confidence: {(sim.confidence * 100).toFixed(0)}%</span>
      </div>
      <div className="text-sm font-semibold text-foreground">{sim.headline}</div>
      <div className="text-sm text-foreground">Scenario: {sim.scenario}</div>
      <div className="text-xs text-muted-foreground">Assumptions: {sim.assumptions}</div>
      <div className="text-xs text-muted-foreground">Simulated: {sim.simulated}</div>
      <div className="text-sm text-foreground">Projected outcome: {sim.outcome}</div>
      <div className="text-xs text-muted-foreground">Risks & tradeoffs: {sim.risks}</div>
      <div className="text-xs text-muted-foreground">Improve accuracy: {sim.improveAccuracy}</div>
      {sim.supportingRecords.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="font-semibold text-foreground text-xs">Supporting data</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {sim.supportingRecords.map((rec) => (
              <li key={rec.url}>{rec.label}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
        <Button variant="secondary" size="sm" onClick={onFollowUp}>
          Mark follow-up
        </Button>
      </div>
    </div>
  );
}

export function SimulationsPanel() {
  const { role } = usePermissions();
  const helpRole = useMemo(() => mapRole(role), [role]);
  const {
    workOrders,
    workOrderLaborLines,
    workOrderPartLines,
    timeEntries,
    parts,
    plasmaJobs,
    plasmaAttachments,
  } = useShopStore();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [viewed, setViewed] = useState<Set<string>>(new Set());

  const simulations = useMemo(
    () =>
      runSimulations(helpRole, {
        workOrders,
        laborLines: workOrderLaborLines,
        partLines: workOrderPartLines,
        timeEntries,
        parts,
        plasmaJobs,
        plasmaAttachments,
      }),
    [helpRole, workOrders, workOrderLaborLines, workOrderPartLines, timeEntries, parts, plasmaJobs, plasmaAttachments]
  ).filter((sim) => !dismissed.has(sim.id) && !followed.has(sim.id));

  useEffect(() => {
    const unseen = simulations.filter((sim) => !viewed.has(sim.id));
    if (unseen.length > 0 && helpRole === 'Manager/Admin') {
      const next = new Set(viewed);
      unseen.forEach((sim) => {
        next.add(sim.id);
        logSimulationEvent({ userRole: helpRole, simulationId: sim.id, event: 'run', assumptions: sim.assumptions });
      });
      setViewed(next);
    }
  }, [helpRole, simulations, viewed]);

  if (helpRole !== 'Manager/Admin' || simulations.length === 0) return null;

  const handleDismiss = (sim: Simulation) => {
    setDismissed((prev) => new Set(prev).add(sim.id));
    logSimulationEvent({ userRole: helpRole, simulationId: sim.id, event: 'dismissed' });
  };

  const handleFollowUp = (sim: Simulation) => {
    setFollowed((prev) => new Set(prev).add(sim.id));
    logSimulationEvent({ userRole: helpRole, simulationId: sim.id, event: 'follow_up' });
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base">AI What-If Simulations (read-only)</CardTitle>
        <p className="text-xs text-muted-foreground">Managers/Owners only. No changes are applied.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {simulations.map((sim) => (
          <SimulationRow
            key={sim.id}
            sim={sim}
            onDismiss={() => handleDismiss(sim)}
            onFollowUp={() => handleFollowUp(sim)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
