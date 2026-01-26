import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useManufacturingStore } from '@/stores/manufacturingStore';

type TemplateRecord = Record<string, unknown>;

const formatMoney = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return '—';
  return `$${numberValue.toFixed(2)}`;
};

const getTemplateValue = (record: TemplateRecord | null, keys: string[]) => {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
};

export default function ManufacturingJobCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const templateVersionId = searchParams.get('templateVersionId') ?? '';
  const templateNameFromQuery = searchParams.get('templateName') ?? '';

  const templates = useManufacturingStore((state) => state.templates);
  const createJobFromTemplate = useManufacturingStore((state) => state.createJobFromTemplate);
  const isSavingJobCreate = useManufacturingStore((state) => state.isSavingJobCreate);
  const jobs = useManufacturingStore((state) => state.jobs);

  const [jobName, setJobName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const template = useMemo(() => {
    if (!templateVersionId) return null;
    return (
      templates.find((item) => {
        const record = item as TemplateRecord;
        const versionMatch = getTemplateValue(record, [
          'current_version_id',
          'version',
          'latest_version',
        ]);
        return versionMatch != null && String(versionMatch) === templateVersionId;
      }) ?? null
    );
  }, [templates, templateVersionId]);

  const templateRecord = template ? (template as TemplateRecord) : null;
  const templateName = template?.name ?? templateNameFromQuery ?? '—';

  const isSaving = Boolean(isSavingJobCreate[templateVersionId]);
  const nameValid = jobName.trim().length > 0;
  const canSubmit = nameValid && templateVersionId && !isSaving;

  const templateVersionLabel = templateVersionId || '—';

  const costValues = {
    material: getTemplateValue(templateRecord, ['material_cost', 'materialCost', 'estimated_material_cost']),
    labor: getTemplateValue(templateRecord, ['labor_cost', 'laborCost', 'estimated_labor_cost']),
    overhead: getTemplateValue(templateRecord, ['overhead', 'estimated_overhead']),
    total: getTemplateValue(templateRecord, ['total_cost', 'totalCost', 'estimated_total_cost', 'total_estimated_cost']),
  };

  const hasCostValues = Object.values(costValues).some((value) => value !== null);

  const handleCreate = async () => {
    if (!templateVersionId) {
      setError('Template version is required to create a job.');
      return;
    }
    if (!nameValid) {
      setError('Job Name is required.');
      return;
    }

    setError(null);
    const previousIds = new Set(jobs.map((job) => job.id));
    const result = await createJobFromTemplate(templateVersionId, jobName.trim());
    if (!result.success) {
      setError(result.error ?? 'Unable to create job.');
      return;
    }

    const updatedJobs = useManufacturingStore.getState().jobs;
    const createdJob =
      updatedJobs.find((job) => !previousIds.has(job.id)) ??
      updatedJobs.find(
        (job) =>
          job.template_version_id === templateVersionId &&
          job.name?.trim() === jobName.trim()
      );

    if (createdJob) {
      navigate(`/manufacturing/jobs/${createdJob.id}`);
    }
  };

  if (!templateVersionId) {
    return (
      <div className="page-container space-y-6">
        <PageHeader title="Create Manufacturing Job" backTo="/manufacturing/jobs" />
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Template version is required. Open the Manufacturing Templates list and choose a template version to create a job.
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => navigate('/manufacturing/templates')}>Go to Templates</Button>
          <Button variant="outline" onClick={() => navigate('/manufacturing/jobs')}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Create Manufacturing Job" backTo="/manufacturing/jobs" />

      <div className="form-section space-y-4">
        <h2 className="text-lg font-semibold">Template</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <Input readOnly value={templateName || '—'} />
          </div>
          <div className="space-y-2">
            <Label>Version</Label>
            <Input readOnly value={templateVersionLabel} />
          </div>
        </div>
      </div>

      <div className="form-section space-y-4">
        <h2 className="text-lg font-semibold">Job Details</h2>
        <div className="space-y-2">
          <Label htmlFor="job-name">Job Name *</Label>
          <Input
            id="job-name"
            value={jobName}
            onChange={(event) => setJobName(event.target.value)}
            placeholder="Enter job name"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {hasCostValues ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Material Cost</Label>
                <Input readOnly value={formatMoney(costValues.material)} />
              </div>
              <div className="space-y-2">
                <Label>Labor Cost</Label>
                <Input readOnly value={formatMoney(costValues.labor)} />
              </div>
              <div className="space-y-2">
                <Label>Overhead</Label>
                <Input readOnly value={formatMoney(costValues.overhead)} />
              </div>
              <div className="space-y-2">
                <Label>Total</Label>
                <Input readOnly value={formatMoney(costValues.total)} />
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Cost will be calculated on create.</div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleCreate} disabled={!canSubmit}>
          {isSaving ? 'Creating...' : 'Create Job'}
        </Button>
        <Button variant="outline" onClick={() => navigate('/manufacturing/jobs')} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
