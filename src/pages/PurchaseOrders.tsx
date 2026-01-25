import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useRepos } from '@/repos';
import type { PurchaseOrder } from '@/types';
import { getPurchaseOrderDerivedStatus } from '@/services/purchaseOrderStatus';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

type PurchaseOrderRow = PurchaseOrder & {
  vendor_name: string;
  derived_status: string;
  linked_sales_order: string;
  linked_work_order: string;
};

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const repos = useRepos();
  const { purchaseOrders, purchaseOrderLines } = repos.purchaseOrders;
  const { vendors } = repos.vendors;
  const { salesOrders } = repos.salesOrders;
  const { workOrders } = repos.workOrders;
  const [statusFilter, setStatusFilter] = useState<'open' | 'partial' | 'received'>('open');

  const linesByPo = useMemo(() => {
    return purchaseOrderLines.reduce<Record<string, typeof purchaseOrderLines>>((acc, line) => {
      acc[line.purchase_order_id] = acc[line.purchase_order_id] || [];
      acc[line.purchase_order_id].push(line);
      return acc;
    }, {});
  }, [purchaseOrderLines]);

  const tableData = useMemo<PurchaseOrderRow[]>(() => {
    return purchaseOrders.map((order) => {
      const derived_status = getPurchaseOrderDerivedStatus(order, linesByPo[order.id] || []);
      const vendor = vendors.find((v) => v.id === order.vendor_id);
      const linkedSales = order.sales_order_id
        ? salesOrders.find((so) => so.id === order.sales_order_id)
        : undefined;
      const linkedWork = order.work_order_id
        ? workOrders.find((wo) => wo.id === order.work_order_id)
        : undefined;

      return {
        ...order,
        vendor_name: vendor?.vendor_name || '-',
        derived_status,
        linked_sales_order: linkedSales
          ? linkedSales.order_number || linkedSales.id
          : '—',
        linked_work_order: linkedWork ? linkedWork.order_number || linkedWork.id : '—',
      };
    });
  }, [linesByPo, purchaseOrders, salesOrders, vendors, workOrders]);

  const columns: Column<PurchaseOrderRow>[] = [
    { 
      key: 'po_number', 
      header: (
        <span className="flex items-center gap-1">
          PO #
        </span>
      ), 
      sortable: true, 
      className: 'font-mono' 
    },
    {
      key: 'derived_status',
      header: (
        <span className="flex items-center gap-1">
          Derived Status
        </span>
      ),
      sortable: true,
      render: (item) => <StatusBadge status={item.derived_status as any} variant={item.derived_status === 'RECEIVED' ? 'success' : 'warning'} />,
    },
    {
      key: 'vendor_name',
      header: (
        <span className="flex items-center gap-1">
          Vendor
        </span>
      ),
      sortable: true,
    },
    {
      key: 'linked_sales_order',
      header: (
        <span className="flex items-center gap-1">
          Linked SO
        </span>
      ),
      sortable: true,
    },
    {
      key: 'linked_work_order',
      header: (
        <span className="flex items-center gap-1">
          Linked WO
        </span>
      ),
      sortable: true,
    },
    {
      key: 'status',
      header: (
        <span className="flex items-center gap-1">
          Status
        </span>
      ),
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={item.status} variant={item.status === 'CLOSED' ? 'success' : 'warning'} />
          {item.notes?.includes('Auto-generated') && (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              AUTO
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: (
        <span className="flex items-center gap-1">
          Created
        </span>
      ),
      sortable: true,
      render: (item) => new Date(item.created_at).toLocaleDateString(),
    },
  ];

  const filteredOrders = useMemo(() => {
    return tableData.filter((order) => {
      const derivedStatus = order.derived_status;
      switch (statusFilter) {
        case 'open':
          return derivedStatus === 'OPEN';
        case 'partial':
          return derivedStatus === 'PARTIALLY_RECEIVED';
        case 'received':
          return derivedStatus === 'RECEIVED';
        default:
          return true;
      }
    });
  }, [tableData, statusFilter]);

  return (
    <div className="page-container">
      <PageHeader
        title="Purchase Orders"
        subtitle={
          <span className="flex items-center gap-1">
            Manage vendor orders and receiving
          </span>
        }
        actions={
          <>
            <ModuleHelpButton moduleKey="purchase_orders" />
            <Button onClick={() => navigate('/purchase-orders/new')} title="Start a vendor order. Add lines, receive items, then close when complete.">
              <Plus className="w-4 h-4 mr-2" />
              New PO
            </Button>
          </>
        }
      />

      <div className="flex justify-end items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          Filters:
        </span>
        {(['open', 'partial', 'received'] as const).map((filter) => (
          <Button
            key={filter}
            variant={statusFilter === filter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(filter)}
          >
            {filter === 'open' && 'Open'}
            {filter === 'partial' && 'Partially Received'}
            {filter === 'received' && 'Received'}
          </Button>
        ))}
      </div>

      <DataTable
        data={filteredOrders}
        columns={columns}
        searchKeys={['po_number', 'vendor_name', 'linked_sales_order', 'linked_work_order']}
        searchPlaceholder="Search purchase orders..."
        onRowClick={(po) => navigate(`/purchase-orders/${po.id}`)}
        emptyMessage="No purchase orders found."
        showActiveFilter={false}
      />
    </div>
  );
}
