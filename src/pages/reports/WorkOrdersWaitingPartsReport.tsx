import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReportLayout } from '@/components/reports/ReportLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRepos } from '@/repos';
import {
  getAgingBucket,
  getDaysOpen,
  getWipValue,
  isWaitingOnParts,
  joinWorkOrders,
  type WorkOrderWithRefs,
} from '@/lib/reports/workOrders';
import { usePermissions } from '@/security/usePermissions';
import { useToast } from '@/hooks/use-toast';

type WaitingRow = WorkOrderWithRefs & {
  daysOpen: number;
  wipValue: number;
  waitingOnParts: boolean;
  blocker: string;
};

const formatMoney = (value: number) => `$${value.toFixed(2)}`;

export default function WorkOrdersWaitingPartsReport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can, isReady } = usePermissions();
  const canViewReports = can('reports.view');
  const repos = useRepos();
  const { workOrders, workOrderPartLines } = repos.workOrders;
  const { customers } = repos.customers;
  const { units } = repos.units;
  const { parts } = repos.parts;

  const [search, setSearch] = useState('');
  const nowRef = useMemo(() => new Date(), []);

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

  const rows = useMemo<WaitingRow[]>(() => {
    return joinWorkOrders(workOrders, customers, units).map((order) => {
      const daysOpen = getDaysOpen(order.created_at, nowRef);
      const wipValue = getWipValue(order);
      const waitingOnParts = isWaitingOnParts(order, workOrderPartLines, parts);
      const blocker =
        ((order as any).blocker_reason as string | undefined) ||
        ((order as any).parts_blocker as string | undefined) ||
        order.notes ||
        '';

      return { ...order, daysOpen, wipValue, waitingOnParts, blocker };
    });
  }, [customers, units, workOrders, nowRef, workOrderPartLines, parts]);

  const waitingRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => row.waitingOnParts)
      .filter((row) => {
        if (!query) return true;
        return (
          row.order_number.toLowerCase().includes(query) ||
          row.customerName.toLowerCase().includes(query) ||
          row.unitLabel.toLowerCase().includes(query) ||
          row.blocker.toLowerCase().includes(query)
        );
      });
  }, [rows, search]);

  const agingBuckets = useMemo(() => {
    const buckets: Record<'0-2' | '3-7' | '8-14' | '15+', number> = {
      '0-2': 0,
      '3-7': 0,
      '8-14': 0,
      '15+': 0,
    };
    waitingRows.forEach((row) => {
      buckets[getAgingBucket(row.daysOpen)] += 1;
    });
    return buckets;
  }, [waitingRows]);

  if (!isReady) return null;
  if (isReady && !canViewReports) return null;

  return (
    <ReportLayout
      title="Work Orders Waiting on Parts"
      description="Operational view of work orders blocked by parts availability."
      exportConfig={{
        filename: 'work-orders-waiting-parts',
        columns: [
          { key: 'order_number', header: 'WO #' },
          { key: 'customerName', header: 'Customer' },
          { key: 'unitLabel', header: 'Unit' },
          { key: 'status', header: 'Status' },
          { key: 'created_at', header: 'Created', format: (val) => new Date(String(val)).toLocaleDateString() },
          { key: 'daysOpen', header: 'Days Open' },
          { key: 'wipValue', header: 'WIP $', format: (val) => formatMoney(Number(val)) },
          { key: 'blocker', header: 'Notes/Blocker' },
        ],
        rows: waitingRows,
      }}
      filters={
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by WO #, customer, unit, or blocker..."
          className="w-96"
        />
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Waiting Work Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{waitingRows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">WIP Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(waitingRows.reduce((sum, row) => sum + row.wipValue, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Average Days Open</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {waitingRows.length
                ? (waitingRows.reduce((sum, row) => sum + row.daysOpen, 0) / waitingRows.length).toFixed(1)
                : '0'}
            </p>
          </CardContent>
        </Card>
      </div>

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
              {Object.entries(agingBuckets).map(([bucket, count]) => (
                <TableRow key={bucket}>
                  <TableCell>{bucket}</TableCell>
                  <TableCell className="text-right">{count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waiting on Parts</CardTitle>
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
                <TableHead>Notes / Blocker</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waitingRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No work orders are flagged as waiting on parts.
                  </TableCell>
                </TableRow>
              ) : (
                waitingRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.order_number}</TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>{row.unitLabel}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{row.daysOpen}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.wipValue)}</TableCell>
                    <TableCell>{row.blocker || '-'}</TableCell>
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
