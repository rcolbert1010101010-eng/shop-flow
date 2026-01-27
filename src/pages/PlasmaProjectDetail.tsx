import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, FileCheck, Plus, Trash2 } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useRepos } from '@/repos';
import type { PlasmaJobLine } from '@/types';

const UNLINKED_VALUE = '__UNLINKED__';
const CREATE_SO_VALUE = '__CREATE_SO__';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};
const formatNumber = (value: number | string | null | undefined, digits = 2) => toNumber(value).toFixed(digits);

export default function PlasmaProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const repos = useRepos();
  const plasmaRepo = repos.plasma;
  const salesOrderRepo = repos.salesOrders;
  const customersRepo = repos.customers;
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const templateOptions = plasmaRepo.templates.list();

  const plasmaData = id ? plasmaRepo.get(id) : null;
  const job = plasmaData?.job;
  const lines = useMemo(() => plasmaData?.lines ?? [], [plasmaData?.lines]);
  const salesOrders = salesOrderRepo.salesOrders;
  const customers = customersRepo.customers;
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    if (!job) {
      toast({ title: 'Plasma job not found', variant: 'destructive' });
      navigate('/plasma', { replace: true });
    }
  }, [id, job, navigate, toast]);

  const linkedSalesOrder = useMemo(
    () => (job?.sales_order_id ? salesOrders.find((so) => so.id === job.sales_order_id) : undefined),
    [job?.sales_order_id, salesOrders]
  );
  const salesOrderChargeLines = useMemo(
    () => (job?.sales_order_id ? salesOrderRepo.getSalesOrderChargeLines(job.sales_order_id) : []),
    [job?.sales_order_id, salesOrderRepo]
  );
  const plasmaChargeLine = useMemo(
    () =>
      salesOrderChargeLines.find(
        (cl) => cl.source_ref_type === 'PLASMA_JOB' && cl.source_ref_id === job?.id
      ),
    [salesOrderChargeLines, job?.id]
  );

  const isInvoiced = linkedSalesOrder?.status === 'INVOICED';
  const plasmaLocked = isInvoiced || (job ? job.status !== 'DRAFT' && job.status !== 'QUOTED' : false);
  const plasmaLines = useMemo(() => lines, [lines]);
  const plasmaTotal = useMemo(
    () => plasmaLines.reduce((sum, line) => sum + (line.sell_price_total ?? 0), 0),
    [plasmaLines]
  );
  const plasmaAttachments = job ? plasmaRepo.attachments.list(job.id) : [];

  const handleAddLine = () => {
    if (!job || plasmaLocked) return;
    plasmaRepo.upsertLine(job.id, {
      qty: 1,
      cut_length: 0,
      pierce_count: 0,
      setup_minutes: 0,
      machine_minutes: 0,
    });
  };

  const handleNumberChange = (
    lineId: string,
    field: keyof Pick<PlasmaJobLine, 'qty' | 'cut_length' | 'pierce_count' | 'setup_minutes' | 'machine_minutes' | 'thickness'>,
    value: string
  ) => {
    if (!job || plasmaLocked) return;
    const numeric = value === '' ? 0 : parseFloat(value);
    const safeValue = Number.isNaN(numeric) ? 0 : numeric;
    plasmaRepo.upsertLine(job.id, { id: lineId, [field]: safeValue } as Partial<PlasmaJobLine>);
  };

  const handleTextChange = (lineId: string, value: string) => {
    if (!job || plasmaLocked) return;
    plasmaRepo.upsertLine(job.id, { id: lineId, material_type: value });
  };

  const handleSellPriceChange = (lineId: string, value: string) => {
    if (!job || plasmaLocked) return;
    const numeric = value === '' ? 0 : parseFloat(value);
    const safeValue = Number.isNaN(numeric) ? 0 : numeric;
    const existing = lines.find((l) => l.id === lineId);
    const overrides = { ...(existing?.overrides || {}), sell_price_each: safeValue };
    plasmaRepo.upsertLine(job.id, { id: lineId, overrides });
  };

  const handleDeleteLine = (lineId: string) => {
    if (plasmaLocked) return;
    plasmaRepo.deleteLine(lineId);
  };

  const handleRecalculate = () => {
    if (!job) return;
    const result = plasmaRepo.recalc(job.id);
    if (!result.success) {
      toast({ title: 'Recalculate failed', description: result.error, variant: 'destructive' });
    } else {
      setWarnings(result.warnings ?? []);
      toast({ title: 'Pricing updated' });
    }
  };

  const ensureSalesOrderLink = () => {
    if (!job) return null;
    if (job.sales_order_id) return job.sales_order_id;
    const fallbackCustomer =
      customers.find((c) => c.id === 'walkin') || customers.find((c) => c.is_active) || customers[0];
    if (!fallbackCustomer) return null;
    const so = salesOrderRepo.createSalesOrder(fallbackCustomer.id, null);
    plasmaRepo.linkToSalesOrder(job.id, so.id);
    return so.id;
  };

  const handlePostToSalesOrder = () => {
    if (!job) return;
    if (plasmaLocked) {
      toast({ title: 'Locked', description: 'Order is invoiced or job is posted', variant: 'destructive' });
      return;
    }
    const soId = ensureSalesOrderLink();
    if (!soId) {
      toast({ title: 'No customer available to create Sales Order', variant: 'destructive' });
      return;
    }
    const result = plasmaRepo.postToSalesOrder(job.id);
    if (result.success) {
      toast({ title: 'Posted to Sales Order' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleAttachmentUpload = (file?: File) => {
    if (!job || !file) return;
    const result = plasmaRepo.attachments.add(job.id, file);
    if (!result.success) {
      toast({ title: 'Upload failed', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Attachment added' });
    }
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    if (!confirm('Remove this attachment?')) return;
    plasmaRepo.attachments.remove(attachmentId);
  };

  const handleAttachmentNoteChange = (attachmentId: string, notes: string) => {
    plasmaRepo.attachments.update(attachmentId, { notes });
  };

  const handleSalesOrderChange = (value: string) => {
    if (!job) return;
    if (value === CREATE_SO_VALUE) {
      const customer =
        customers.find((c) => c.id === 'walkin') || customers.find((c) => c.is_active) || customers[0];
      if (!customer) {
        toast({ title: 'No customers available', variant: 'destructive' });
        return;
      }
      const newOrder = salesOrderRepo.createSalesOrder(customer.id, null);
      plasmaRepo.linkToSalesOrder(job.id, newOrder.id);
      return;
    }
    if (value === UNLINKED_VALUE) {
      plasmaRepo.updateJob(job.id, { sales_order_id: null });
      return;
    }
    plasmaRepo.linkToSalesOrder(job.id, value);
  };

  if (!job) return null;

  return (
    <TooltipProvider>
      <div className="page-container">
        <PageHeader title={`Plasma Project ${job.id}`} backTo="/plasma" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <Label className="flex items-center gap-1">Status</Label>
              <div className="mt-1 flex gap-2 items-center">
                <Badge variant="secondary">{job.status}</Badge>
                {job.posted_at && (
                  <Badge variant="outline">Posted {new Date(job.posted_at).toLocaleString()}</Badge>
                )}
                {plasmaLocked && <Badge variant="outline">Locked</Badge>}
              </div>
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1">Sales Order</Label>
            <Select
              value={job.sales_order_id ?? UNLINKED_VALUE}
              onValueChange={handleSalesOrderChange}
              disabled={plasmaLocked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Sales Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNLINKED_VALUE}>Not linked</SelectItem>
                <SelectItem value={CREATE_SO_VALUE}>Create new Sales Order</SelectItem>
                {salesOrders.map((so) => (
                  <SelectItem key={so.id} value={so.id}>
                    {so.order_number || so.id} ({so.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {linkedSalesOrder && (
              <div className="mt-2 text-sm">
                <Link to={`/sales-orders/${linkedSalesOrder.id}`} className="text-primary hover:underline">
                  View Sales Order
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-end justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleRecalculate}
            disabled={!job || plasmaLocked}
            title="Rebuilds pricing from the current line inputs. Use after changing thickness, cut length, or minutes."
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Recalculate
          </Button>
          <Button
            onClick={handlePostToSalesOrder}
            disabled={plasmaLocked || lines.length === 0}
            title="Locks the plasma job so pricing can't drift after approval."
          >
            <FileCheck className="w-4 h-4 mr-2" />
            Post to Sales Order
          </Button>
          {linkedSalesOrder && (
            <Button variant="outline" onClick={() => navigate(`/sales-orders/${linkedSalesOrder.id}`)}>
              View linked order
            </Button>
          )}
          {job && (
            <Button variant="outline" onClick={() => navigate(`/plasma/${job.id}/print`)}>
              Print Cut Sheet
            </Button>
          )}
          {templateOptions.length > 0 && job && (
            <Select
              onValueChange={(val) => {
                if (val === '__NONE__') return;
                const result = plasmaRepo.templates.applyToJob(val, job.id);
                if (!result.success) {
                  toast({ title: 'Template error', description: result.error, variant: 'destructive' });
                } else {
                  toast({ title: 'Template applied' });
                }
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Add from Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__" disabled>
                  Select template
                </SelectItem>
                {templateOptions.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {plasmaLocked && (
        <div className="mt-3 text-sm text-muted-foreground">
          Editing is disabled because the job is posted or the linked Sales Order is invoiced.
        </div>
      )}
      {warnings.length > 0 && (
        <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          <div className="flex items-center gap-1 mb-1">
            <span className="font-medium">Warnings</span>
          </div>
          {warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      )}

      <div className="mt-6 table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">
                <span className="flex items-center justify-end gap-1">Thickness</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="flex items-center justify-end gap-1">Qty</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="flex items-center justify-end gap-1">Cut Length</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="flex items-center justify-end gap-1">Pierces</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="flex items-center justify-end gap-1">Setup (min)</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="flex items-center justify-end gap-1">Machine (min)</span>
              </TableHead>
              <TableHead className="text-right">Derived?</TableHead>
              <TableHead className="text-right">
                <span className="flex items-center justify-end gap-1">Unit Sell</span>
              </TableHead>
              <TableHead className="text-right">Total</TableHead>
              {!isInvoiced && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isInvoiced ? 9 : 10} className="text-center text-muted-foreground py-6">
                  No lines yet.
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <Input
                      value={line.material_type ?? ''}
                      onChange={(e) => handleTextChange(line.id, e.target.value)}
                      disabled={plasmaLocked}
                      placeholder="Material"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={line.thickness ?? ''}
                      onChange={(e) => handleNumberChange(line.id, 'thickness', e.target.value)}
                      disabled={plasmaLocked}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={line.qty}
                      onChange={(e) => handleNumberChange(line.id, 'qty', e.target.value)}
                      disabled={plasmaLocked}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.cut_length ?? ''}
                      onChange={(e) => handleNumberChange(line.id, 'cut_length', e.target.value)}
                      disabled={plasmaLocked}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={line.pierce_count ?? ''}
                      onChange={(e) => handleNumberChange(line.id, 'pierce_count', e.target.value)}
                      disabled={plasmaLocked}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={line.setup_minutes ?? ''}
                      onChange={(e) => handleNumberChange(line.id, 'setup_minutes', e.target.value)}
                      disabled={plasmaLocked}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell>
                   <Input
                     type="number"
                     min="0"
                     step="0.1"
                     value={line.machine_minutes ?? ''}
                     onChange={(e) => handleNumberChange(line.id, 'machine_minutes', e.target.value)}
                     disabled={plasmaLocked}
                     className="text-right"
                   />
                 </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {line.override_machine_minutes ? (
                      <Badge variant="outline">Override</Badge>
                    ) : line.derived_machine_minutes != null ? (
                      <Badge variant="secondary">Derived</Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.sell_price_each ?? 0}
                      onChange={(e) => handleSellPriceChange(line.id, e.target.value)}
                      disabled={plasmaLocked}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">${formatNumber(line.sell_price_total)}</TableCell>
                  {!plasmaLocked && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleRecalculate()}>
                          Quick-Fill
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteLine(line.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        {!plasmaLocked && (
          <Button variant="outline" size="sm" onClick={handleAddLine}>
            <Plus className="w-4 h-4 mr-2" />
            Add Line
          </Button>
        )}
        <div className="text-right text-sm space-y-1">
          <div className="font-medium flex items-center justify-end gap-1">
            <span>Plasma Total: ${formatNumber(plasmaTotal)}</span>
          </div>
          {plasmaChargeLine && (
            <div className="text-muted-foreground">
              Posted as "{plasmaChargeLine.description}" (${formatNumber(plasmaChargeLine.total_price)})
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Attachments</h4>
            <p className="text-sm text-muted-foreground">
              DXF parsing/nesting not enabled yet — attachments are for reference.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={attachmentInputRef}
              type="file"
              accept=".dxf,.pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => handleAttachmentUpload(e.target.files?.[0])}
              disabled={plasmaLocked}
            />
            <Button variant="outline" size="sm" onClick={() => attachmentInputRef.current?.click()} disabled={plasmaLocked}>
              Upload
            </Button>
          </div>
        </div>
        <div className="table-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Added</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plasmaAttachments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    No attachments yet.
                  </TableCell>
                </TableRow>
              ) : (
                plasmaAttachments.map((att) => (
                  <TableRow key={att.id}>
                    <TableCell className="font-medium">{att.filename}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{att.kind}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatNumber(att.size_bytes / 1024 / 1024)} MB
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={att.notes ?? ''}
                        onBlur={(e) => handleAttachmentNoteChange(att.id, e.target.value)}
                        disabled={plasmaLocked}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {new Date(att.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {!plasmaLocked && (
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveAttachment(att.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
