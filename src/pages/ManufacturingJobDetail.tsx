import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useManufacturingStore } from '@/stores/manufacturingStore';

type JobStatus = 'DRAFT' | 'READY' | 'COMPLETED' | 'CANCELED' | string;

type OperationRow = {
  id: string;
  operation_type: string;
  skill_type: string;
  estimated_hours: number | null;
  labor_cost: number | null;
  machine_cost: number | null;
  total_cost: number | null;
};

const formatDateTime = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const formatMoney = (value: number | null) => {
  if (value === null || value === undefined) return '—';
  if (!Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
};

const toNumberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getRecordValue = (record: Record<string, unknown> | null, keys: string[]) => {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
};

const normalizeStatus = (value: unknown): JobStatus => {
  if (!value || typeof value !== 'string') return 'DRAFT';
  return value.toUpperCase();
};

const normalizeOperations = (value: unknown): OperationRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      return {
        id: record.id ? String(record.id) : crypto.randomUUID(),
        operation_type: typeof record.operation_type === 'string' ? record.operation_type : '—',
        skill_type: typeof record.skill_type === 'string' ? record.skill_type : '—',
        estimated_hours: toNumberOrNull(record.estimated_hours),
        labor_cost: toNumberOrNull(record.labor_cost ?? record.laborCost),
        machine_cost: toNumberOrNull(record.machine_cost ?? record.machineCost),
        total_cost: toNumberOrNull(record.total_cost ?? record.totalCost ?? record.calculated_cost),
      };
    }
    return {
      id: crypto.randomUUID(),
      operation_type: '—',
      skill_type: '—',
      estimated_hours: null,
      labor_cost: null,
      machine_cost: null,
      total_cost: null,
    };
  });
};

export default function ManufacturingJobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const fetchJobDetail = useManufacturingStore((state) => state.fetchJobDetail);
  const updateJobStatus = useManufacturingStore((state) => state.updateJobStatus);
  const jobDetails = useManufacturingStore((state) => state.jobDetails);
  const isFetchingJobDetail = useManufacturingStore((state) => state.isFetchingJobDetail);
  const isSavingJobStatus = useManufacturingStore((state) => state.isSavingJobStatus);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!jobId) return;
      const result = await fetchJobDetail(jobId);
      if (!result.success) {
        setError(result.error ?? 'Unable to load job details.');
      }
    };
    void load();
  }, [fetchJobDetail, jobId]);

  const job = useMemo(() => (jobId ? jobDetails[jobId] ?? null : null), [jobDetails, jobId]);
  const record = job ? (job as Record<string, unknown>) : null;
  const isLoading = jobId ? Boolean(isFetchingJobDetail[jobId]) : false;
  const isSaving = jobId ? Boolean(isSavingJobStatus[jobId]) : false;

  const status = normalizeStatus(job?.status);

  const templateName = getRecordValue(record, ['template_name', 'templateName', 'template_id']);
  const templateVersion = getRecordValue(record, [
    'template_version',
    'templateVersion',
    'template_version_id',
  ]);
  const templateLabel = templateName
    ? templateVersion
      ? `${String(templateName)} · ${String(templateVersion)}`
      : String(templateName)
    : templateVersion
      ? String(templateVersion)
      : '—';

  const operations = normalizeOperations(
    getRecordValue(record, ['operations', 'fabrication_operations', 'job_operations'])
  );

  const laborCost = toNumberOrNull(
    getRecordValue(record, ['labor_cost', 'laborCost', 'estimated_labor_cost'])
  );
  const machineCost = toNumberOrNull(
    getRecordValue(record, ['machine_cost', 'machineCost', 'estimated_machine_cost'])
  );
  const totalCost = toNumberOrNull(
    getRecordValue(record, ['total_cost', 'totalCost', 'estimated_total_cost', 'calculated_cost'])
  );

  const derivedLabor = laborCost !== null
    ? laborCost
    : operations.reduce((sum, op) => sum + (op.labor_cost ?? 0), 0);
  const derivedMachine = machineCost !== null
    ? machineCost
    : operations.reduce((sum, op) => sum + (op.machine_cost ?? 0), 0);
  const derivedTotal = totalCost !== null
    ? totalCost
    : operations.reduce((sum, op) => sum + (op.total_cost ?? 0), 0);

  const statusActions = useMemo(() => {
    if (status === 'DRAFT') {
      return [
        { label: 'Mark Ready', next: 'READY' },
        { label: 'Cancel Job', next: 'CANCELED' },
      ];
    }
    if (status === 'READY') {
      return [{ label: 'Complete Job', next: 'COMPLETED' }];
    }
    return [] as { label: string; next: string }[];
  }, [status]);

  const handleStatusChange = async (nextStatus: string) => {
    if (!jobId) return;
    setError(null);
    const result = await updateJobStatus(jobId, nextStatus);
    if (!result.success) {
      setError(result.error ?? 'Unable to update job status.');
    }
  };

  if (!job && !isLoading && !error) {
    return (
      <div className="page-container">
        <PageHeader title="Job Not Found" backTo="/manufacturing/jobs" />
        <p className="text-sm text-muted-foreground">This manufacturing job could not be found.</p>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title={job?.name ? `Job: ${job.name}` : 'Manufacturing Job'}
        backTo="/manufacturing/jobs"
      />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="form-section space-y-4">
        <h2 className="text-lg font-semibold">Job Metadata</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Job Name</Label>
            <div className="text-sm text-foreground">{job?.name ?? '—'}</div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <div>
              <Badge variant="outline">{status}</Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Created</Label>
            <div className="text-sm text-foreground">{formatDateTime(job?.created_at)}</div>
          </div>
        </div>
      </div>

      <div className="form-section space-y-2">
        <h2 className="text-lg font-semibold">Source Template + Version</h2>
        <div className="text-sm text-foreground">{templateLabel}</div>
      </div>

      <div className="form-section space-y-4">
        <h2 className="text-lg font-semibold">Operations</h2>
        {operations.length === 0 ? (
          <div className="text-sm text-muted-foreground">No operations listed for this job.</div>
        ) : (
          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead className="text-right">Est. Hours</TableHead>
                  <TableHead className="text-right">Labor Cost</TableHead>
                  <TableHead className="text-right">Machine Cost</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((operation) => (
                  <TableRow key={operation.id}>
                    <TableCell>{operation.operation_type.replace('_', ' ')}</TableCell>
                    <TableCell>{operation.skill_type}</TableCell>
                    <TableCell className="text-right">
                      {operation.estimated_hours != null ? operation.estimated_hours : '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(operation.labor_cost)}</TableCell>
                    <TableCell className="text-right">{formatMoney(operation.machine_cost)}</TableCell>
                    <TableCell className="text-right">{formatMoney(operation.total_cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Labor</Label>
              <div className="text-sm text-foreground">{formatMoney(derivedLabor)}</div>
            </div>
            <div className="space-y-2">
              <Label>Machine</Label>
              <div className="text-sm text-foreground">{formatMoney(derivedMachine)}</div>
            </div>
            <div className="space-y-2">
              <Label>Total</Label>
              <div className="text-sm text-foreground">{formatMoney(derivedTotal)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {statusActions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          {statusActions.map((action) => (
            <Button
              key={action.next}
              onClick={() => handleStatusChange(action.next)}
              disabled={isSaving}
            >
              {isSaving ? 'Updating...' : action.label}
            </Button>
          ))}
          <Button variant="outline" onClick={() => navigate('/manufacturing/jobs')} disabled={isSaving}>
            Back to Jobs
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/manufacturing/jobs')}>
            Back to Jobs
          </Button>
        </div>
      )}
    </div>
  );
}
