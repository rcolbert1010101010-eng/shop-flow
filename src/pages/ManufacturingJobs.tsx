import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ManufacturingJob, useManufacturingStore } from '@/stores/manufacturingStore';

const getJobValue = (job: ManufacturingJob, keys: string[]) => {
  const record = job as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
};

const formatMoney = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return '—';
  return `$${numberValue.toFixed(2)}`;
};

const formatCreatedAt = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

export default function ManufacturingJobs() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const jobs = useManufacturingStore((state) => state.jobs);
  const fetchJobs = useManufacturingStore((state) => state.fetchJobs);
  const isFetchingJobs = useManufacturingStore((state) => state.isFetchingJobs);

  useEffect(() => {
    const load = async () => {
      const result = await fetchJobs();
      if (!result.success && result.error) {
        toast({
          title: 'Failed to load jobs',
          description: result.error,
          variant: 'destructive',
        });
      }
    };
    void load();
  }, [fetchJobs, toast]);

  const rows = useMemo(() => jobs, [jobs]);

  return (
    <div className="page-container">
      <PageHeader
        title="Manufacturing Jobs"
        actions={
          <Button onClick={() => navigate('/manufacturing/jobs/new')}>
            New Job
          </Button>
        }
      />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Name</TableHead>
              <TableHead>Template + Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  {isFetchingJobs ? 'Loading jobs...' : 'No jobs yet.'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((job) => {
                const templateName = getJobValue(job, ['template_name', 'template_id']);
                const templateVersion = getJobValue(job, ['template_version', 'template_version_id', 'version']);
                const templateLabel = templateName
                  ? templateVersion
                    ? `${String(templateName)} · ${String(templateVersion)}`
                    : String(templateName)
                  : templateVersion
                    ? String(templateVersion)
                    : '—';

                const cost = getJobValue(job, ['cost', 'total_cost', 'estimated_cost']);

                return (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/manufacturing/jobs/${job.id}`)}
                  >
                    <TableCell className="font-medium">{job.name ?? 'Untitled Job'}</TableCell>
                    <TableCell>{templateLabel}</TableCell>
                    <TableCell>{job.status ?? '—'}</TableCell>
                    <TableCell className="text-right">{formatMoney(cost)}</TableCell>
                    <TableCell>{formatCreatedAt(job.created_at)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
