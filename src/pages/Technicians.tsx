import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useRepos } from '@/repos';
import type { Technician } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function Technicians() {
  const navigate = useNavigate();
  const repos = useRepos();
  const { technicians } = repos.technicians;
  const { getActiveTimeEntry } = repos.timeEntries;
  const { workOrders } = repos.workOrders;

  const columns: Column<Technician>[] = [
    { key: 'name', header: 'Name', sortable: true },
    {
      key: 'hourly_cost_rate',
      header: 'Cost Rate',
      sortable: true,
      render: (item) => `$${toNumber(item.hourly_cost_rate).toFixed(2)}/hr`,
      className: 'text-right',
    },
    {
      key: 'default_billable_rate',
      header: 'Billable Rate',
      sortable: true,
      render: (item) => item.default_billable_rate != null ? `$${toNumber(item.default_billable_rate).toFixed(2)}/hr` : '-',
      className: 'text-right',
    },
    {
      key: 'id',
      header: 'Status',
      render: (item) => {
        if (!item.is_active) {
          return <Badge variant="outline">Inactive</Badge>;
        }
        const activeEntry = getActiveTimeEntry(item.id);
        if (activeEntry) {
          const wo = workOrders.find((w) => w.id === activeEntry.work_order_id);
          return <Badge variant="default">Clocked In: {wo?.order_number || 'Unknown'}</Badge>;
        }
        return <Badge variant="secondary">Available</Badge>;
      },
    },
  ];
  const hasAnyTechs = technicians.length > 0;

  return (
    <div className="page-container">
      <PageHeader
        title="Technicians"
        subtitle="Manage shop technicians"
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="technicians" context={{ isEmpty: !hasAnyTechs }} />
            <Button onClick={() => navigate('/technicians/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Technician
            </Button>
          </div>
        }
      />

      <DataTable
        data={technicians}
        columns={columns}
        searchKeys={['name']}
        searchPlaceholder="Search technicians..."
        onRowClick={(tech) => navigate(`/technicians/${tech.id}`)}
        emptyMessage="No technicians found. Add your first technician to get started."
      />
    </div>
  );
}
