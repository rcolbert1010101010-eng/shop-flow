import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useRepos } from '@/repos';
import type { WorkOrder } from '@/types';
import { StatusBadge } from '@/components/ui/status-badge';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { TableDensitySelect } from '@/components/ui/TableDensitySelect';

type WorkOrderRow = WorkOrder & { customer_name: string; unit_label: string; is_active?: boolean };

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function WorkOrders() {
  const navigate = useNavigate();
  const repos = useRepos();
  const { workOrders } = repos.workOrders;
  const { customers } = repos.customers;
  const { units } = repos.units;
  const schedulingRepo = repos.scheduling;
  const scheduleItems = schedulingRepo.list();
  const [statusFilter, setStatusFilter] = useState<'open' | 'estimate' | 'invoiced' | 'deleted'>('open');
  const [showUnscheduledOnly, setShowUnscheduledOnly] = useState(false);

  const scheduledWorkOrderIds = useMemo(
    () =>
      new Set(
        scheduleItems
          .filter((s) => s.source_ref_type === 'WORK_ORDER')
          .map((s) => s.source_ref_id)
      ),
    [scheduleItems]
  );

  const tableData = useMemo<WorkOrderRow[]>(() => {
    return workOrders.map((order) => {
      const customer = customers.find((c) => c.id === order.customer_id);
      const unit = units.find((u) => u.id === order.unit_id);
      const unitParts = [unit?.year, unit?.make, unit?.model].filter(Boolean).join(' ');
      const unitLabel = unit?.unit_name || unitParts || unit?.vin || '-';

      return {
        ...order,
        customer_name: customer?.company_name || '-',
        unit_label: unitLabel,
      };
    });
  }, [customers, units, workOrders]);

  const columns: Column<WorkOrderRow>[] = [
    { key: 'order_number', header: 'Order #', sortable: true, className: 'font-mono' },
    {
      key: 'customer_name',
      header: 'Customer',
      sortable: true,
      render: (item) => item.customer_name || '-',
    },
    {
      key: 'unit_label',
      header: 'Unit',
      sortable: true,
      render: (item) => item.unit_label || '-',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'scheduled',
      header: 'Schedule',
      render: (item) => (
        <div className="flex items-center gap-2">
          {scheduledWorkOrderIds.has(item.id) ? (
            <Badge variant="secondary">Scheduled</Badge>
          ) : (
            <Badge variant="destructive">Unscheduled</Badge>
          )}
          {!scheduledWorkOrderIds.has(item.id) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                const existing = schedulingRepo.getByWorkOrder(item.id)[0];
                if (existing) {
                  navigate(`/scheduling?focusScheduleItemId=${existing.id}`);
                  return;
                }
                const start = new Date();
                start.setMinutes(0, 0, 0);
                start.setHours(start.getHours() + 1);
                const created = schedulingRepo.create({
                  source_ref_type: 'WORK_ORDER',
                  source_ref_id: item.id,
                  block_type: null,
                  block_title: null,
                  technician_id: null,
                  start_at: start.toISOString(),
                  duration_minutes: 60,
                  priority: 3,
                  promised_at: null,
                  parts_ready: false,
                  status: 'ON_TRACK',
                  notes: null,
                  auto_scheduled: false,
                });
                navigate(`/scheduling?focusScheduleItemId=${created.id}`);
              }}
            >
              Schedule
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                const existing = schedulingRepo.getByWorkOrder(item.id)[0];
                if (existing) navigate(`/scheduling?focusScheduleItemId=${existing.id}`);
              }}
            >
              View
            </Button>
          )}
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (item) => `$${toNumber(item.total).toFixed(2)}`,
      className: 'text-right',
    },
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      render: (item) => new Date(item.created_at).toLocaleDateString(),
    },
  ];

  const filteredTableData = useMemo(() => {
    let statusFiltered = tableData.filter((order) => {
      switch (statusFilter) {
        case 'open':
          return order.is_active !== false && (order.status === 'OPEN' || order.status === 'IN_PROGRESS');
        case 'estimate':
          return order.is_active !== false && order.status === 'ESTIMATE';
        case 'invoiced':
          return order.is_active !== false && order.status === 'INVOICED';
        case 'deleted':
          return order.is_active === false;
        default:
          return true;
      }
    });

    if (statusFilter === 'deleted') {
      statusFiltered = statusFiltered.map((order) => ({ ...order, is_active: true }));
    }

    if (showUnscheduledOnly) {
      statusFiltered = statusFiltered.filter((order) => !scheduledWorkOrderIds.has(order.id));
    }

    return statusFiltered;
  }, [scheduledWorkOrderIds, showUnscheduledOnly, statusFilter, tableData]);

  return (
    <div className="page-container">
      <PageHeader
        title="Work Orders"
        subtitle="Manage job, labor, parts, and status"
        actions={
          <Button onClick={() => navigate('/work-orders/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Work Order
          </Button>
        }
      />

      <div className="mb-4 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 min-w-max pr-2 whitespace-nowrap">
          <div className="flex flex-wrap gap-2">
            {(['open', 'estimate', 'invoiced', 'deleted'] as const).map((filter) => (
              <Button
                key={filter}
                variant={statusFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'open' && 'Open'}
                {filter === 'estimate' && 'Estimates'}
                {filter === 'invoiced' && 'Invoiced'}
                {filter === 'deleted' && 'Deleted'}
              </Button>
            ))}
            <Button
              variant={showUnscheduledOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowUnscheduledOnly((prev) => !prev)}
            >
              {showUnscheduledOnly ? 'All' : 'Unscheduled only'}
            </Button>
          </div>
          <TableDensitySelect />
        </div>
      </div>

      <DataTable
        data={filteredTableData}
        columns={columns}
        searchKeys={['order_number', 'customer_name', 'unit_label']}
        searchPlaceholder="Search work orders..."
        onRowClick={(order) => navigate(`/work-orders/${order.id}`)}
        showActiveFilter={false}
        emptyMessage="No work orders found. Create your first work order to get started."
      />
    </div>
  );
}
