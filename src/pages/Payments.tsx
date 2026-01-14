import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { fetchAllPayments, type PaymentsFilter, computePaymentSummary, voidPayment } from '@/integrations/supabase/payments';
import type { Invoice, Payment, PaymentMethod, PaymentOrderType, PaymentStatus } from '@/types';
import { useRepos } from '@/repos';
import { usePayments } from '@/hooks/usePayments';
import { useToast } from '@/hooks/use-toast';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

const ORDER_TYPE_OPTIONS: Array<{ value: PaymentOrderType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Orders' },
  { value: 'WORK_ORDER', label: 'Work Orders' },
  { value: 'SALES_ORDER', label: 'Sales Orders' },
];

const METHOD_OPTIONS: Array<{ value: PaymentMethod | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' },
  { value: 'other', label: 'Other' },
];

type StatusFilter = 'all' | 'active' | 'voided';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};
const formatMoney = (value: number | string | null | undefined) => toNumber(value).toFixed(2);
type PaymentRow = Payment & {
  orderLabel: string;
  customerName: string;
  orderNumber: string;
  orderTotal: number;
  totalPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
};

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const repos = useRepos();
  const { salesOrders } = repos.salesOrders;
  const { workOrders } = repos.workOrders;
  const { customers } = repos.customers;
  const invoiceRepo = repos.invoices as typeof repos.invoices & { listAll?: () => Promise<Invoice[]> };
  const [orderTypeFilter, setOrderTypeFilter] = useState<PaymentOrderType | 'ALL'>('ALL');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'last7' | 'last30' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [receivePaymentOpen, setReceivePaymentOpen] = useState(false);
  const [receiveOrderType, setReceiveOrderType] = useState<PaymentOrderType>('WORK_ORDER');
  const [receiveOrderId, setReceiveOrderId] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveMethod, setReceiveMethod] = useState<PaymentMethod>('cash');
  const [receiveReference, setReceiveReference] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const formatInputDate = (date: Date) => date.toISOString().slice(0, 10);
    const today = new Date();
    if (datePreset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    if (datePreset === 'today') {
      const dateString = formatInputDate(today);
      setStartDate(dateString);
      setEndDate(dateString);
      return;
    }
    if (datePreset === 'last7') {
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      setStartDate(formatInputDate(from));
      setEndDate(formatInputDate(today));
      return;
    }
    if (datePreset === 'last30') {
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      setStartDate(formatInputDate(from));
      setEndDate(formatInputDate(today));
    }
  }, [datePreset]);

  const queryFilter: PaymentsFilter = useMemo(
    () => ({
      orderType: orderTypeFilter === 'ALL' ? undefined : orderTypeFilter,
      method: methodFilter === 'ALL' ? undefined : methodFilter,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      includeVoided: statusFilter !== 'active',
    }),
    [orderTypeFilter, methodFilter, startDate, endDate, statusFilter]
  );

  const paymentsQuery = useQuery({
    queryKey: ['payments-ledger', queryFilter],
    queryFn: () => fetchAllPayments(queryFilter),
  });
  const allPaymentsQuery = useQuery({
    queryKey: ['payments-ledger-all'],
    queryFn: () => fetchAllPayments({ includeVoided: true }),
  });

  const rawPayments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);
  const hasAnyPayments = (allPaymentsQuery.data?.length ?? 0) > 0;
  const paymentsByOrder = useMemo(() => {
    const map = new Map<string, Payment[]>();
    (allPaymentsQuery.data ?? []).forEach((payment) => {
      const key = `${payment.order_type}:${payment.order_id}`;
      map.set(key, [...(map.get(key) ?? []), payment]);
    });
    return map;
  }, [allPaymentsQuery.data]);
  const payments = useMemo(() => {
    if (statusFilter === 'voided') return rawPayments.filter((p) => p.voided_at);
    if (statusFilter === 'active') return rawPayments.filter((p) => !p.voided_at);
    return rawPayments;
  }, [rawPayments, statusFilter]);

  const salesOrderMap = useMemo(() => new Map(salesOrders.map((order) => [order.id, order])), [salesOrders]);
  const workOrderMap = useMemo(() => new Map(workOrders.map((order) => [order.id, order])), [workOrders]);
  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const summaryByOrder = useMemo(() => {
    const map = new Map<string, { totalPaid: number; balanceDue: number; status: PaymentStatus; orderTotal: number }>();
    paymentsByOrder.forEach((list, key) => {
      const [orderType, orderId] = key.split(':') as [PaymentOrderType, string];
      const orderTotal =
        orderType === 'WORK_ORDER'
          ? toNumber(workOrderMap.get(orderId)?.total)
          : toNumber(salesOrderMap.get(orderId)?.total);
      const summary = computePaymentSummary(list, orderTotal);
      map.set(key, { ...summary, orderTotal });
    });
    return map;
  }, [paymentsByOrder, salesOrderMap, workOrderMap]);

  const enrichedPayments: PaymentRow[] = useMemo(() => {
    return payments.map((payment) => {
      const order =
        payment.order_type === 'WORK_ORDER'
          ? workOrderMap.get(payment.order_id)
          : salesOrderMap.get(payment.order_id);
      const orderNumber = order?.order_number ?? payment.order_id;
      const customerName =
        (order ? customerMap.get(order.customer_id)?.company_name : undefined) ??
        (order as { customer?: { company_name?: string } } | undefined)?.customer?.company_name ??
        'Customer';
      const prefix = payment.order_type === 'WORK_ORDER' ? 'WO' : 'SO';
      const orderLabel = `${prefix} ${orderNumber}`;
      const summaryKey = `${payment.order_type}:${payment.order_id}`;
      const summary = summaryByOrder.get(summaryKey);

      return {
        ...payment,
        orderLabel,
        customerName,
        orderNumber,
        orderTotal: summary?.orderTotal ?? toNumber(order?.total),
        totalPaid: summary?.totalPaid ?? 0,
        balanceDue: summary?.balanceDue ?? 0,
        paymentStatus: summary?.status ?? 'UNPAID',
      };
    });
  }, [customerMap, payments, salesOrderMap, summaryByOrder, workOrderMap]);

  const receiveOrderOptions = useMemo(() => {
    if (receiveOrderType === 'INVOICE') {
      return invoices
        .filter((invoice) => !invoice.voided_at && toNumber(invoice.balance_due) > 0.01)
        .map((invoice) => {
          const customerName =
            customerMap.get(invoice.customer_id)?.company_name ??
            'Customer';
          return {
            id: invoice.id,
            label: `${invoice.invoice_number} — ${customerName}`,
          };
        });
    }
    const options =
      receiveOrderType === 'WORK_ORDER'
        ? workOrders
        : salesOrders;
    return options.map((order) => {
      const customerName =
        customerMap.get(order.customer_id)?.company_name ??
        (order as { customer?: { company_name?: string } } | undefined)?.customer?.company_name ??
        'Customer';
      return {
        id: order.id,
        label: `${order.order_number} — ${customerName}`,
      };
    });
  }, [customerMap, invoices, receiveOrderType, salesOrders, workOrders]);

  const selectedInvoice = invoices.find((inv) => inv.id === receiveOrderId);
  const selectedOrder =
    receiveOrderType === 'WORK_ORDER'
      ? workOrderMap.get(receiveOrderId)
      : receiveOrderType === 'SALES_ORDER'
        ? salesOrderMap.get(receiveOrderId)
        : selectedInvoice;
  const selectedOrderTotal = toNumber(
    receiveOrderType === 'INVOICE' ? selectedInvoice?.total : selectedOrder?.total
  );
  const selectedCustomerName =
    receiveOrderType === 'INVOICE'
      ? customerMap.get(selectedInvoice?.customer_id ?? '')?.company_name ?? 'Customer'
      : (selectedOrder ? customerMap.get((selectedOrder as { customer_id: string }).customer_id)?.company_name : undefined) ??
        (selectedOrder as { customer?: { company_name?: string } } | undefined)?.customer?.company_name ??
        '';
  const receivePayments = usePayments(
    receiveOrderId ? receiveOrderType : undefined,
    receiveOrderId || undefined,
    selectedOrderTotal
  );

  useEffect(() => {
    if (!receivePaymentOpen) return;
    if (!receiveOrderId) return;
    if (receiveAmount !== '') return;
    if (receivePayments.summary.balanceDue > 0) {
      setReceiveAmount(receivePayments.summary.balanceDue.toFixed(2));
    }
  }, [receiveAmount, receiveOrderId, receivePaymentOpen, receivePayments.summary.balanceDue]);

  const summary = useMemo(() => {
    const active = enrichedPayments.filter((p) => !p.voided_at);
    const voided = enrichedPayments.filter((p) => p.voided_at);
    const totalAmount = active.reduce((sum, p) => sum + toNumber(p.amount), 0);
    return {
      count: enrichedPayments.length,
      activeCount: active.length,
      voidedCount: voided.length,
      totalAmount,
    };
  }, [enrichedPayments]);

  const getOrderLink = (payment: Payment) =>
    payment.order_type === 'WORK_ORDER' ? `/work-orders/${payment.order_id}` : `/sales-orders/${payment.order_id}`;

  const voidingPayment = useMemo(
    () => enrichedPayments.find((p) => p.id === voidPaymentId) ?? null,
    [enrichedPayments, voidPaymentId]
  );

  useEffect(() => {
    if (receiveOrderType !== 'INVOICE') return;
    let active = true;
    const loadInvoices = async () => {
      if (!invoiceRepo.listAll) return;
      try {
        const data = await invoiceRepo.listAll();
        if (!active) return;
        setInvoices(data);
        if (receiveOrderId && !data.find((inv) => inv.id === receiveOrderId && !inv.voided_at && toNumber(inv.balance_due) > 0.01)) {
          setReceiveOrderId('');
        }
      } catch (error) {
        console.error('Failed to load invoices', error);
      }
    };
    loadInvoices();
    return () => {
      active = false;
    };
  }, [invoiceRepo, receiveOrderId, receiveOrderType]);

  const statusBadge = (payment: Payment) => {
    if (payment.voided_at) {
      return <Badge variant="outline" className="bg-destructive/10 text-destructive">Voided</Badge>;
    }
    return <Badge variant="outline" className="bg-green-100 text-green-700">Active</Badge>;
  };

  const handleOpenReceivePayment = () => {
    setReceivePaymentOpen(true);
    setReceiveOrderId('');
    setReceiveOrderType('WORK_ORDER');
    setReceiveAmount('');
    setReceiveMethod('cash');
    setReceiveReference('');
    setReceiveNotes('');
  };

  const handleOpenReceivePaymentForRow = (row: PaymentRow) => {
    setReceiveOrderType(row.order_type);
    setReceiveOrderId(row.order_id);
    setReceiveAmount('');
    setReceiveMethod('cash');
    setReceiveReference('');
    setReceiveNotes('');
    setReceivePaymentOpen(true);
  };

  const handleSubmitReceivePayment = async () => {
    if (!receiveOrderId) {
      toast({ title: 'Select an order', description: 'Choose a work or sales order to apply this payment.', variant: 'destructive' });
      return;
    }
    const amountValue = toNumber(receiveAmount);
    if (amountValue <= 0) {
      toast({ title: 'Enter amount', description: 'Payment amount must be greater than 0', variant: 'destructive' });
      return;
    }
    try {
      await receivePayments.addPayment.mutateAsync({
        amount: amountValue,
        method: receiveMethod,
        reference: receiveReference || null,
        notes: receiveNotes || null,
      });
      toast({ title: 'Payment recorded' });
      setReceivePaymentOpen(false);
      setReceiveAmount('');
      setReceiveReference('');
      setReceiveNotes('');
      setReceiveOrderId('');
      queryClient.invalidateQueries({ queryKey: ['payments-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['payments-ledger-all'] });
    } catch (error: any) {
      toast({
        title: 'Unable to record payment',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const voidPaymentMutation = useMutation({
    mutationFn: (input: { paymentId: string; reason: string }) => voidPayment(input.paymentId, input.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['payments-ledger-all'] });
      toast({ title: 'Payment voided' });
    },
    onError: (error: any) => {
      toast({
        title: 'Unable to void payment',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleOpenVoidPayment = (paymentId: string) => {
    setVoidPaymentId(paymentId);
    setVoidReason('');
    setVoidDialogOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!voidPaymentId) return;
    if (!voidReason.trim()) {
      toast({ title: 'Void reason required', variant: 'destructive' });
      return;
    }
    try {
      await voidPaymentMutation.mutateAsync({ paymentId: voidPaymentId, reason: voidReason.trim() });
      setVoidDialogOpen(false);
      setVoidReason('');
      setVoidPaymentId(null);
    } catch (error) {
      // error handled in mutation onError
    }
  };

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between gap-3">
        <PageHeader 
          title="Payments" 
          subtitle="Track payments across work and sales orders"
          actions={<ModuleHelpButton moduleKey="payments" context={{ isEmpty: !hasAnyPayments }} />}
        />
        <Button onClick={handleOpenReceivePayment}>Receive Payment</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary.activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Voided</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary.voidedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Amount (Active)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">${formatMoney(summary.totalAmount)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <Select value={datePreset} onValueChange={(value) => setDatePreset(value as typeof datePreset)}>
          <SelectTrigger>
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="last7">Last 7 Days</SelectItem>
            <SelectItem value="last30">Last 30 Days</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>

        <Select value={orderTypeFilter} onValueChange={(value) => setOrderTypeFilter(value as typeof orderTypeFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Order Type" />
          </SelectTrigger>
          <SelectContent>
            {ORDER_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={methodFilter} onValueChange={(value) => setMethodFilter(value as typeof methodFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Payment Method" />
          </SelectTrigger>
          <SelectContent>
            {METHOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={startDate}
          onChange={(e) => {
            setDatePreset('custom');
            setStartDate(e.target.value);
          }}
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => {
            setDatePreset('custom');
            setEndDate(e.target.value);
          }}
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date / Time</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Order / Invoice</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance Due</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-4">
                  Loading payments...
                </TableCell>
              </TableRow>
            )}
            {!paymentsQuery.isLoading && enrichedPayments.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-4">
                  No payments found.
                </TableCell>
              </TableRow>
            )}
            {enrichedPayments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{new Date(payment.created_at).toLocaleString()}</TableCell>
                <TableCell>{payment.customerName}</TableCell>
                <TableCell>
                  <Link to={getOrderLink(payment)} className="text-primary hover:underline">
                    {payment.orderLabel}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">{payment.method}</TableCell>
                <TableCell className="text-right font-semibold">
                  ${formatMoney(payment.amount)}
                </TableCell>
                <TableCell className="text-right">${formatMoney(payment.balanceDue)}</TableCell>
                <TableCell className="text-right">{statusBadge(payment)}</TableCell>
                <TableCell>{payment.reference || '-'}</TableCell>
                <TableCell className="max-w-xs truncate">{payment.notes || '-'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenReceivePaymentForRow(payment)}
                      disabled={payment.balanceDue <= 0 || !payment.order_id}
                    >
                      Receive Payment
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenVoidPayment(payment.id)}
                      disabled={Boolean(payment.voided_at)}
                    >
                      {payment.voided_at ? 'Voided' : 'Void'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={receivePaymentOpen} onOpenChange={(open) => setReceivePaymentOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Select
                  value={receiveOrderType}
                  onValueChange={(value) => {
                    setReceiveOrderType(value as PaymentOrderType);
                    setReceiveOrderId('');
                    setReceiveAmount('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Order type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WORK_ORDER">Work Order</SelectItem>
                    <SelectItem value="SALES_ORDER">Sales Order</SelectItem>
                    <SelectItem value="INVOICE">Invoice</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={receiveOrderId} onValueChange={(value) => setReceiveOrderId(value)}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        receiveOrderType === 'WORK_ORDER'
                          ? 'Select Work Order'
                          : receiveOrderType === 'SALES_ORDER'
                            ? 'Select Sales Order'
                            : 'Select Invoice'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {receiveOrderOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            {receiveOrderType === 'INVOICE' && receiveOrderOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No open invoices available (voided invoices cannot receive payments).
              </p>
            )}

            {receiveOrderId && (
              <div className="grid grid-cols-3 gap-3 bg-muted/40 rounded-md p-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Customer</div>
                  <div className="font-medium">{selectedCustomerName || 'Customer'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total</div>
                  <div className="font-medium">${formatMoney(selectedOrderTotal)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Paid / Balance</div>
                  <div className="font-medium">
                    ${formatMoney(receivePayments.summary.totalPaid)} / ${formatMoney(receivePayments.summary.balanceDue)}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={receiveAmount}
                onChange={(e) => setReceiveAmount(e.target.value)}
              />
              <Select value={receiveMethod} onValueChange={(value) => setReceiveMethod(value as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS.filter((opt) => opt.value !== 'ALL').map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Reference (optional)"
              value={receiveReference}
              onChange={(e) => setReceiveReference(e.target.value)}
            />
            <Input
              placeholder="Notes (optional)"
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceivePaymentOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReceivePayment}
              disabled={
                receivePayments.addPayment.isPending ||
                (receiveOrderType === 'INVOICE' && receiveOrderOptions.length === 0)
              }
            >
              {receivePayments.addPayment.isPending ? 'Saving...' : 'Save Payment'}
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
            setVoidPaymentId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {voidingPayment
                ? `Voiding payment of $${formatMoney(voidingPayment.amount)} for ${voidingPayment.orderLabel}`
                : 'Provide a reason to void this payment.'}
            </div>
            <Textarea
              placeholder="Enter void reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)} disabled={voidPaymentMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmVoid}
              disabled={voidPaymentMutation.isPending}
            >
              {voidPaymentMutation.isPending ? 'Voiding...' : 'Confirm Void'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
