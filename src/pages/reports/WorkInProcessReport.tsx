import { useMemo, useState } from 'react';
import { ReportLayout } from '@/components/reports/ReportLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useRepos } from '@/repos';
import {
  getAgingBucket,
  getDaysOpen,
  getPromisedDate,
  getTechnicianName,
  getWipValue,
  isWaitingOnParts,
  joinWorkOrders,
  type WorkOrderWithRefs,
} from '@/lib/reports/workOrders';
import type { WorkOrderStatus } from '@/types';

type WipRow = WorkOrderWithRefs & {
  daysOpen: number;
  wipValue: number;
  promisedAt: string | null;
  technicianName: string;
  waitingOnParts: boolean;
};

const STATUS_OPTIONS: WorkOrderStatus[] = ['OPEN', 'IN_PROGRESS', 'ESTIMATE', 'INVOICED'];

const formatMoney = (value: number) => `$${value.toFixed(2)}`;

export default function WorkInProcessReport() {
  const repos = useRepos();
  const { workOrders, workOrderPartLines } = repos.workOrders;
  const { customers } = repos.customers;
  const { units } = repos.units;
  const { parts } = repos.parts;
  const { technicians } = repos.technicians;

  const [selectedStatuses, setSelectedStatuses] = useState<WorkOrderStatus[]>(['OPEN', 'IN_PROGRESS', 'ESTIMATE']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [unitQuery, setUnitQuery] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyWaitingParts, setOnlyWaitingParts] = useState(false);

  const nowRef = useMemo(() => new Date(), []);

  const rows = useMemo<WipRow[]>(() => {
    return joinWorkOrders(workOrders, customers, units).map((order) => {
      const daysOpen = getDaysOpen(order.created_at, nowRef);
      const wipValue = getWipValue(order);
      const promisedAt = getPromisedDate(order);
      const technicianName = getTechnicianName(order, technicians);
      const waitingOnParts = isWaitingOnParts(order, workOrderPartLines, parts);
      return { ...order, daysOpen, wipValue, promisedAt, technicianName, waitingOnParts };
    });
  }, [customers, units, workOrders, nowRef, technicians, workOrderPartLines, parts]);

  const filteredRows = useMemo(() => {
    const customerTerm = customerQuery.trim().toLowerCase();
    const unitTerm = unitQuery.trim().toLowerCase();
    const startMs = startDate ? new Date(startDate).getTime() : null;
    const endMs = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;
    const statuses = selectedStatuses.length === 0 ? STATUS_OPTIONS : selectedStatuses;

    return rows.filter((row) => {
      const createdMs = new Date(row.created_at).getTime();
      const matchesDate = (!startMs || createdMs >= startMs) && (!endMs || createdMs <= endMs);
      const matchesStatus = statuses.includes(row.status as WorkOrderStatus);
      const matchesCustomer = !customerTerm || row.customerName.toLowerCase().includes(customerTerm);
      const matchesUnit = !unitTerm || row.unitLabel.toLowerCase().includes(unitTerm);
      const matchesOverdue = !onlyOverdue
        ? true
        : Boolean(row.promisedAt && new Date(row.promisedAt).getTime() < nowRef.getTime());
      const matchesParts = !onlyWaitingParts || row.waitingOnParts;

      return matchesDate && matchesStatus && matchesCustomer && matchesUnit && matchesOverdue && matchesParts;
    });
  }, [customerQuery, endDate, nowRef, onlyOverdue, onlyWaitingParts, rows, selectedStatuses, startDate, unitQuery]);

  const nonInvoicedRows = useMemo(
    () => filteredRows.filter((row) => row.status !== 'INVOICED'),
    [filteredRows]
  );

  const wipTotals = useMemo(() => {
    const total = nonInvoicedRows.reduce((sum, row) => sum + row.wipValue, 0);
    const count = nonInvoicedRows.length;
    return { total, count, average: count ? total / count : 0 };
  }, [nonInvoicedRows]);

  const wipByStatus = useMemo(() => {
    return nonInvoicedRows.reduce<Record<WorkOrderStatus, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + row.wipValue;
      return acc;
    }, { ESTIMATE: 0, OPEN: 0, IN_PROGRESS: 0, INVOICED: 0 });
  }, [nonInvoicedRows]);

  const wipByAging = useMemo(() => {
    const buckets: Record<'0-2' | '3-7' | '8-14' | '15+', number> = {
      '0-2': 0,
      '3-7': 0,
      '8-14': 0,
      '15+': 0,
    };
    nonInvoicedRows.forEach((row) => {
      buckets[getAgingBucket(row.daysOpen)] += row.wipValue;
    });
    return buckets;
  }, [nonInvoicedRows]);

  const exportRows = filteredRows.map((row) => ({
    ...row,
    promisedLabel: row.promisedAt ? new Date(row.promisedAt).toLocaleDateString() : '-',
  }));

  const toggleStatus = (status: WorkOrderStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  return (
    <ReportLayout
      title="Work In Process (WIP)"
      description="Open and in-progress work orders with WIP value and aging."
      exportConfig={{
        filename: 'work-in-process',
        columns: [
          { key: 'order_number', header: 'WO #' },
          { key: 'customerName', header: 'Customer' },
          { key: 'unitLabel', header: 'Unit' },
          { key: 'status', header: 'Status' },
          { key: 'created_at', header: 'Created', format: (val) => new Date(String(val)).toLocaleDateString() },
          { key: 'daysOpen', header: 'Days Open' },
          { key: 'wipValue', header: 'WIP $', format: (val) => formatMoney(Number(val)) },
          { key: 'promisedLabel', header: 'Promised/Due' },
          { key: 'technicianName', header: 'Assigned Tech' },
        ],
        rows: exportRows,
      }}
      filters={
        <div className="flex flex-wrap gap-3">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-44"
            placeholder="Start date"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-44"
            placeholder="End date"
          />
          <Input
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            placeholder="Customer search"
            className="w-56"
          />
          <Input
            value={unitQuery}
            onChange={(e) => setUnitQuery(e.target.value)}
            placeholder="Unit search"
            className="w-56"
          />
          <div className="flex items-center gap-2">
            <Switch checked={onlyOverdue} onCheckedChange={setOnlyOverdue} id="overdue-toggle" />
            <Label htmlFor="overdue-toggle" className="text-sm text-muted-foreground">Only overdue</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={onlyWaitingParts} onCheckedChange={setOnlyWaitingParts} id="parts-toggle" />
            <Label htmlFor="parts-toggle" className="text-sm text-muted-foreground">Waiting on parts</Label>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_OPTIONS.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={selectedStatuses.includes(status) ? 'default' : 'outline'}
                onClick={() => toggleStatus(status)}
              >
                {status === 'OPEN' && 'Open'}
                {status === 'IN_PROGRESS' && 'In Progress'}
                {status === 'ESTIMATE' && 'Estimate'}
                {status === 'INVOICED' && 'Invoiced'}
              </Button>
            ))}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total WIP</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoney(wipTotals.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Work Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{wipTotals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Average WIP</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoney(wipTotals.average)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Waiting on Parts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{filteredRows.filter((r) => r.waitingOnParts).length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">WIP by Status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">WIP $</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(wipByStatus).map(([status, value]) => (
                  <TableRow key={status}>
                    <TableCell>{status}</TableCell>
                    <TableCell className="text-right">{formatMoney(value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">WIP by Aging</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">WIP $</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(wipByAging).map(([bucket, value]) => (
                  <TableRow key={bucket}>
                    <TableCell>{bucket}</TableCell>
                    <TableCell className="text-right">{formatMoney(value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Work In Process</CardTitle>
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
                <TableHead>Promised/Due</TableHead>
                <TableHead>Assigned Tech</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No work orders found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.order_number}</TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>{row.unitLabel}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{row.daysOpen}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.wipValue)}</TableCell>
                    <TableCell>{row.promisedAt ? new Date(row.promisedAt).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{row.technicianName}</TableCell>
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
