import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/help/HelpTooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useRepos } from '@/repos';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};
const formatNumber = (value: number | string | null | undefined, digits = 2) => toNumber(value).toFixed(digits);

export default function PlasmaPrint() {
  const { id } = useParams<{ id: string }>();
  const repos = useRepos();
  const plasmaPrint = id ? repos.plasma.getPrintView(id) : null;
  const navigate = useNavigate();

  if (!plasmaPrint) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Plasma Cut Sheet</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
        <p className="text-muted-foreground">Plasma job not found.</p>
      </div>
    );
  }

  const { job, lines, workOrder, salesOrder, customerName, metrics, attachments } = plasmaPrint;
  const lineTotals = {
    cut: lines.reduce((sum, line) => sum + (line.cut_length ?? 0) * (line.qty ?? 0), 0),
    pierces: lines.reduce((sum, line) => sum + (line.pierce_count ?? 0) * (line.qty ?? 0), 0),
    machine: lines.reduce((sum, line) => sum + (line.machine_minutes ?? 0) * (line.qty ?? 0), 0),
  };

  return (
    <TooltipProvider>
      <div className="page-container">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-1">
              Plasma Cut Sheet / Shop Traveler
              <HelpTooltip content="Print-friendly cut list for the table: qty, thickness, cut length, pierces, and notes." />
            </h1>
          <div className="text-sm text-muted-foreground">
            Job ID: {job.id} &middot; Status: <Badge variant="outline">{job.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Created: {new Date(job.created_at).toLocaleString()} &middot; Updated: {new Date(job.updated_at).toLocaleString()}
          </div>
          {job.posted_at && (
            <div className="text-sm text-muted-foreground">Posted: {new Date(job.posted_at).toLocaleString()}</div>
          )}
          {customerName && <div className="text-sm">Customer: {customerName}</div>}
          <div className="text-sm">
            {workOrder && (
              <span className="mr-2">
                WO: <Link className="text-primary hover:underline" to={`/work-orders/${workOrder.id}`}>{workOrder.order_number || workOrder.id}</Link>
              </span>
            )}
            {salesOrder && (
              <span>
                SO: <Link className="text-primary hover:underline" to={`/sales-orders/${salesOrder.id}`}>{salesOrder.order_number || salesOrder.id}</Link>
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <div className="p-3 border rounded-lg">
          <div className="text-muted-foreground">Total Qty</div>
          <div className="font-semibold">{metrics.total_qty}</div>
        </div>
        <div className="p-3 border rounded-lg">
          <div className="text-muted-foreground">Total Cut Length</div>
          <div className="font-semibold">{formatNumber(metrics.total_cut_length)}</div>
        </div>
        <div className="p-3 border rounded-lg">
          <div className="text-muted-foreground">Total Pierces</div>
          <div className="font-semibold">{metrics.total_pierces}</div>
        </div>
        <div className="p-3 border rounded-lg">
          <div className="text-muted-foreground">Total Machine Minutes</div>
          <div className="font-semibold">{formatNumber(metrics.total_machine_minutes)}</div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 text-sm mb-4">
        <div className="p-3 border rounded-lg bg-muted/30">
          <div className="font-semibold mb-1">From Lines</div>
          <div>Cut: {formatNumber(lineTotals.cut)} in</div>
          <div>Pierces: {lineTotals.pierces}</div>
          <div>Machine: {formatNumber(lineTotals.machine)} min</div>
        </div>
        <div className="p-3 border rounded-lg bg-muted/30">
          <div className="font-semibold mb-1">DXF Estimate</div>
          <div>
            Cut: {job.dxf_estimated_total_cut_length != null ? job.dxf_estimated_total_cut_length : '—'}
          </div>
          <div>Pierces: {job.dxf_estimated_total_pierces ?? '—'}</div>
          <div>Machine: {job.dxf_estimated_machine_minutes ?? '—'} min</div>
          {job.dxf_notes && <div className="mt-1 text-muted-foreground">{job.dxf_notes}</div>}
        </div>
      </div>

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Qty</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Thickness</TableHead>
              <TableHead className="text-right">Cut Length</TableHead>
              <TableHead className="text-right">Pierces</TableHead>
              <TableHead className="text-right">Setup (min)</TableHead>
              <TableHead className="text-right">Machine (min)</TableHead>
              <TableHead>Notes / Overrides</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.qty}</TableCell>
                <TableCell>{line.material_type || '-'}</TableCell>
                <TableCell className="text-right">{line.thickness ?? '-'}</TableCell>
                <TableCell className="text-right">{line.cut_length ?? '-'}</TableCell>
                <TableCell className="text-right">{line.pierce_count ?? '-'}</TableCell>
                <TableCell className="text-right">{line.setup_minutes ?? '-'}</TableCell>
                <TableCell className="text-right">{line.machine_minutes ?? '-'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {line.overrides?.sell_price_each != null
                    ? `Price override: ${line.overrides.sell_price_each}`
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="font-semibold mb-2">Shop Notes</div>
          <div className="min-h-[80px] border rounded-lg p-3 bg-muted/30">{job.notes || 'N/A'}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-lg p-3 h-24 flex flex-col justify-end">
            <div className="border-t pt-2 text-center text-muted-foreground">Operator Signature</div>
          </div>
          <div className="border rounded-lg p-3 h-24 flex flex-col justify-end">
            <div className="border-t pt-2 text-center text-muted-foreground">QC Signature</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Attachments</h3>
        <div className="text-sm text-muted-foreground mb-2">
          DXF parsing/nesting not enabled yet — attachments are for reference.
        </div>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments.</p>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.map((att) => (
                  <TableRow key={att.id}>
                    <TableCell>{att.filename}</TableCell>
                    <TableCell>{att.kind}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{att.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
