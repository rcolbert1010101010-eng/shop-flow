import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useRepos } from '@/repos';
import type { WarrantyClaim } from '@/types';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getWarrantyClaimInsights } from '@/services/returnsWarrantyInsights';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

type ClaimRow = WarrantyClaim & { vendor_name: string; work_order_number: string };

const STATUS_FILTERS = ['ALL', 'OPEN', 'SUBMITTED', 'APPROVED', 'DENIED', 'PAID', 'CLOSED'] as const;

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function WarrantyClaims() {
  const repos = useRepos();
  const navigate = useNavigate();
  const { warrantyClaims } = repos.warranty;
  const { vendors } = repos.vendors;
  const { workOrders } = repos.workOrders;
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL');

  const tableData = useMemo<ClaimRow[]>(() => {
    return warrantyClaims.map((claim) => {
      const vendor = vendors.find((v) => v.id === claim.vendor_id);
      const wo = workOrders.find((w) => w.id === claim.work_order_id);
      return {
        ...claim,
        vendor_name: vendor?.vendor_name || '-',
        work_order_number: wo?.order_number || wo?.id || '—',
      };
    });
  }, [vendors, warrantyClaims, workOrders]);

  const filtered = useMemo(() => {
    return tableData.filter((c) => (statusFilter === 'ALL' ? true : c.status === statusFilter));
  }, [statusFilter, tableData]);

  const columns: Column<ClaimRow>[] = [
    { key: 'claim_number', header: 'Claim #', sortable: true, render: (item) => item.claim_number || item.id },
    { key: 'vendor_name', header: 'Vendor', sortable: true },
    {
      key: 'insight',
      header: '',
      render: (item) => {
        const insight = getWarrantyClaimInsights(item, { claims: warrantyClaims, claimLines: repos.warranty.warrantyClaimLines });
        if (insight.severity === 'info') return null;
        return <Badge variant="destructive">⚠︎</Badge>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'work_order_number',
      header: 'Work Order',
      render: (item) => item.work_order_number || '—',
    },
    {
      key: 'amount_requested',
      header: 'Requested',
      render: (item) => (item.amount_requested != null ? `$${toNumber(item.amount_requested).toFixed(2)}` : '—'),
    },
    {
      key: 'approved_amount',
      header: 'Approved',
      render: (item) => (item.approved_amount != null ? `$${toNumber(item.approved_amount).toFixed(2)}` : '—'),
    },
    {
      key: 'updated_at',
      header: 'Updated',
      sortable: true,
      render: (item) => new Date(item.updated_at).toLocaleDateString(),
    },
  ];

  const handleCreate = () => {
    // require vendor selection
    const vendor = vendors[0];
    const claim = repos.warranty.createWarrantyClaim({ vendor_id: vendor?.id || '' });
    if (claim) navigate(`/warranty/${claim.id}`);
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Warranty Claims"
        subtitle="Track vendor warranty claims"
        actions={
          <>
            <ModuleHelpButton moduleKey="warranty_returns" />
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              New Claim
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as (typeof STATUS_FILTERS)[number])}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        searchKeys={['vendor_name', 'claim_number', 'rma_number', 'work_order_number', 'id']}
        searchPlaceholder="Search warranty claims..."
        onRowClick={(claim) => navigate(`/warranty/${claim.id}`)}
        emptyMessage="No warranty claims found."
        showActiveFilter={false}
      />
    </div>
  );
}
