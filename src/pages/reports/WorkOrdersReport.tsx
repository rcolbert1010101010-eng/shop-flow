import { useMemo, useState } from 'react';
import { ReportLayout } from '@/components/reports/ReportLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useRepos } from '@/repos';
import { joinWorkOrders, getDaysOpen, getAgingBucket, getWipValue, type WorkOrderWithRefs } from '@/lib/reports/workOrders';
import type { WorkOrderStatus } from '@/types';

type ReportRow = WorkOrderWithRefs & {
  daysOpen: number;
  wipValue: number;
};

const formatMoney = (value: number) => `$${value.toFixed(2)}`;

const formatStatus = (status: WorkOrderStatus) => {
  switch (status) {
    case 'OPEN':
      return 'Open';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'ESTIMATE':
      return 'Estimate';
    case 'INVOICED':
      return 'Invoiced';
    default:
      return status;
  }
};

export default function WorkOrdersReport() {
  const repos = useRepos();
  const { workOrders } = repos.workOrders;
  const { customers } = repos.customers;
  const { units } = repos.units;

  const [statusFilter, setStatusFilter] = useState<'all' | WorkOrderStatus>('all');
  const [search, setSearch] = useState('');
  const nowRef = useMemo(() => new Date(), []);

  const rows = useMemo<ReportRow[]>(() => {
    return joinWorkOrders(workOrders, customers, units).map((order) => {
      const daysOpen = getDaysOpen(order.created_at, nowRef);
      const wipValue = getWipValue(order);
      return { ...order, daysOpen, wipValue };
    });
  }, [customers, units, workOrders, nowRef]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesQuery =
        query.length === 0 ||
        row.order_number.toLowerCase().includes(query) ||
        row.customerName.toLowerCase().includes(query) ||
        row.unitLabel.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [rows, search, statusFilter]);

  const statusCounts = useMemo(() => {
    return filteredRows.reduce<Record<WorkOrderStatus, number>>(
      (acc, row) => ({
        ...acc,
        [row.status]: (acc[row.status] ?? 0) + 1,
      }),
      { ESTIMATE: 0, OPEN: 0, IN_PROGRESS: 0, INVOICED: 0 }
    );
  }, [filteredRows]);

  const agingBuckets = useMemo(() => {
    const buckets: Record<'0-2' | '3-7' | '8-14' | '15+', number> = {
      '0-2': 0,
      '3-7': 0,
      '8-14': 0,
      '15+': 0,
    };
    filteredRows.forEach((row) => {
      buckets[getAgingBucket(row.daysOpen)] += 1;
    });
    return buckets;
  }, [filteredRows]);

  const wipTotals = useMemo(() => {
    const total = filteredRows.reduce((sum, row) => sum + row.wipValue, 0);
    const avg = filteredRows.length ? total / filteredRows.length : 0;
    return { total, avg };
  }, [filteredRows]);

  return (
    <ReportLayout
      title="Work Orders Status & Aging"
      description="Status mix and aging across all work orders."
      exportConfig={{
        filename: 'work-orders-status-aging',
        columns: [
          { key: 'order_number', header: 'WO #' },
          { key: 'customerName', header: 'Customer' },
          { key: 'unitLabel', header: 'Unit' },
          { key: 'status', header: 'Status', format: (val) => formatStatus(val as WorkOrderStatus) },
          { key: 'created_at', header: 'Created', format: (val) => new Date(String(val)).toLocaleDateString() },
          { key: 'daysOpen', header: 'Days Open' },
          { key: 'wipValue', header: 'WIP $', format: (val) => formatMoney(Number(val)) },
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
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="ESTIMATE">Estimate</SelectItem>
              <SelectItem value="INVOICED">Invoiced</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search work orders..."
            className="w-64"
          />
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{statusCounts.OPEN}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{statusCounts.IN_PROGRESS}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Estimates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{statusCounts.ESTIMATE}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{statusCounts.INVOICED}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Aging Buckets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(agingBuckets).map(([label, count]) => (
                  <TableRow key={label}>
                    <TableCell>{label}</TableCell>
                    <TableCell className="text-right">{count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Average ticket</span>
              <span className="font-semibold">{formatMoney(wipTotals.avg)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Total value</span>
              <span className="font-semibold">{formatMoney(wipTotals.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Work Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Days Open</TableHead>
                <TableHead className="text-right">WIP $</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No work orders found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.order_number}</TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>{row.unitLabel}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{row.daysOpen}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.wipValue)}</TableCell>
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
