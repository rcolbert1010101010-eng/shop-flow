import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import {
  ManufacturingTemplate,
  useManufacturingStore,
} from '@/stores/manufacturingStore';

const getTemplateValue = (template: ManufacturingTemplate, keys: string[]) => {
  const record = template as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
};

const isDraftValid = (template: ManufacturingTemplate) => {
  const record = template as Record<string, unknown>;
  const value =
    record.draft_is_valid ??
    record.is_draft_valid ??
    record.draft_valid ??
    record.draft_validated;
  if (value === undefined || value === null) return true;
  return Boolean(value);
};

const getActiveState = (template: ManufacturingTemplate) => {
  const record = template as Record<string, unknown>;
  if (typeof record.is_active === 'boolean') return record.is_active;
  if (typeof record.active === 'boolean') return record.active;
  if (typeof record.status === 'string') return record.status.toLowerCase() === 'active';
  return true;
};

const formatUpdatedAt = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

export default function ManufacturingTemplates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const templates = useManufacturingStore((state) => state.templates);
  const fetchTemplates = useManufacturingStore((state) => state.fetchTemplates);
  const saveTemplateVersion = useManufacturingStore((state) => state.saveTemplateVersion);
  const isSavingTemplateVersion = useManufacturingStore((state) => state.isSavingTemplateVersion);
  const isFetchingTemplates = useManufacturingStore((state) => state.isFetchingTemplates);

  const [confirmTemplate, setConfirmTemplate] = useState<ManufacturingTemplate | null>(null);
  const [deactivatingTemplates, setDeactivatingTemplates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      const result = await fetchTemplates();
      if (!result.success && result.error) {
        toast({
          title: 'Failed to load templates',
          description: result.error,
          variant: 'destructive',
        });
      }
    };
    void load();
  }, [fetchTemplates, toast]);

  const templateRows = useMemo(() => templates, [templates]);

  const handleConfirmSave = async () => {
    if (!confirmTemplate) return;
    const result = await saveTemplateVersion(confirmTemplate.id);
    if (!result.success) {
      toast({
        title: 'Unable to save version',
        description: result.error ?? 'Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'New version saved',
        description: `${confirmTemplate.name ?? 'Template'} versioned successfully.`,
      });
    }
    setConfirmTemplate(null);
  };

  const handleDeactivate = async (template: ManufacturingTemplate) => {
    if (deactivatingTemplates[template.id]) return;
    setDeactivatingTemplates((state) => ({ ...state, [template.id]: true }));
    try {
      await apiClient.put(`/manufacturing/templates/${template.id}`, { is_active: false });
      const refresh = await fetchTemplates();
      if (!refresh.success && refresh.error) {
        toast({
          title: 'Deactivated, but refresh failed',
          description: refresh.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Template deactivated',
          description: `${template.name ?? 'Template'} is now inactive.`,
        });
      }
    } catch (error) {
      toast({
        title: 'Failed to deactivate template',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setDeactivatingTemplates((state) => ({ ...state, [template.id]: false }));
    }
  };

  return (
    <div className="page-container">
      <PageHeader title="Manufacturing Templates" />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Current Version</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templateRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  {isFetchingTemplates ? 'Loading templates...' : 'No templates yet.'}
                </TableCell>
              </TableRow>
            ) : (
              templateRows.map((template) => {
                const currentVersion = getTemplateValue(template, [
                  'current_version',
                  'current_version_id',
                  'version',
                  'latest_version',
                ]);
                const isActive = getActiveState(template);
                const draftValid = isDraftValid(template);
                const isSavingVersion = Boolean(isSavingTemplateVersion[template.id]);
                const isDeactivating = Boolean(deactivatingTemplates[template.id]);

                return (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name ?? 'Untitled'}</TableCell>
                    <TableCell>{currentVersion ? String(currentVersion) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={isActive ? 'default' : 'outline'}>
                        {isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatUpdatedAt(template.updated_at ?? template.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/manufacturing/templates/${template.id}/edit`)}
                        >
                          Edit Draft
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setConfirmTemplate(template)}
                          disabled={!draftValid || isSavingVersion}
                        >
                          {isSavingVersion ? 'Saving...' : 'Save New Version'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleDeactivate(template)}
                          disabled={!isActive || isDeactivating}
                        >
                          {isDeactivating ? 'Deactivating...' : 'Deactivate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!confirmTemplate} onOpenChange={(open) => {
        if (!open) setConfirmTemplate(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save a new version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will lock the current draft and create a new version for "{confirmTemplate?.name ?? 'this template'}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>
              Save New Version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
