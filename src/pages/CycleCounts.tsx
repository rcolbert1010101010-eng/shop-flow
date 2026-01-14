import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import { useRepos } from '@/repos';
import type { CycleCountSession } from '@/types';
import { useShopStore } from '@/stores/shopStore';
import { useMemo, useState } from 'react';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

export default function CycleCounts() {
  const navigate = useNavigate();
  const { cycleCountSessions, createCycleCountSession } = useRepos().cycleCounts;
  const cycleCountLines = useShopStore((s) => s.cycleCountLines);
  const sessionUser = useShopStore((s) => s.getSessionUserName());
  const [showCancelled, setShowCancelled] = useState(false);
  const sessionStats = useMemo(() => {
    const stats: Record<string, { delta: number; last: string | null }> = {};
    cycleCountSessions.forEach((s) => {
      const lines = cycleCountLines.filter((l) => l.session_id === s.id);
      const delta = lines.reduce((sum, l) => {
        const counted = l.counted_qty ?? l.expected_qty;
        return sum + (counted - l.expected_qty);
      }, 0);
      const last = s.posted_at || s.created_at;
      stats[s.id] = { delta, last };
    });
    return stats;
  }, [cycleCountLines, cycleCountSessions]);
  const renderLastCount = (date?: string | null) => {
    if (!date) return null;
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return (
      <span className="rounded-md bg-muted px-2 py-0.5">
        Last count {Number.isFinite(days) && days >= 0 ? `${days}d ago` : new Date(date).toLocaleDateString()}
      </span>
    );
  };
  const hasAnyCycleCounts = cycleCountSessions.length > 0;

  const columns: Column<CycleCountSession>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (item) => {
        const stat = sessionStats[item.id];
        return (
          <div className="space-y-1">
            <div>{item.title || 'Untitled'}</div>
            <div className="flex gap-2 text-[11px] text-muted-foreground">
              {renderLastCount(stat?.last)}
              <span className="rounded-md bg-muted px-2 py-0.5">
                Δ {stat ? (stat.delta > 0 ? `+${stat.delta}` : stat.delta) : 0}
              </span>
            </div>
          </div>
        );
      },
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <Badge variant={item.status === 'POSTED' ? 'default' : item.status === 'CANCELLED' ? 'secondary' : 'outline'}>{item.status}</Badge>,
      sortable: true,
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (item) => new Date(item.created_at).toLocaleString(),
      sortable: true,
    },
    {
      key: 'posted_at',
      header: 'Posted',
      render: (item) => (item.posted_at ? new Date(item.posted_at).toLocaleString() : '—'),
      sortable: true,
    },
  ];

  const handleNew = () => {
    const created_by = sessionUser || 'system';
    const session = createCycleCountSession({ created_by });
    navigate(`/cycle-counts/${session.id}`);
  };

  const visibleSessions = useMemo(
    () => (showCancelled ? cycleCountSessions : cycleCountSessions.filter((s) => s.status !== 'CANCELLED')),
    [cycleCountSessions, showCancelled]
  );

  return (
    <div className="page-container">
      <PageHeader
        title="Cycle Counts"
        subtitle="Track and post stock counts"
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="cycle_counts" context={{ isEmpty: !hasAnyCycleCounts }} />
            <Button onClick={handleNew}>
              <Plus className="w-4 h-4 mr-2" />
              New Cycle Count
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex items-center gap-2">
        <Switch id="show-cancelled" checked={showCancelled} onCheckedChange={setShowCancelled} />
        <label htmlFor="show-cancelled" className="text-sm text-muted-foreground cursor-pointer select-none">
          Show Cancelled
        </label>
      </div>

      <DataTable
        data={visibleSessions}
        columns={columns}
        searchKeys={['title', 'status']}
        searchPlaceholder="Search cycle counts..."
        onRowClick={(session) => navigate(`/cycle-counts/${session.id}`)}
        emptyMessage="No cycle counts yet. Start a new session to begin counting."
      />
    </div>
  );
}
