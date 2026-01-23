import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, MoreHorizontal, Wrench, CalendarClock, ShoppingCart, Upload } from 'lucide-react';
import { useRepos } from '@/repos';
import { useToast } from '@/hooks/use-toast';
import type { Unit } from '@/types';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';
import { ImportUnitsDialog } from '@/components/units/ImportUnitsDialog';
import { useShopStore } from '@/stores/shopStore';

const OPEN_WO_STATUSES = ['OPEN', 'IN_PROGRESS', 'SCHEDULED', 'ESTIMATE', 'HOLD'];
const OPEN_SO_STATUSES = ['OPEN', 'APPROVED', 'ESTIMATE', 'QUOTE', 'PARTIAL'];

export default function Units() {
  const navigate = useNavigate();
  const repos = useRepos();
  const { toast } = useToast();
  const resetUnitsForTenant = useShopStore((state) => state.resetUnitsForTenant);
  const tenantSettingsId = useShopStore((state) => state.settings.id);
  const lastTenantSettingsIdRef = useRef<string | undefined>(undefined);
  const { units } = repos.units;
  const { customers } = repos.customers;
  const { workOrders } = repos.workOrders;
  const { salesOrders } = repos.salesOrders;
  const { scheduling: schedulingRepo } = repos;
  const { createWorkOrder } = repos.workOrders;
  const { createSalesOrder } = repos.salesOrders;
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [tenantKey, setTenantKey] = useState(0);

  useEffect(() => {
    const prev = lastTenantSettingsIdRef.current;
    const next = tenantSettingsId;
    if (prev && next && prev !== next) {
      // Tenant switch invalidates unit caches to prevent cross-tenant leakage.
      resetUnitsForTenant();
      setTenantKey((k) => k + 1);
    }
    lastTenantSettingsIdRef.current = next;
  }, [resetUnitsForTenant, tenantSettingsId]);

  const unitActivity = useMemo(() => {
    const map: Record<
      string,
      { openWorkOrders: number; openSalesOrders: number; lastActivity: string | null }
    > = {};

    units.forEach((unit) => {
      map[unit.id] = { openWorkOrders: 0, openSalesOrders: 0, lastActivity: null };
    });

    workOrders.forEach((wo) => {
      if (!wo.unit_id || !map[wo.unit_id]) return;
      if (OPEN_WO_STATUSES.includes(wo.status as string)) {
        map[wo.unit_id].openWorkOrders += 1;
      }
      const ts = wo.updated_at || wo.created_at;
      if (ts && (!map[wo.unit_id].lastActivity || new Date(ts) > new Date(map[wo.unit_id].lastActivity!))) {
        map[wo.unit_id].lastActivity = ts;
      }
    });

    salesOrders.forEach((so) => {
      if (!so.unit_id || !map[so.unit_id]) return;
      if (OPEN_SO_STATUSES.includes(so.status as string)) {
        map[so.unit_id].openSalesOrders += 1;
      }
      const ts = so.updated_at || so.created_at;
      if (ts && (!map[so.unit_id].lastActivity || new Date(ts) > new Date(map[so.unit_id].lastActivity!))) {
        map[so.unit_id].lastActivity = ts;
      }
    });

    return map;
  }, [units, workOrders, salesOrders]);

  const customerOptions = useMemo(
    () =>
      [...customers]
        .sort((a, b) => a.company_name.localeCompare(b.company_name))
        .filter((c) => c.id !== 'walkin'),
    [customers]
  );

  const columns: Column<Unit>[] = useMemo(
    () => [
      { key: 'unit_name', header: 'Unit Name', sortable: true },
      {
        key: 'customer_id',
        header: 'Customer',
        sortable: true,
        render: (item) => {
          const customer = customers.find((c) => c.id === item.customer_id);
          return customer?.company_name || '-';
        },
      },
      { key: 'vin', header: 'VIN', sortable: true, className: 'font-mono text-xs' },
      { key: 'year', header: 'Year', sortable: true },
      { key: 'make', header: 'Make', sortable: true },
      { key: 'model', header: 'Model', sortable: true },
      {
        key: 'mileage',
        header: 'Mileage/Hours',
        render: (item) => {
          if (item.mileage) return `${item.mileage.toLocaleString()} mi`;
          if (item.hours) return `${item.hours.toLocaleString()} hrs`;
          return '-';
        },
      },
      {
        key: 'is_active',
        header: 'Status',
        render: (item) =>
          item.is_active === false ? (
            <Badge variant="destructive">Inactive</Badge>
          ) : (
            <Badge variant="secondary">Active</Badge>
          ),
      },
      {
        key: 'open_wos',
        header: 'Open WOs',
        render: (item) => unitActivity[item.id]?.openWorkOrders ?? 0,
      },
      {
        key: 'open_sos',
        header: 'Open SOs',
        render: (item) => unitActivity[item.id]?.openSalesOrders ?? 0,
      },
      {
        key: 'last_activity',
        header: 'Last Activity',
        render: (item) => {
          const last = unitActivity[item.id]?.lastActivity;
          return last ? new Date(last).toLocaleDateString() : '-';
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-20 text-right',
        render: (item) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    const created = createWorkOrder(item.customer_id, item.id);
                    navigate(`/work-orders/${created.id}`);
                  }}
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Create Work Order
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    const created = createWorkOrder(item.customer_id, item.id);
                    const { item: scheduleItem, reason } = schedulingRepo.ensureScheduleItemForWorkOrder(created.id);
                    if (!scheduleItem) {
                      toast({
                        title: 'Scheduling failed',
                        description: reason || 'Unable to create schedule item for work order',
                        variant: 'destructive',
                      });
                      return;
                    }
                    navigate(
                      `/work-orders/${created.id}?openScheduling=1&focusScheduleItemId=${scheduleItem.id}`
                    );
                  }}
                >
                  <CalendarClock className="w-4 h-4 mr-2" />
                  Create & Schedule Work Order
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    const created = createSalesOrder(item.customer_id, item.id);
                    navigate(`/sales-orders/${created.id}`);
                  }}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Create Sales Order
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [customers, unitActivity, createWorkOrder, createSalesOrder, navigate, schedulingRepo, toast]
  );

  const filteredUnits = units.filter((unit) => {
    const matchesCustomer =
      customerFilter === 'ALL' ? true : unit.customer_id === customerFilter;
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
        ? unit.is_active !== false
        : unit.is_active === false;
    return matchesCustomer && matchesStatus;
  });
  const hasAnyUnits = filteredUnits.length > 0;

  return (
    <div key={tenantKey} className="page-container">
      <PageHeader
        title="Units / Equipment"
        subtitle="Manage customer equipment and vehicles"
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="units" context={{ isEmpty: !hasAnyUnits }} />
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button onClick={() => navigate('/units/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Unit
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="w-full sm:w-64">
            <Select value={customerFilter} onValueChange={(val) => setCustomerFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All customers</SelectItem>
                {customerOptions.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-56">
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="ALL">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <DataTable
        data={filteredUnits}
        columns={columns}
        searchKeys={['unit_name', 'vin', 'make', 'model']}
        searchPlaceholder="Search units..."
        onRowClick={(unit) => navigate(`/units/${unit.id}`)}
        emptyMessage="No units found. Add your first unit to get started."
      />

      <ImportUnitsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        units={units}
        customers={customers}
      />
    </div>
  );
}
