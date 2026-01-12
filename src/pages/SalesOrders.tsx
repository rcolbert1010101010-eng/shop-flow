import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useRepos } from '@/repos';
import type { SalesOrder } from '@/types';
import { StatusBadge } from '@/components/ui/status-badge';

type SalesOrderRow = SalesOrder & { customer_name: string; is_active?: boolean };

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function SalesOrders() {
  const navigate = useNavigate();
  const repos = useRepos();
  const { salesOrders } = repos.salesOrders;
  const { customers } = repos.customers;
  const [statusFilter, setStatusFilter] = useState<'open' | 'estimate' | 'invoiced' | 'partial' | 'completed' | 'cancelled' | 'deleted'>('open');

  const tableData = useMemo<SalesOrderRow[]>(() => {
    return salesOrders.map((order) => {
      const customer = customers.find((c) => c.id === order.customer_id);
      return {
        ...order,
        customer_name: customer?.company_name || '-',
      };
    });
  }, [customers, salesOrders]);

  const columns: Column<SalesOrderRow>[] = [
    { key: 'order_number', header: 'Order #', sortable: true, className: 'font-mono' },
    {
      key: 'customer_name',
      header: 'Customer',
      sortable: true,
      render: (item) => item.customer_name || '-',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item) => <StatusBadge status={item.status} />,
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
    const statusFiltered = tableData.filter((order) => {
      switch (statusFilter) {
        case 'open':
          return order.is_active !== false && order.status === 'OPEN';
        case 'estimate':
          return order.is_active !== false && order.status === 'ESTIMATE';
        case 'invoiced':
          return order.is_active !== false && order.status === 'INVOICED';
        case 'partial':
          return order.is_active !== false && order.status === 'PARTIAL';
        case 'completed':
          return order.is_active !== false && order.status === 'COMPLETED';
        case 'cancelled':
          return order.is_active !== false && order.status === 'CANCELLED';
        case 'deleted':
          return order.is_active === false;
        default:
          return true;
      }
    });

    if (statusFilter === 'deleted') {
      return statusFiltered.map((order) => ({ ...order, is_active: true }));
    }

    return statusFiltered;
  }, [statusFilter, tableData]);

  return (
    <div className="page-container">
      <PageHeader
        title="Sales Orders"
        subtitle="Manage counter sales and parts orders"
        actions={
          <Button onClick={() => navigate('/sales-orders/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Sales Order
          </Button>
        }
      />

      <div className="mb-4 overflow-x-auto">
        <div className="flex justify-end gap-2 min-w-max pr-1">
          {(['open', 'estimate', 'partial', 'completed', 'invoiced', 'cancelled', 'deleted'] as const).map((filter) => (
            <Button
              key={filter}
              variant={statusFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'open' && 'Open'}
              {filter === 'estimate' && 'Estimates'}
              {filter === 'partial' && 'Partial'}
              {filter === 'completed' && 'Completed'}
              {filter === 'invoiced' && 'Invoiced'}
              {filter === 'cancelled' && 'Cancelled'}
              {filter === 'deleted' && 'Deleted'}
            </Button>
          ))}
        </div>
      </div>

      <DataTable
        data={filteredTableData}
        columns={columns}
        searchKeys={['order_number', 'customer_name']}
        searchPlaceholder="Search sales orders..."
        onRowClick={(order) => navigate(`/sales-orders/${order.id}`)}
        emptyMessage="No sales orders found. Create your first sales order to get started."
      />
    </div>
  );
}
