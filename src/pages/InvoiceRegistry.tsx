import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { fetchAllPayments, computePaymentSummary } from '@/integrations/supabase/payments';
import type { Invoice, InvoiceRow, InvoiceStatus, Payment, PaymentMethod, PaymentStatus } from '@/types';
import { useRepos } from '@/repos';
import { useOrderPayments } from '@/hooks/usePayments';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';
import { usePermissions } from '@/security/usePermissions';

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_STATUS_FILTERS: Array<{ value: PaymentStatus | 'ALL' | 'OVERDUE'; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERPAID', label: 'Overpaid' },
  { value: 'OVERDUE', label: 'Overdue' },
];

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};
const formatMoney = (value: number | string | null | undefined) => toNumber(value).toFixed(2);

export default function InvoiceRegistry() {
  const repos = useRepos();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { salesOrders } = repos.salesOrders;
  const { workOrders } = repos.workOrders;
  const { customers } = repos.customers;
  const { toast } = useToast();
  const { can } = usePermissions();
  const canRecordPayments = can('payments.record');
  const canVoidInvoice = can('invoices.void');

  const invoicedSalesOrders = useMemo(
    () => salesOrders.filter((so) => so.status === 'INVOICED'),
    [salesOrders]
  );
  const invoicedWorkOrders = useMemo(
    () => workOrders.filter((wo) => wo.status === 'INVOICED'),
    [workOrders]
  );

  const paymentsQuery = useQuery({
    queryKey: ['payments-ledger-all'],
    queryFn: () => fetchAllPayments({ includeVoided: true }),
  });

  const invoiceRepo = repos.invoices as typeof repos.invoices & { listAll?: () => Promise<Invoice[]> };
  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceRepo.listAll?.() ?? Promise.resolve([] as Invoice[]),
  });

  const paymentsByOrder = useMemo(() => {
    const grouped = new Map<string, Payment[]>();
    (paymentsQuery.data ?? []).forEach((payment) => {
      const key = `${payment.order_type}:${payment.order_id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), payment]);
    });
    return grouped;
  }, [paymentsQuery.data]);

  const invoicesBySource = useMemo(() => {
    const map = new Map<string, Invoice>();
    (invoicesQuery.data ?? []).forEach((invoice) => {
      map.set(`${invoice.source_type}:${invoice.source_id}`, invoice);
    });
    return map;
  }, [invoicesQuery.data]);

  type InvoiceRowWithMeta = InvoiceRow & {
    dueAt?: string | null;
    sourceLabel: string;
    voided_at?: string | null;
    void_reason?: string | null;
    invoiceStatus?: InvoiceStatus;
  };

  const invoiceRows: InvoiceRowWithMeta[] = useMemo(() => {
    const salesRows: InvoiceRowWithMeta[] = invoicedSalesOrders.map((order) => {
      const customerName =
        customers.find((c) => c.id === order.customer_id)?.company_name ??
        order.customer?.company_name ??
        'Customer';
      const key = `SALES_ORDER:${order.id}`;
      const paymentsForOrder = paymentsByOrder.get(key);
      const paymentSummary = computePaymentSummary(paymentsForOrder, toNumber(order.total));
      const dueAt = (order as { due_at?: string | null })?.due_at ?? null;
      const invoiceRecord = invoicesBySource.get(key);
      const isVoided = Boolean(invoiceRecord?.voided_at);
      const balanceDue = isVoided ? 0 : paymentSummary.balanceDue;
      return {
        orderType: 'SALES_ORDER',
        orderId: order.id,
        invoiceNumber: order.order_number,
        customerName,
        invoiceDate: order.invoiced_at || order.created_at,
        orderTotal: toNumber(order.total),
        totalPaid: paymentSummary.totalPaid,
        balanceDue,
        paymentStatus: paymentSummary.status,
        dueAt,
        sourceLabel: `SO ${order.order_number}`,
        voided_at: invoiceRecord?.voided_at ?? null,
        void_reason: invoiceRecord?.void_reason ?? null,
        invoiceStatus: invoiceRecord?.status,
      };
    });

    const workRows: InvoiceRowWithMeta[] = invoicedWorkOrders.map((order) => {
      const customerName =
        customers.find((c) => c.id === order.customer_id)?.company_name ??
        order.customer?.company_name ??
        'Customer';
      const key = `WORK_ORDER:${order.id}`;
      const paymentsForOrder = paymentsByOrder.get(key);
      const paymentSummary = computePaymentSummary(paymentsForOrder, toNumber(order.total));
      const dueAt = (order as { due_at?: string | null })?.due_at ?? null;
      const invoiceRecord = invoicesBySource.get(key);
      const isVoided = Boolean(invoiceRecord?.voided_at);
      const balanceDue = isVoided ? 0 : paymentSummary.balanceDue;
      return {
        orderType: 'WORK_ORDER',
        orderId: order.id,
        invoiceNumber: order.order_number,
        customerName,
        invoiceDate: order.invoiced_at || order.created_at,
        orderTotal: toNumber(order.total),
        totalPaid: paymentSummary.totalPaid,
        balanceDue,
        paymentStatus: paymentSummary.status,
        dueAt,
        sourceLabel: `WO ${order.order_number}`,
        voided_at: invoiceRecord?.voided_at ?? null,
        void_reason: invoiceRecord?.void_reason ?? null,
        invoiceStatus: invoiceRecord?.status,
      };
    });

    return [...salesRows, ...workRows].sort(
      (a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()
    );
  }, [customers, invoicedSalesOrders, invoicedWorkOrders, paymentsByOrder, invoicesBySource]);
  const hasAnyInvoices = invoiceRows.length > 0;

  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | 'ALL' | 'OVERDUE'>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRowWithMeta | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidInvoiceId, setVoidInvoiceId] = useState<string | null>(null);

  const filteredInvoiceRows = useMemo(() => {
    const now = Date.now();
    return invoiceRows.filter((row) => {
      if (row.voided_at) {
        return paymentStatusFilter === 'ALL';
      }
      const isOverdue = row.dueAt ? row.balanceDue > 0 && new Date(row.dueAt).getTime() < now : false;
      if (paymentStatusFilter === 'ALL') return true;
      if (paymentStatusFilter === 'OVERDUE') return isOverdue;
      return row.paymentStatus === paymentStatusFilter;
    });
  }, [invoiceRows, paymentStatusFilter]);

  const activeInvoiceRows = useMemo(
    () => filteredInvoiceRows.filter((row) => !row.voided_at),
    [filteredInvoiceRows]
  );

  const {
    addPayment,
    addPaymentMutation,
  } = useOrderPayments(
    selectedInvoice?.orderType ?? 'SALES_ORDER',
    selectedInvoice?.orderId,
    selectedInvoice?.orderTotal ?? 0
  );

  const handleOpenPayment = (row: InvoiceRowWithMeta) => {
    if (!canRecordPayments) {
      toast({ title: "You don't have permission to record payments.", variant: 'destructive' });
      return;
    }
    if (row.voided_at) {
      toast({
        title: 'Invoice is voided',
        description: 'Cannot receive payments on a voided invoice.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedInvoice(row);
    setPaymentAmount(row.balanceDue > 0 ? row.balanceDue.toFixed(2) : '');
    setPaymentMethod('cash');
    setPaymentReference('');
    setPaymentNotes('');
  };

  const handleSavePayment = async () => {
    if (!canRecordPayments) {
      toast({ title: "You don't have permission to record payments.", variant: 'destructive' });
      return;
    }
    if (!selectedInvoice) return;
    const amount = toNumber(paymentAmount);
    if (amount <= 0) {
      toast({ title: 'Enter amount', description: 'Payment amount must be greater than 0', variant: 'destructive' });
      return;
    }
    try {
      await addPayment(
        {
          orderType: selectedInvoice.orderType,
          orderId: selectedInvoice.orderId,
          amount,
          method: paymentMethod,
          reference: paymentReference || null,
          notes: paymentNotes || null,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments-ledger-all'] });
            setSelectedInvoice(null);
            setPaymentAmount('');
            setPaymentReference('');
            setPaymentNotes('');
          },
        }
      );
      toast({ title: 'Payment recorded' });
    } catch (error: any) {
      toast({
        title: 'Unable to record payment',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleOpenVoidInvoice = (row: InvoiceRowWithMeta) => {
    if (!canVoidInvoice) {
      toast({ title: "You don't have permission to void invoices.", variant: 'destructive' });
      return;
    }
    const invoiceRecord = invoicesBySource.get(`${row.orderType}:${row.orderId}`);
    setVoidInvoiceId(invoiceRecord?.id ?? null);
    setVoidReason('');
    setVoidDialogOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!canVoidInvoice) {
      toast({ title: "You don't have permission to void invoices.", variant: 'destructive' });
      return;
    }
    if (!voidInvoiceId) return;
    if (!voidReason.trim()) {
      toast({ title: 'Void reason required', variant: 'destructive' });
      return;
    }
    const invoiceRepo = repos.invoices as typeof repos.invoices & {
      voidInvoice?: (input: { invoiceId: string; reason: string }) => Promise<Invoice>;
    };
    if (!invoiceRepo.voidInvoice) {
      toast({ title: 'Void not available', variant: 'destructive' });
      return;
    }
    try {
      await invoiceRepo.voidInvoice({ invoiceId: voidInvoiceId, reason: voidReason.trim() });
      toast({ title: 'Invoice voided' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setVoidDialogOpen(false);
      setVoidReason('');
      setVoidInvoiceId(null);
    } catch (error: any) {
      toast({
        title: 'Unable to void invoice',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const paymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'PAID':
        return <Badge className="bg-green-100 text-green-700" variant="outline">PAID</Badge>;
      case 'OVERPAID':
        return <Badge className="bg-amber-100 text-amber-800" variant="outline">OVERPAID</Badge>;
      case 'PARTIAL':
        return <Badge className="bg-orange-100 text-orange-700" variant="outline">PARTIAL</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700" variant="outline">UNPAID</Badge>;
    }
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader 
        title="Invoice Registry" 
        subtitle="Sales and work orders that have been invoiced"
        actions={
          <ModuleHelpButton
            moduleKey="invoices"
            context={{
              isEmpty: !hasAnyInvoices,
              recordType: 'invoice',
              hasLines: Boolean(activeInvoiceRows.length),
            }}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Invoices (Active)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{activeInvoiceRows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Billed (Active)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              ${formatMoney(activeInvoiceRows.reduce((sum, row) => sum + row.orderTotal, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Paid (Active)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              ${formatMoney(activeInvoiceRows.reduce((sum, row) => sum + row.totalPaid, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Balance Due (Active)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              ${formatMoney(activeInvoiceRows.reduce((sum, row) => sum + row.balanceDue, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select
            value={paymentStatusFilter}
            onValueChange={(value) => setPaymentStatusFilter(value as typeof paymentStatusFilter)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Payment Status" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUS_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Payment Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoiceRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-4">
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
            {filteredInvoiceRows.map((row) => {
              const isVoided = Boolean(row.voided_at);
              const displayBalance = isVoided ? 0 : row.balanceDue;
              const isOverdue = !isVoided && row.dueAt ? displayBalance > 0 && new Date(row.dueAt).getTime() < Date.now() : false;
              return (
                <TableRow key={`${row.orderType}-${row.orderId}`} className={isOverdue ? 'bg-amber-50/70' : undefined}>
                  <TableCell>
                    <Link
                      to={
                        row.orderType === 'WORK_ORDER'
                          ? `/work-orders/${row.orderId}`
                          : `/sales-orders/${row.orderId}`
                      }
                      className="text-primary hover:underline"
                    >
                      {row.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{row.sourceLabel}</span>
                      {row.void_reason && (
                        <span className="text-[11px] text-muted-foreground">Void reason: {row.void_reason}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{row.customerName}</TableCell>
                  <TableCell>{new Date(row.invoiceDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">${formatMoney(row.orderTotal)}</TableCell>
                  <TableCell className="text-right">${formatMoney(row.totalPaid)}</TableCell>
                  <TableCell className="text-right">${formatMoney(displayBalance)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isVoided ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive">
                          Voided
                        </Badge>
                      ) : (
                        paymentStatusBadge(row.paymentStatus)
                      )}
                      {!isVoided && isOverdue && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate(
                          row.orderType === 'WORK_ORDER'
                            ? `/work-orders/${row.orderId}`
                            : `/sales-orders/${row.orderId}`
                        )
                      }
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenPayment(row)}
                      disabled={isVoided || !canRecordPayments}
                      title={
                        isVoided
                          ? 'Cannot receive payment on a voided invoice'
                          : !canRecordPayments
                            ? "You don't have permission to record payments."
                            : undefined
                      }
                    >
                      Receive Payment
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenVoidInvoice(row)}
                      disabled={
                        isVoided ||
                        !canVoidInvoice ||
                        Math.max(0, toNumber(row.orderTotal) - toNumber(row.balanceDue)) > 0.01
                      }
                      title={
                        isVoided
                          ? 'Invoice already voided'
                          : !canVoidInvoice
                            ? "You don't have permission to void invoices."
                            : Math.max(0, toNumber(row.orderTotal) - toNumber(row.balanceDue)) > 0.01
                              ? 'Invoice has payments; void payments first.'
                              : undefined
                      }
                    >
                      {isVoided ? 'Voided' : 'Void'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Receive Payment – {selectedInvoice?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Reference (optional)"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
            <Input
              placeholder="Notes (optional)"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
              Cancel
            </Button>
            <Button onClick={handleSavePayment} disabled={addPaymentMutation.isPending}>
              {addPaymentMutation.isPending ? 'Saving...' : 'Save Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={voidDialogOpen}
        onOpenChange={(open) => {
          setVoidDialogOpen(open);
          if (!open) {
            setVoidReason('');
            setVoidInvoiceId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Enter void reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmVoid}>
              Confirm Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
