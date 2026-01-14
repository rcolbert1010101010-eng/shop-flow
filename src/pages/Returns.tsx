import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRepos } from '@/repos';
import type { Return } from '@/types';
import { Plus } from 'lucide-react';
import { getReturnInsights } from '@/services/returnsWarrantyInsights';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

type ReturnRow = Return & { vendor_name: string };

export default function Returns() {
  const navigate = useNavigate();
  const repos = useRepos();
  const { returns, returnLines } = repos.returns;
  const { vendors } = repos.vendors;
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [vendorSelection, setVendorSelection] = useState('');

  const tableData = useMemo<ReturnRow[]>(() => {
    return returns.map((ret) => {
      const vendor = vendors.find((v) => v.id === ret.vendor_id);
      return { ...ret, vendor_name: vendor?.vendor_name || '-' };
    });
  }, [returns, vendors]);

  const filtered = useMemo(() => {
    return tableData.filter((ret) => {
      if (statusFilter === 'closed') {
        return ret.status === 'CLOSED' || ret.status === 'CANCELLED';
      }
      if (statusFilter === 'open') {
        return !(ret.status === 'CLOSED' || ret.status === 'CANCELLED');
      }
      return true;
    });
  }, [statusFilter, tableData]);

  const columns: Column<ReturnRow>[] = [
    { key: 'id', header: 'Return #', sortable: true, className: 'font-mono' },
    { key: 'vendor_name', header: 'Vendor', sortable: true },
    {
      key: 'insight',
      header: '',
      render: (item) => {
        const insight = getReturnInsights(item, { returns, returnLines });
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
      key: 'tracking_number',
      header: 'Tracking',
      render: (item) => item.tracking_number || '—',
    },
    {
      key: 'updated_at',
      header: 'Updated',
      sortable: true,
      render: (item) => new Date(item.updated_at).toLocaleDateString(),
    },
  ];

  const handleCreate = () => {
    if (!vendorSelection) return;
    const newReturn = repos.returns.createReturn({ vendor_id: vendorSelection });
    if (newReturn) {
      navigate(`/returns/${newReturn.id}`);
      setVendorSelection('');
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Returns"
        subtitle="Track vendor returns and RMAs"
        actions={
          <>
            <ModuleHelpButton moduleKey="warranty_returns" />
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Return
                </Button>
              </DialogTrigger>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Return</DialogTitle>
                <DialogDescription>Select a vendor to start a return.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Select value={vendorSelection} onValueChange={setVendorSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.vendor_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setVendorSelection('')}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!vendorSelection}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
        }
      />

      <div className="flex justify-end gap-2 mb-4">
        {(['all', 'open', 'closed'] as const).map((filter) => (
          <Button
            key={filter}
            variant={statusFilter === filter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(filter)}
          >
            {filter === 'all' && 'All'}
            {filter === 'open' && 'Open'}
            {filter === 'closed' && 'Closed'}
          </Button>
        ))}
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        searchKeys={['id', 'vendor_name', 'rma_number', 'tracking_number']}
        searchPlaceholder="Search returns..."
        onRowClick={(ret) => navigate(`/returns/${ret.id}`)}
        emptyMessage="No returns found."
        showActiveFilter={false}
      />
    </div>
  );
}
