import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';

type ProfitabilityCategory = {
  label: string;
  revenue: number;
  hasCost: boolean;
  cost: number | null;
  gp: number | null;
  gpPct: number | null;
};

type ProfitabilitySummary = {
  categories: ProfitabilityCategory[];
  overall: ProfitabilityCategory;
};

interface ProfitabilityPanelProps {
  summary: ProfitabilitySummary;
  formatCurrency?: (value: number | string | null | undefined) => string;
}

const defaultFormatCurrency = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : 0;
  return numeric.toFixed(2);
};

const marginBadgeClass = (pct: number | null | undefined) => {
  if (pct == null) return '';
  if (pct >= 30) return 'text-green-700 bg-green-100';
  if (pct >= 15) return 'text-amber-700 bg-amber-100';
  return 'text-red-700 bg-red-100';
};

export function ProfitabilityPanel({ summary, formatCurrency = defaultFormatCurrency }: ProfitabilityPanelProps) {
  const missingCostCategories = summary.categories.filter((c) => !c.hasCost || c.cost == null);

  const overallMarginBadge = summary.overall.gpPct != null && (
    <Badge className={marginBadgeClass(summary.overall.gpPct)} variant="outline">
      {summary.overall.gpPct.toFixed(1)}%
    </Badge>
  );

  const tileValue = (value: number | null | undefined, showDash = false) => {
    if (value == null) return showDash ? '—' : '$0.00';
    return `$${formatCurrency(value)}`;
  };

  return (
    <Card className="p-4 space-y-4 border border-border bg-card/60">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border p-3 min-w-0 overflow-hidden">
          <div className="text-xs uppercase text-muted-foreground leading-tight truncate">Revenue</div>
          <div className="text-lg font-semibold text-foreground whitespace-nowrap tabular-nums leading-none">
            {tileValue(summary.overall.revenue)}
          </div>
        </div>
        <div className="rounded-md border border-border p-3 min-w-0 overflow-hidden">
          <div className="text-xs uppercase text-muted-foreground leading-tight truncate">Cost</div>
          <div className="text-lg font-semibold text-foreground whitespace-nowrap tabular-nums leading-none">
            {summary.overall.hasCost && summary.overall.cost != null ? tileValue(summary.overall.cost) : '—'}
          </div>
          {!summary.overall.hasCost && <div className="text-[11px] text-muted-foreground truncate">Cost unavailable</div>}
        </div>
        <div className="rounded-md border border-border p-3 min-w-0 overflow-hidden">
          <div className="text-xs uppercase text-muted-foreground leading-tight truncate">Gross Profit</div>
          <div className="text-lg font-semibold text-foreground whitespace-nowrap tabular-nums leading-none">
            {summary.overall.gp != null ? tileValue(summary.overall.gp) : '—'}
          </div>
        </div>
        <div className="rounded-md border border-border p-3 min-w-0 overflow-hidden flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs uppercase text-muted-foreground leading-tight truncate">Margin %</div>
            <div className="text-lg font-semibold text-foreground whitespace-nowrap tabular-nums leading-none">
              {summary.overall.gpPct != null ? `${summary.overall.gpPct.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="min-w-0">{overallMarginBadge}</div>
        </div>
      </div>

      {/* Missing cost notice */}
      {missingCostCategories.length > 0 && (
        <Alert variant="default" className="py-2 px-3 text-sm leading-snug my-1">
          <AlertDescription className="text-sm leading-snug">
            Some margins unavailable: {missingCostCategories.map((c) => c.label).join(', ')} cost not configured.
          </AlertDescription>
        </Alert>
      )}

      {/* Breakdown table */}
      <div className="text-xs text-muted-foreground space-y-1">
        {summary.categories.map((cat, idx) => (
          <div
            key={cat.label}
            className={`flex items-start justify-between gap-3 rounded-md px-2 py-2 ${idx % 2 === 0 ? 'bg-muted/30' : ''}`}
          >
            <div className="text-foreground font-medium truncate">{cat.label}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground min-w-[220px]">
              <div className="flex items-center justify-between gap-2">
                <span>Revenue</span>
                <span className="text-foreground tabular-nums text-sm">
                  ${formatCurrency(cat.revenue)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>GP</span>
                <span className="text-foreground tabular-nums text-sm">
                  {cat.gp != null ? `$${formatCurrency(cat.gp)}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Cost</span>
                <span className="text-foreground tabular-nums text-sm">
                  {cat.hasCost && cat.cost != null ? `$${formatCurrency(cat.cost)}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Margin</span>
                <span className="text-foreground tabular-nums text-sm">
                  {cat.gpPct != null ? (
                    <Badge className={`${marginBadgeClass(cat.gpPct)} text-[10px]`} variant="outline">
                      {cat.gpPct.toFixed(1)}%
                    </Badge>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-start justify-between gap-3 rounded-md px-2 py-2 bg-muted/50 font-semibold">
          <div className="text-foreground truncate">Overall</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground min-w-[220px]">
            <div className="flex items-center justify-between gap-2">
              <span>Revenue</span>
              <span className="text-foreground tabular-nums text-sm">
                ${formatCurrency(summary.overall.revenue)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>GP</span>
              <span className="text-foreground tabular-nums text-sm">
                {summary.overall.gp != null ? `$${formatCurrency(summary.overall.gp)}` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Cost</span>
              <span className="text-foreground tabular-nums text-sm">
                {summary.overall.hasCost && summary.overall.cost != null ? `$${formatCurrency(summary.overall.cost)}` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Margin</span>
              <span className="text-foreground tabular-nums text-sm">
                {summary.overall.gpPct != null ? (
                  <Badge className={`${marginBadgeClass(summary.overall.gpPct)} text-[10px]`} variant="outline">
                    {summary.overall.gpPct.toFixed(1)}%
                  </Badge>
                ) : (
                  '—'
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible details */}
      <Accordion type="single" collapsible className="w-full pt-2 border-t border-border space-y-1">
        {summary.categories.map((cat) => (
          <AccordionItem key={cat.label} value={cat.label}>
            <AccordionTrigger className="text-xs px-0">{cat.label} details</AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground space-y-1 px-1">
              <div className="flex justify-between">
                <span>Revenue</span>
                <span className="text-foreground">${formatCurrency(cat.revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cost</span>
                <span>{cat.hasCost && cat.cost != null ? `$${formatCurrency(cat.cost)}` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Gross Profit</span>
                <span>{cat.gp != null ? `$${formatCurrency(cat.gp)}` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Margin %</span>
                <span>
                  {cat.gpPct != null ? (
                    <Badge className={marginBadgeClass(cat.gpPct)} variant="outline">
                      {cat.gpPct.toFixed(1)}%
                    </Badge>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              {!cat.hasCost && <div className="text-[11px] text-muted-foreground">Cost not available for this category.</div>}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Card>
  );
}
