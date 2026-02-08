import { useEffect, useMemo, useState } from 'react';
import type { Insight } from '@/services/insights/insightsEngine';
import { generateInsights } from '@/services/insights/insightsEngine';
import { useShopStore } from '@/stores/shopStore';
import { usePermissions } from '@/security/usePermissions';
import type { Role } from '@/security/rbac';
import type { HelpRole } from '@/help/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { logInsightEvent } from '@/components/help/helpAudit';

function mapRole(role: Role | undefined): HelpRole {
  if (role === 'ADMIN' || role === 'MANAGER') return 'Manager/Admin';
  if (role === 'SERVICE_WRITER') return 'Service Writer';
  return 'Technician';
}

type InsightRowProps = {
  insight: Insight;
  onDismiss: () => void;
  onActed: () => void;
};

function InsightRow({ insight, onDismiss, onActed }: InsightRowProps) {
  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline">{insight.category}</Badge>
        <span className="text-xs text-muted-foreground">Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
      </div>
      <div className="text-sm font-semibold text-foreground">{insight.headline}</div>
      {insight.prediction && <div className="text-sm text-foreground">Prediction: {insight.prediction}</div>}
      <div className="text-sm text-foreground">{insight.observation}</div>
      {insight.supportingEvidence && (
        <div className="text-xs text-muted-foreground">Evidence: {insight.supportingEvidence}</div>
      )}
      <div className="text-xs text-muted-foreground">Why it matters: {insight.whyMatters}</div>
      <div className="text-sm text-foreground">Suggested action: {insight.action}</div>
      {insight.riskReduction && (
        <div className="text-xs text-muted-foreground">Reduce this risk: {insight.riskReduction}</div>
      )}
      {insight.supportingRecords.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="font-semibold text-foreground text-xs">Supporting records</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {insight.supportingRecords.map((rec) => (
              <li key={rec.url}>{rec.label}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
        <Button variant="secondary" size="sm" onClick={onActed}>
          Mark acted
        </Button>
      </div>
    </div>
  );
}

export function InsightsPanel() {
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
  const [acted, setActed] = useState<Set<string>>(new Set());

  const insights = useMemo(
    () =>
      generateInsights(helpRole, {
        workOrders,
        laborLines: workOrderLaborLines,
        partLines: workOrderPartLines,
        timeEntries,
        parts,
        plasmaJobs,
        plasmaAttachments,
      }),
    [helpRole, workOrders, workOrderLaborLines, workOrderPartLines, timeEntries, parts, plasmaJobs, plasmaAttachments]
  ).filter((insight) => !dismissed.has(insight.id) && !acted.has(insight.id));

  const [viewed, setViewed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const toViewLog = insights.filter((insight) => !viewed.has(insight.id));
    if (toViewLog.length > 0 && helpRole === 'Manager/Admin') {
      const next = new Set(viewed);
      toViewLog.forEach((insight) => {
        next.add(insight.id);
        logInsightEvent({
          userRole: helpRole,
          insightId: insight.id,
          category: insight.category,
          confidence: insight.confidence,
          event: 'viewed',
        });
      });
      setViewed(next);
    }
  }, [helpRole, insights, viewed]);

  if (helpRole !== 'Manager/Admin') return null;

  const handleDismiss = (insight: Insight) => {
    setDismissed((prev) => new Set(prev).add(insight.id));
    logInsightEvent({
      userRole: helpRole,
      insightId: insight.id,
      category: insight.category,
      confidence: insight.confidence,
      event: 'dismissed',
    });
  };

  const handleActed = (insight: Insight) => {
    setActed((prev) => new Set(prev).add(insight.id));
    logInsightEvent({
      userRole: helpRole,
      insightId: insight.id,
      category: insight.category,
      confidence: insight.confidence,
      event: 'acted',
    });
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base">AI Insights (read-only)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Based on audit signals and locked records. No changes are applied automatically.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-2">
            <div className="text-foreground font-medium">No insights yet.</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Create a work order and log labor/parts activity.</li>
              <li>Add parts or update inventory counts.</li>
              <li>Record technician time entries as work progresses.</li>
              <li>Create a purchase order for needed stock.</li>
              <li>Receive inventory against open purchase orders.</li>
              <li>Sync QuickBooks if your integration is enabled.</li>
            </ul>
          </div>
        ) : (
          insights.map((insight) => (
            <InsightRow
              key={insight.id}
              insight={insight}
              onDismiss={() => handleDismiss(insight)}
              onActed={() => handleActed(insight)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
