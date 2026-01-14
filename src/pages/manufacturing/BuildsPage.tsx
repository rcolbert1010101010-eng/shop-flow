import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import {
  computeBomAvailabilitySummary,
  groupBuildsByStatus,
  useManufacturingBuilds,
} from '@/hooks/useManufacturing';
import type { ManufacturingBuildWithRelations } from '@/integrations/supabase/manufacturing';
import type { ManufacturingBuildStatus } from '@/types';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { fetchProductBom } from '@/integrations/supabase/manufacturing';
import { fetchParts } from '@/integrations/supabase/catalog';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

const STATUS_OPTIONS: Array<{ value: ManufacturingBuildStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'ENGINEERING', label: 'Engineering' },
  { value: 'FABRICATION', label: 'Fabrication' },
  { value: 'ASSEMBLY', label: 'Assembly' },
  { value: 'PAINT', label: 'Paint' },
  { value: 'QA', label: 'QA' },
  { value: 'READY', label: 'Ready' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const BOARD_COLUMNS: Array<{ key: 'queued' | 'inProgress' | 'waitingParts' | 'onHold' | 'complete'; label: string }> = [
  { key: 'queued', label: 'Queued' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'waitingParts', label: 'Waiting Parts' },
  { key: 'onHold', label: 'On Hold' },
  { key: 'complete', label: 'Complete' },
];

export default function ManufacturingBuildsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
  const [statusFilter, setStatusFilter] = useState<ManufacturingBuildStatus | 'all'>('all');
  const buildsQuery = useManufacturingBuilds();

  const builds = useMemo(() => buildsQuery.data ?? [], [buildsQuery.data]);

  const filteredBuilds = useMemo(
    () => (statusFilter === 'all' ? builds : builds.filter((build) => build.status === statusFilter)),
    [builds, statusFilter]
  );

  const groupedBuilds = useMemo(() => groupBuildsByStatus(filteredBuilds), [filteredBuilds]);

  const uniqueProductIds = useMemo(
    () => Array.from(new Set(filteredBuilds.map((build) => build.product_id).filter(Boolean))),
    [filteredBuilds]
  );

  const partsQuery = useQuery({
    queryKey: ['parts-all'],
    queryFn: () => fetchParts(),
    enabled: uniqueProductIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const bomQueries = useQueries({
    queries: uniqueProductIds.map((pid) => ({
      queryKey: ['manufacturing-product-bom', pid],
      queryFn: () => fetchProductBom(pid),
      enabled: Boolean(pid),
      staleTime: 1000 * 60 * 2,
    })),
  });

  const availabilityByProduct = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeBomAvailabilitySummary>>();
    if (!partsQuery.data) return map;
    uniqueProductIds.forEach((pid, index) => {
      const bomData = bomQueries[index]?.data;
      if (bomData) {
        map.set(pid, computeBomAvailabilitySummary(bomData, partsQuery.data));
      }
    });
    return map;
  }, [bomQueries, partsQuery.data, uniqueProductIds]);

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString() : 'No date';

  const priorityBadgeClass = (priority?: string | null) => {
    switch (priority) {
      case 'rush':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'low':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const priorityLabel = (priority?: string | null) => {
    switch (priority) {
      case 'rush':
        return 'Rush';
      case 'high':
        return 'High';
      case 'low':
        return 'Low';
      default:
        return 'Normal';
    }
  };

  const columns: Column<ManufacturingBuildWithRelations>[] = useMemo(
    () => [
      { key: 'build_number', header: 'Build #' },
      {
        key: 'customer_name',
        header: 'Customer',
        render: (build) => build.customer?.company_name ?? 'Unassigned',
      },
      {
        key: 'product_name',
        header: 'Product',
        render: (build) => build.product?.name ?? '—',
      },
      { key: 'status', header: 'Status' },
      {
        key: 'serial_number',
        header: 'Serial',
        render: (build) => build.serial_number ?? '—',
      },
      {
        key: 'priority',
        header: 'Priority',
        render: (build) => (
          <Badge variant="outline" className={priorityBadgeClass(build.priority)}>
            {priorityLabel(build.priority)}
          </Badge>
        ),
      },
      {
        key: 'internal_job_number',
        header: 'Job #',
        render: (build) => build.internalJobNumber ?? '—',
      },
      {
        key: 'promised_date',
        header: 'Promised',
        render: (build) => formatDate(build.promisedDate),
      },
      {
        key: 'created_at',
        header: 'Created',
        render: (build) => new Date(build.created_at).toLocaleDateString(),
      },
      {
        key: 'is_active',
        header: 'Active',
        render: (build) => (build.is_active ? 'Yes' : 'No'),
      },
    ],
    []
  );

  const tableData = useMemo(
    () =>
      filteredBuilds.map((build) => ({
        ...build,
        customer_name: build.customer?.company_name ?? '',
        product_name: build.product?.name ?? '',
        internal_job_number: build.internalJobNumber ?? '',
      })),
    [filteredBuilds]
  );

  const statusLabel = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? 'Status';

  const summaryCounts = {
    total: filteredBuilds.length,
    queued: groupedBuilds.queued.length,
    inProgress: groupedBuilds.inProgress.length,
    waitingParts: groupedBuilds.waitingParts.length,
    onHold: groupedBuilds.onHold.length,
    complete: groupedBuilds.complete.length,
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Manufacturing Builds"
        subtitle="Track the lifecycle of each build"
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="manufacturing" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">{statusLabel}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {STATUS_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setStatusFilter(option.value)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => navigate('/manufacturing/builds/new')}>
              <Plus className="w-4 h-4 mr-2" />
              New Build
            </Button>
          </div>
        }
      />

      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)} className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Builds</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summaryCounts.total}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Queued</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summaryCounts.queued}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summaryCounts.inProgress}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Waiting Parts</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summaryCounts.waitingParts}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">On Hold</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summaryCounts.onHold}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Complete</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summaryCounts.complete}</CardContent>
          </Card>
        </div>

        <TabsContent value="table" className="space-y-4">
          <DataTable
            data={tableData}
            columns={columns}
            searchKeys={['build_number', 'customer_name', 'product_name', 'internal_job_number']}
            searchPlaceholder="Search builds..."
            onRowClick={(build) => navigate(`/manufacturing/builds/${build.id}`)}
            emptyMessage={buildsQuery.isLoading ? 'Loading builds...' : 'No builds yet'}
          />
        </TabsContent>

        <TabsContent value="board" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {BOARD_COLUMNS.map((column) => {
              const buildsInColumn = groupedBuilds[column.key];
              return (
                <Card key={column.key} className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{column.label}</CardTitle>
                      <Badge variant="secondary">{buildsInColumn.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {buildsInColumn.length === 0 && (
                      <p className="text-sm text-muted-foreground">No builds</p>
                    )}
                    {buildsInColumn.map((build) => (
                      <div
                        key={build.id}
                        className="border rounded-md bg-background p-3 shadow-sm space-y-2 cursor-pointer hover:border-primary/60"
                        onClick={() => navigate(`/manufacturing/builds/${build.id}`)}
                      >
                        {(() => {
                          const availability = build.product_id ? availabilityByProduct.get(build.product_id) : undefined;
                          const statusLabel = !availability
                            ? 'Unknown'
                            : availability.unknown
                            ? 'Unknown'
                            : availability.ready
                            ? 'Ready'
                            : 'Short';
                          const badgeClass = !availability || availability.unknown
                            ? 'bg-slate-100 text-slate-700'
                            : availability.ready
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700';
                          return (
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className={badgeClass}>
                                {statusLabel}
                              </Badge>
                              {availability && !availability.unknown && !availability.ready && (
                                <span className="text-xs text-orange-700">
                                  Short {availability.shortages.length} line{availability.shortages.length === 1 ? '' : 's'}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{build.build_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {build.product?.name ?? 'No product selected'}
                            </p>
                          </div>
                          <Badge variant="outline" className={priorityBadgeClass(build.priority)}>
                            {priorityLabel(build.priority)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{build.internalJobNumber ?? 'No job #'}</span>
                          <span>{formatDate(build.promisedDate)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <Badge variant="secondary">{build.status}</Badge>
                          <span className="text-muted-foreground">
                            {build.customer?.company_name ?? 'Unassigned customer'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
