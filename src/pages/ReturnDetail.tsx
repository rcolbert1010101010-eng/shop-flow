import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useRepos } from '@/repos';
import type { ReturnStatus, ReturnLineCondition } from '@/types';
import { Badge } from '@/components/ui/badge';
import { getReturnInsights } from '@/services/returnsWarrantyInsights';

const STATUS_FLOW: ReturnStatus[] = ['DRAFT', 'REQUESTED', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CREDITED', 'CLOSED', 'CANCELLED'];
const CONDITIONS: ReturnLineCondition[] = ['NEW', 'INSTALLED', 'DEFECTIVE', 'DAMAGED', 'UNKNOWN'];

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function ReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const repos = useRepos();
  const { returns, getReturnLines, updateReturn, setReturnStatus, addReturnLine, updateReturnLine, removeReturnLine } = repos.returns;
  const { vendors } = repos.vendors;
  const { parts } = repos.parts;
  const currentReturn = returns.find((r) => r.id === id);

  const [newLinePartId, setNewLinePartId] = useState('');
  const [newLineQty, setNewLineQty] = useState('1');
  const [newLineCost, setNewLineCost] = useState('');
  const [newLineCondition, setNewLineCondition] = useState<ReturnLineCondition>('UNKNOWN');
  const [newLineReason, setNewLineReason] = useState('');

  const lines = currentReturn ? getReturnLines(currentReturn.id) : [];
  const vendor = vendors.find((v) => v.id === currentReturn?.vendor_id);
  const insight = currentReturn ? getReturnInsights(currentReturn, { returns, returnLines: repos.returns.returnLines }) : null;

  if (!currentReturn) {
    return (
      <div className="page-container">
        <PageHeader title="Return Not Found" backTo="/returns" />
        <p className="text-muted-foreground">This return does not exist.</p>
      </div>
    );
  }

  const handleStatusChange = (status: ReturnStatus) => setReturnStatus(currentReturn.id, status);

  const handleFieldChange = (field: keyof typeof currentReturn, value: string | null | number) => {
    updateReturn(currentReturn.id, { [field]: value, updated_at: new Date().toISOString() });
  };

  const handleNumberField = (field: keyof typeof currentReturn, value: string) => {
    if (value === '') {
      handleFieldChange(field, null);
      return;
    }
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) return;
    handleFieldChange(field, num);
  };

  const handleAddLine = () => {
    if (!newLinePartId || Number(newLineQty) <= 0) return;
    addReturnLine(currentReturn.id, {
      part_id: newLinePartId,
      quantity: Number(newLineQty),
      unit_cost: newLineCost === '' ? null : Number(newLineCost),
      condition: newLineCondition,
      reason: newLineReason || null,
    });
    setNewLinePartId('');
    setNewLineQty('1');
    setNewLineCost('');
    setNewLineReason('');
    setNewLineCondition('UNKNOWN');
  };

  return (
    <div className="page-container">
      <PageHeader
        title={currentReturn.rma_number || currentReturn.id}
        subtitle={vendor?.vendor_name || 'Return'}
        backTo="/returns"
        actions={<StatusBadge status={currentReturn.status} />}
      />

      <div className="form-section space-y-4">
        {insight && (
          <div className="flex items-center gap-2">
            <Badge variant={insight.severity === 'danger' ? 'destructive' : insight.severity === 'warning' ? 'secondary' : 'outline'}>
              {insight.summary}
            </Badge>
            {insight.severity !== 'info' && (
              <span className="text-xs text-destructive">{insight.flags.join(', ')}</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {STATUS_FLOW.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={currentReturn.status === status ? 'default' : 'outline'}
              onClick={() => handleStatusChange(status)}
            >
              {status}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">RMA #</label>
            <Input value={currentReturn.rma_number || ''} onChange={(e) => handleFieldChange('rma_number', e.target.value || null)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Carrier</label>
            <Input value={currentReturn.carrier || ''} onChange={(e) => handleFieldChange('carrier', e.target.value || null)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Tracking #</label>
            <Input value={currentReturn.tracking_number || ''} onChange={(e) => handleFieldChange('tracking_number', e.target.value || null)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Approved Amount</label>
            <Input
              type="number"
              min="0"
              value={currentReturn.approved_amount ?? ''}
              onChange={(e) => handleNumberField('approved_amount', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Credit Memo #</label>
            <Input value={currentReturn.credit_memo_number || ''} onChange={(e) => handleFieldChange('credit_memo_number', e.target.value || null)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Credit Memo Amount</label>
            <Input
              type="number"
              min="0"
              value={currentReturn.credit_memo_amount ?? ''}
              onChange={(e) => handleNumberField('credit_memo_amount', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Credit Memo Date</label>
            <Input
              type="date"
              value={currentReturn.credit_memo_date ? currentReturn.credit_memo_date.substring(0, 10) : ''}
              onChange={(e) => handleFieldChange('credit_memo_date', e.target.value || null)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Reimbursed Amount</label>
            <Input
              type="number"
              min="0"
              value={currentReturn.reimbursed_amount ?? ''}
              onChange={(e) => handleNumberField('reimbursed_amount', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Reimbursed Date</label>
            <Input
              type="date"
              value={currentReturn.reimbursed_date ? currentReturn.reimbursed_date.substring(0, 10) : ''}
              onChange={(e) => handleFieldChange('reimbursed_date', e.target.value || null)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Reimbursement Reference</label>
            <Input
              value={currentReturn.reimbursement_reference || ''}
              onChange={(e) => handleFieldChange('reimbursement_reference', e.target.value || null)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Reason</label>
            <Input value={currentReturn.reason || ''} onChange={(e) => handleFieldChange('reason', e.target.value || null)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-muted-foreground">Notes</label>
            <Textarea value={currentReturn.notes || ''} onChange={(e) => handleFieldChange('notes', e.target.value || null)} rows={3} />
          </div>
        </div>

        <div className="table-container">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Return Lines</h3>
            <div className="flex flex-wrap gap-2">
              <Select value={newLinePartId} onValueChange={setNewLinePartId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select part" />
                </SelectTrigger>
                <SelectContent>
                  {parts
                    .filter((p) => p.id && p.id.trim() !== '')
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.part_number}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="1"
                value={newLineQty}
                onChange={(e) => setNewLineQty(e.target.value)}
                className="w-20"
                placeholder="Qty"
              />
              <Input
                type="number"
                value={newLineCost}
                onChange={(e) => setNewLineCost(e.target.value)}
                className="w-24"
                placeholder="Unit Cost"
              />
              <Select value={newLineCondition} onValueChange={(val) => setNewLineCondition(val as ReturnLineCondition)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Condition" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newLineReason}
                onChange={(e) => setNewLineReason(e.target.value)}
                className="w-40"
                placeholder="Reason"
              />
              <Button size="sm" onClick={handleAddLine}>
                Add Line
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No lines added
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => {
                  const part = parts.find((p) => p.id === line.part_id);
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono">{part?.part_number || line.part_id}</TableCell>
                      <TableCell>{line.quantity}</TableCell>
                      <TableCell>{line.unit_cost != null ? `$${toNumber(line.unit_cost).toFixed(2)}` : '—'}</TableCell>
                      <TableCell>{line.condition}</TableCell>
                      <TableCell>{line.reason || '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeReturnLine(line.id)}>
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
