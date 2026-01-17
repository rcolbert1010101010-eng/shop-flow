import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReportLayout } from '@/components/reports/ReportLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useRepos } from '@/repos';
import type { SalesOrder, SalesOrderStatus } from '@/types';
import { usePermissions } from '@/security/usePermissions';
import { useToast } from '@/hooks/use-toast';

type SalesOrderRow = {
  id: string;
  order_number: string;
  customerName: string;
  status: SalesOrderStatus;
  created_at: string;
  total: number;
};

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatMoney = (value: number | string | null | undefined) => `$${toNumber(value).toFixed(2)}`;

const resolveSalesOrderTotal = (order: SalesOrder) => {
  const directTotal = toNumber(order.total);
  if (directTotal > 0 || order.total === 0) return directTotal;

  const subtotal = toNumber((order as any).subtotal);
  const chargeSubtotal = toNumber((order as any).charge_subtotal);
  const coreCharges = toNumber((order as any).core_charges_total);
  const base = subtotal + chargeSubtotal + coreCharges;
  const taxAmount = toNumber((order as any).tax_amount || base * (toNumber(order.tax_rate) / 100));

  return base + taxAmount;
};

const formatStatus = (status: SalesOrderStatus) => {
  switch (status) {
    case 'OPEN':
      return 'Open';
    case 'ESTIMATE':
      return 'Estimate';
    case 'PARTIAL':
      return 'Partial';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'INVOICED':
      return 'Invoiced';
    default:
      return status;
  }
};

export default function SalesOrdersReport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can, isReady } = usePermissions();
  const canViewReports = can('reports.view');
  const repos = useRepos();
  const { salesOrders } = repos.salesOrders;
  const { customers } = repos.customers;

  const [statusFilter, setStatusFilter] = useState<'all' | SalesOrderStatus>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isReady) return;
    if (!canViewReports) {
      toast({
        title: "You don't have permission to view reports.",
        variant: 'destructive',
      });
      navigate('/', { replace: true });
    }
  }, [canViewReports, isReady, navigate, toast]);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const rows = useMemo<SalesOrderRow[]>(() => {
    return salesOrders.map((order) => {
      const customer = customerMap.get(order.customer_id);
      return {
        id: order.id,
        order_number: order.order_number,
        customerName: customer?.company_name || (order.customer_id === 'walkin' ? 'Walk-in Customer' : '-'),
        status: order.status,
        created_at: order.created_at,
        total: resolveSalesOrderTotal(order),
      };
    });
  }, [customerMap, salesOrders]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesQuery =
        query.length === 0 ||
        row.order_number.toLowerCase().includes(query) ||
        row.customerName.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [rows, search, statusFilter]);

  const statusCounts = useMemo(() => {
    return filteredRows.reduce<Record<SalesOrderStatus, number>>(
      (acc, row) => ({
        ...acc,
        [row.status]: (acc[row.status] ?? 0) + 1,
      }),
      { OPEN: 0, ESTIMATE: 0, PARTIAL: 0, COMPLETED: 0, CANCELLED: 0, INVOICED: 0 }
    );
  }, [filteredRows]);

  const revenueTotal = filteredRows.reduce((sum, row) => sum + toNumber(row.total), 0);
  const averageTicket = filteredRows.length ? revenueTotal / filteredRows.length : 0;

  if (!isReady) return null;
  if (isReady && !canViewReports) return null;

  return (
    <ReportLayout
      title="Sales Orders Summary"
      description="Status breakdown and revenue across counter sales."
      exportConfig={{
        filename: 'sales-orders-report',
        columns: [
          { key: 'order_number', header: 'SO #' },
          { key: 'customerName', header: 'Customer' },
          { key: 'status', header: 'Status', format: (val) => formatStatus(val as SalesOrderStatus) },
          { key: 'created_at', header: 'Created', format: (val) => new Date(String(val)).toLocaleDateString() },
          { key: 'total', header: 'Total', format: (val) => formatMoney(Number(val)) },
        ],
        rows: filteredRows,
      }}
      filters={
        <>
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="ESTIMATE">Estimate</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="INVOICED">Invoiced</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sales orders..."
            className="w-64"
          />
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Revenue (filtered)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoney(revenueTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Average Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoney(averageTicket)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Open Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{statusCounts.OPEN}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Partial / Backorder</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{statusCounts.PARTIAL}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Object.keys(statusCounts) as SalesOrderStatus[]).map((statusKey) => (
                  <TableRow key={statusKey}>
                    <TableCell>{formatStatus(statusKey)}</TableCell>
                    <TableCell className="text-right">{statusCounts[statusKey]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Completed</span>
              <span className="font-semibold">{statusCounts.COMPLETED}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Estimates</span>
              <span className="font-semibold">{statusCounts.ESTIMATE}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Invoiced</span>
              <span className="font-semibold">{statusCounts.INVOICED}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cancelled</span>
              <span className="font-semibold">{statusCounts.CANCELLED}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No sales orders found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.order_number}</TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </ReportLayout>
  );
}
