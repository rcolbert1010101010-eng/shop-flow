import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useRepos } from '@/repos';
import { usePayments } from '@/hooks/usePayments';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/security/usePermissions';
import { useQuickBooksIntegration } from '@/hooks/useQuickBooksIntegration';
import type { Invoice, InvoiceLine } from '@/types';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};
const formatCurrency = (value: number | string | null | undefined) => `$${toNumber(value).toFixed(2)}`;
const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' },
  { value: 'other', label: 'Other' },
];

export default function InvoiceDetail() {
  const { id: invoiceId } = useParams<{ id: string }>();
  const repos = useRepos();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'card' | 'ach' | 'other'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const { toast } = useToast();
  const { can, role } = usePermissions();
  const { createInvoiceExport } = useQuickBooksIntegration();
  const canVoidInvoice = can('invoices.void');
  const canRecordPayments = can('payments.record');
  const canGenerateExport = role === 'ADMIN' || (can('invoices.create') && can('settings.edit'));

  const denyVoidInvoice = () =>
    toast({
      title: "You don't have permission",
      description: 'You do not have permission to void invoices.',
      variant: 'destructive',
    });

  const denyPayments = () =>
    toast({
      title: "You don't have permission",
      description: 'You do not have permission to record or void payments.',
      variant: 'destructive',
    });

  const backTo = invoice
    ? invoice.source_type === 'SALES_ORDER'
      ? `/sales-orders/${invoice.source_id}`
      : invoice.source_type === 'WORK_ORDER'
        ? `/work-orders/${invoice.source_id}`
        : '/invoices'
    : '/invoices';

  useEffect(() => {
    if (!invoiceId) return;

    const loadInvoice = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const invoiceData = await repos.invoices.getById({ invoiceId });
        const invoiceLines = await repos.invoices.listLines({ invoiceId });
        setInvoice(invoiceData);
        setLines(invoiceLines);
      } catch (error) {
        setNotFound(true);
        setInvoice(null);
        setLines([]);
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId, repos.invoices]);

  const orderTotal = toNumber(invoice?.total);
  const payments = usePayments('INVOICE', invoice?.id, orderTotal);
  const summaryTotalPaid = invoice?.voided_at ? 0 : payments.summary.totalPaid;
  const summaryBalanceDue = invoice?.voided_at ? 0 : payments.summary.balanceDue;
  const paidFromInvoice = Math.max(0, toNumber(invoice?.total) - toNumber(invoice?.balance_due));
  const paymentStatusClass = useMemo(() => {
    if (invoice?.voided_at) {
      return 'bg-slate-100 text-slate-700';
    }
    switch (payments.summary.status) {
      case 'PAID':
        return 'bg-green-100 text-green-700';
      case 'OVERPAID':
        return 'bg-amber-100 text-amber-800';
      case 'PARTIAL':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }, [invoice?.voided_at, payments.summary.status]);

  useEffect(() => {
    if (!invoice || invoice.voided_at) return;
    if (paymentAmount !== '') return;
    if (summaryBalanceDue > 0) {
      setPaymentAmount(summaryBalanceDue.toFixed(2));
    }
  }, [invoice, paymentAmount, summaryBalanceDue]);

  const handleAddPayment = async () => {
    if (!canRecordPayments) {
      denyPayments();
      return;
    }
    if (!invoice) return;
    if (invoice.voided_at) {
      toast({ title: 'Invoice is voided', description: 'Cannot apply payments to a voided invoice.', variant: 'destructive' });
      return;
    }
    const amountValue = toNumber(paymentAmount);
    if (amountValue <= 0) {
      toast({ title: 'Enter amount', description: 'Payment amount must be greater than 0', variant: 'destructive' });
      return;
    }
    try {
      await payments.addPayment.mutateAsync({
        amount: amountValue,
        method: paymentMethod,
        reference: paymentReference || null,
        notes: paymentNotes || null,
      });
      toast({ title: 'Payment recorded' });
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
    } catch (error: any) {
      toast({
        title: 'Unable to record payment',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleVoidPayment = async (paymentId: string) => {
    if (!canRecordPayments) {
      denyPayments();
      return;
    }
    const reason = window.prompt('Enter void reason (optional)') ?? '';
    try {
      await payments.voidPayment.mutateAsync({ paymentId, reason });
      toast({ title: 'Payment voided' });
    } catch (error: any) {
      toast({
        title: 'Unable to void payment',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmVoid = async () => {
    if (!canVoidInvoice) {
      denyVoidInvoice();
      return;
    }
    if (!invoice) return;
    if (!voidReason.trim()) {
      toast({ title: 'Void reason required', variant: 'destructive' });
      return;
    }
    const invoicesRepo = repos.invoices as typeof repos.invoices & {
      voidInvoice?: (input: { invoiceId: string; reason: string }) => Promise<Invoice>;
    };
    if (!invoicesRepo.voidInvoice) {
      toast({ title: 'Void not available', description: 'Invoice voiding is not configured.', variant: 'destructive' });
      return;
    }
    try {
      setVoidSubmitting(true);
      const updated = await invoicesRepo.voidInvoice({ invoiceId: invoice.id, reason: voidReason.trim() });
      toast({ title: 'Invoice voided' });
      setInvoice(updated);
      setVoidDialogOpen(false);
      setVoidReason('');
    } catch (error: any) {
      toast({ title: 'Unable to void invoice', description: error?.message ?? 'Please try again', variant: 'destructive' });
    } finally {
      setVoidSubmitting(false);
    }
  };

  const handleGenerateExport = async () => {
    if (!canGenerateExport) {
      toast({
        title: "You don't have permission",
        description: 'Admin or settings + invoice permissions required.',
        variant: 'destructive',
      });
      return;
    }
    if (!invoice) return;
    const result = await createInvoiceExport(invoice, lines);
    if (!result?.success) {
      toast({
        title: 'Export failed',
        description:
          result?.error === 'duplicate'
            ? 'Export already generated.'
            : result?.error ?? 'Unable to generate export',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Export queued', description: 'Invoice export saved to accounting_exports.' });
  };

  if (loading) {
    return (
      <div className="page-container">
        <PageHeader title="Invoice" backTo={backTo} />
        <p>Loading...</p>
      </div>
    );
  }

  if (notFound || !invoice) {
    return (
      <div className="page-container">
        <PageHeader title="Invoice" backTo={backTo} />
        <p>Invoice not found</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title={`Invoice ${invoice.invoice_number}`} backTo={backTo} />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Status:</span>
              <Badge variant="outline">{invoice.status}</Badge>
              {invoice.voided_at && <Badge variant="outline" className="bg-destructive/10 text-destructive">Voided</Badge>}
            </div>
            {invoice.void_reason && (
              <div className="text-xs text-muted-foreground">Void reason: {invoice.void_reason}</div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-medium">Total:</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Balance Due:</span>
              <span>{formatCurrency(invoice.balance_due)}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateExport}
                disabled={!canGenerateExport}
              >
                Generate Accounting Export
              </Button>
              {!canGenerateExport && (
                <p className="text-xs text-muted-foreground">Admin or settings + invoice permissions required.</p>
              )}
            </div>
            {!invoice.voided_at && (
              <div className="space-y-1">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (!canVoidInvoice) {
                      denyVoidInvoice();
                      return;
                    }
                    setVoidDialogOpen(true);
                  }}
                  disabled={!canVoidInvoice || paidFromInvoice > 0.01}
                >
                  Void Invoice
                </Button>
                {paidFromInvoice > 0.01 && (
                  <p className="text-xs text-muted-foreground">Invoice has payments; void payments first.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="border rounded-lg p-4 bg-muted/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <p className="font-semibold">
                      {formatCurrency(summaryTotalPaid)} paid of {formatCurrency(orderTotal)}
                    </p>
                  </div>
                  <Badge variant="outline" className={paymentStatusClass}>
                    {invoice.voided_at ? 'VOIDED' : payments.summary.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Paid</span>
                    <span className="font-medium">{formatCurrency(summaryTotalPaid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Balance Due</span>
                    <span className="font-medium">{formatCurrency(summaryBalanceDue)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Record Payment</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      disabled={Boolean(invoice.voided_at)}
                    />
                    <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Method" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHOD_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    placeholder="Reference (optional)"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    disabled={Boolean(invoice.voided_at)}
                  />
                  <Input
                    placeholder="Notes (optional)"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    disabled={Boolean(invoice.voided_at)}
                  />
                  <Button
                    onClick={handleAddPayment}
                    disabled={!canRecordPayments || !invoice || payments.addPayment.isPending || Boolean(invoice.voided_at)}
                  >
                    {payments.addPayment.isPending ? 'Saving...' : 'Add Payment'}
                  </Button>
                  {invoice.voided_at && (
                    <p className="text-xs text-muted-foreground">Payments are disabled on voided invoices.</p>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Payment History</h3>
                  {payments.isLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
                </div>
                <div className="space-y-2 text-sm">
                  {payments.payments.length === 0 && (
                    <p className="text-muted-foreground">No payments recorded yet.</p>
                  )}
                  {payments.payments.map((payment) => (
                    <div key={payment.id} className="border rounded-md p-3 bg-background space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {formatCurrency(payment.amount)} - {payment.method}
                        </span>
                        {payment.voided_at ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive">
                            Voided
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVoidPayment(payment.id)}
                            disabled={payments.voidPayment.isPending}
                          >
                            Void
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(payment.created_at).toLocaleString()}</span>
                        {payment.reference && <span>Ref: {payment.reference}</span>}
                      </div>
                      {payment.notes && <div className="text-xs text-muted-foreground">Notes: {payment.notes}</div>}
                      {payment.void_reason && (
                        <div className="text-xs text-muted-foreground">Void reason: {payment.void_reason}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Lines</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No lines found
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.description}</TableCell>
                      <TableCell>{line.qty}</TableCell>
                      <TableCell>{formatCurrency(line.unit_price)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={voidDialogOpen}
        onOpenChange={(open) => {
          setVoidDialogOpen(open);
          if (!open) {
            setVoidReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Invoice</DialogTitle>
            <DialogDescription>
              Voiding an invoice will set its balance to zero and prevent further payments. This action requires a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Enter void reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)} disabled={voidSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmVoid} disabled={voidSubmitting}>
              {voidSubmitting ? 'Voiding...' : 'Confirm Void'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
