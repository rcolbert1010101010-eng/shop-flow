import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Sparkles } from 'lucide-react';
import { summarizeWorkOrder, summarizeSalesOrder, rewriteCustomerSafe, explainOrder, suggestParts } from '@/services/aiAssist/aiAssistPreview';
import type {
  Customer,
  Part,
  SalesOrder,
  SalesOrderChargeLine,
  SalesOrderLine,
  Unit,
  WorkOrder,
  WorkOrderChargeLine,
  WorkOrderLaborLine,
  WorkOrderPartLine,
} from '@/types';

type WorkOrderContext = {
  type: 'workOrder';
  order: WorkOrder;
  customer?: Customer;
  unit?: Unit;
  partLines?: WorkOrderPartLine[];
  laborLines?: WorkOrderLaborLine[];
  chargeLines?: WorkOrderChargeLine[];
};

type SalesOrderContext = {
  type: 'salesOrder';
  order: SalesOrder;
  customer?: Customer;
  unit?: Unit;
  lines?: SalesOrderLine[];
  chargeLines?: SalesOrderChargeLine[];
};

type Props = {
  context: WorkOrderContext | SalesOrderContext;
  parts?: Part[];
  notesValue?: string;
  onApplyNote?: (original: string, rewritten: string) => void;
  onSelectPart?: (partId: string) => void;
  originalStoredNote?: string | null;
};

const copyToClipboard = (text: string) => {
  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
  }
};

export function AIAssistPanel({ context, parts = [], notesValue = '', onApplyNote, onSelectPart, originalStoredNote }: Props) {
  const [noteInput, setNoteInput] = useState(notesValue);
  const [noteOutput, setNoteOutput] = useState('');
  const [partsQuery, setPartsQuery] = useState('');

  useEffect(() => {
    setNoteInput(notesValue);
  }, [notesValue]);

  const summary = useMemo(() => {
    if (context.type === 'workOrder') {
      return summarizeWorkOrder({
        order: context.order,
        customer: context.customer,
        unit: context.unit,
        partLines: context.partLines,
        laborLines: context.laborLines,
        chargeLines: context.chargeLines,
      });
    }
    return summarizeSalesOrder({
      order: context.order,
      customer: context.customer,
      unit: context.unit,
      lines: context.lines,
      chargeLines: context.chargeLines,
    });
  }, [context]);

  const explanation = useMemo(() => {
    const base =
      context.type === 'workOrder'
        ? context.order
        : {
            parts_subtotal: (context.order as any).parts_subtotal ?? (context.order as any).subtotal,
            labor_subtotal: (context.order as any).labor_subtotal,
            charge_subtotal: (context.order as any).charge_subtotal,
            core_charges_total: (context.order as any).core_charges_total,
            tax_amount: context.order.tax_amount,
            tax_rate: context.order.tax_rate,
            subtotal: context.order.subtotal,
            total: context.order.total,
          };
    return explainOrder(base);
  }, [context]);

  const partSuggestions = useMemo(() => suggestParts(partsQuery, parts), [parts, partsQuery]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">AI Assist (Preview)</p>
          <p className="text-xs text-muted-foreground">This is a demo. No external AI calls.</p>
        </div>
        <Sparkles className="w-4 h-4 text-primary" />
      </div>

      <Tabs defaultValue="summary" className="space-y-3">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="explain">Explain</TabsTrigger>
          <TabsTrigger value="parts">Parts Assist</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-2">
          <p className="text-sm text-muted-foreground">Customer-safe overview you can share.</p>
          <Textarea value={summary} readOnly className="min-h-[160px]" />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => copyToClipboard(summary)}>
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Paste or edit text, then rewrite for customers. Original is kept in memory.
          </p>
          <Textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Enter notes to rewrite" />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                const rewritten = rewriteCustomerSafe(noteInput);
                setNoteOutput(rewritten);
              }}
            >
              Rewrite
            </Button>
            {noteOutput && (
              <>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(noteOutput)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                {onApplyNote && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onApplyNote(noteInput, noteOutput);
                    }}
                  >
                    Apply
                  </Button>
                )}
              </>
            )}
          </div>
          {noteOutput && (
            <div className="space-y-1">
              <LabelRow label="Rewritten">
                <Textarea readOnly value={noteOutput} className="min-h-[140px]" />
              </LabelRow>
            </div>
          )}
          {originalStoredNote && (
            <p className="text-xs text-muted-foreground">Original preserved in memory.</p>
          )}
        </TabsContent>

        <TabsContent value="explain" className="space-y-2">
          <p className="text-sm text-muted-foreground">Plain-English cost breakdown.</p>
          <Textarea value={explanation} readOnly className="min-h-[140px]" />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => copyToClipboard(explanation)}>
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="parts" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Text-only lookup that suggests existing parts. Selecting only fills the picker; it never auto-adds lines.
          </p>
          <Input
            value={partsQuery}
            onChange={(e) => setPartsQuery(e.target.value)}
            placeholder="Describe or paste a part #"
          />
          <div className="space-y-2">
            {partSuggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Start typing to see suggestions.</p>
            ) : (
              partSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {suggestion.partNumber} — {suggestion.description || 'Part'}
                    </div>
                    <div className="text-xs text-muted-foreground">Reason: {suggestion.reason}</div>
                  </div>
                  {onSelectPart && (
                    <Button size="sm" variant="outline" onClick={() => onSelectPart(suggestion.id)}>
                      Select
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LabelRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
