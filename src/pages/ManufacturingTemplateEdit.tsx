import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useManufacturingStore } from '@/stores/manufacturingStore';

const OPERATION_TYPES = ['weld', 'plasma_cut', 'brake_form', 'fit_up', 'paint'] as const;
const SKILL_TYPES = ['welder', 'fitter', 'painter', 'general'] as const;
const MACHINE_TYPES = ['plasma', 'brake'] as const;

type MaterialGroupDraft = {
  id: string;
  name: string;
  spec: string;
  estimated_quantity: string;
  unit: string;
  scrap_factor_percent: string;
  notes: string;
};

type OperationDraft = {
  id: string;
  operation_type: typeof OPERATION_TYPES[number] | '';
  estimated_hours: string;
  skill_type: typeof SKILL_TYPES[number] | '';
  machine_type: typeof MACHINE_TYPES[number] | '';
};

const toNumberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumber = (value: number) => value.toFixed(2);

const parseMaterialGroups = (value: unknown): MaterialGroupDraft[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      return {
        id: record.id ? String(record.id) : crypto.randomUUID(),
        name: typeof record.name === 'string' ? record.name : '',
        spec: typeof record.spec === 'string' ? record.spec : '',
        estimated_quantity: record.estimated_quantity != null ? String(record.estimated_quantity) : '',
        unit: typeof record.unit === 'string' ? record.unit : '',
        scrap_factor_percent: record.scrap_factor_percent != null ? String(record.scrap_factor_percent) : '',
        notes: typeof record.notes === 'string' ? record.notes : '',
      };
    }
    return {
      id: crypto.randomUUID(),
      name: '',
      spec: '',
      estimated_quantity: '',
      unit: '',
      scrap_factor_percent: '',
      notes: '',
    };
  });
};

const parseOperations = (value: unknown): OperationDraft[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      const operationType = typeof record.operation_type === 'string' ? record.operation_type : '';
      const skillType = typeof record.skill_type === 'string' ? record.skill_type : '';
      const machineType = typeof record.machine_type === 'string' ? record.machine_type : '';
      return {
        id: record.id ? String(record.id) : crypto.randomUUID(),
        operation_type: (OPERATION_TYPES as readonly string[]).includes(operationType)
          ? (operationType as OperationDraft['operation_type'])
          : '',
        estimated_hours: record.estimated_hours != null ? String(record.estimated_hours) : '',
        skill_type: (SKILL_TYPES as readonly string[]).includes(skillType)
          ? (skillType as OperationDraft['skill_type'])
          : '',
        machine_type: (MACHINE_TYPES as readonly string[]).includes(machineType)
          ? (machineType as OperationDraft['machine_type'])
          : '',
      };
    }
    return {
      id: crypto.randomUUID(),
      operation_type: '',
      estimated_hours: '',
      skill_type: '',
      machine_type: '',
    };
  });
};

export default function ManufacturingTemplateEdit() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  const templates = useManufacturingStore((state) => state.templates);
  const fetchTemplates = useManufacturingStore((state) => state.fetchTemplates);
  const saveTemplateDraft = useManufacturingStore((state) => state.saveTemplateDraft);
  const saveTemplateVersion = useManufacturingStore((state) => state.saveTemplateVersion);
  const isSavingTemplateDraft = useManufacturingStore((state) => state.isSavingTemplateDraft);
  const isSavingTemplateVersion = useManufacturingStore((state) => state.isSavingTemplateVersion);
  const isFetchingTemplates = useManufacturingStore((state) => state.isFetchingTemplates);

  const template = useMemo(
    () => templates.find((item) => item.id === templateId) ?? null,
    [templates, templateId]
  );

  const [identity, setIdentity] = useState({
    name: '',
    description: '',
    is_active: true,
  });
  const [materialGroups, setMaterialGroups] = useState<MaterialGroupDraft[]>([]);
  const [operations, setOperations] = useState<OperationDraft[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (templates.length > 0) return;
      const result = await fetchTemplates();
      if (!result.success && result.error) {
        setError(result.error);
      }
    };
    void load();
  }, [fetchTemplates, templates.length]);

  useEffect(() => {
    if (!template || hydrated) return;
    const record = template as Record<string, unknown>;
    setIdentity({
      name: template.name ?? '',
      description: typeof record.description === 'string' ? record.description : '',
      is_active: typeof record.is_active === 'boolean'
        ? record.is_active
        : typeof record.active === 'boolean'
          ? record.active
          : true,
    });

    setMaterialGroups(
      parseMaterialGroups(
        record.material_groups ?? record.materialGroups ?? record.materials ?? []
      )
    );
    setOperations(
      parseOperations(
        record.fabrication_operations ?? record.fabricationOperations ?? record.operations ?? []
      )
    );

    setHydrated(true);
  }, [template, hydrated]);

  const isSavingDraft = templateId ? Boolean(isSavingTemplateDraft[templateId]) : false;
  const isSavingVersion = templateId ? Boolean(isSavingTemplateVersion[templateId]) : false;
  const isSaving = isSavingDraft || isSavingVersion;

  const hasMaterialGroups = materialGroups.length > 0;
  const hasOperations = operations.length > 0;

  const identityValid = identity.name.trim().length > 0;
  const materialGroupsValid = materialGroups.every(
    (group) => group.name.trim().length > 0 && group.spec.trim().length > 0
  );
  const operationsValid = operations.every((operation) => {
    const hours = toNumberOrNull(operation.estimated_hours);
    return (
      operation.operation_type !== '' &&
      operation.skill_type !== '' &&
      hours !== null &&
      hours >= 0
    );
  });

  const canSaveVersion =
    identityValid &&
    hasMaterialGroups &&
    hasOperations &&
    materialGroupsValid &&
    operationsValid &&
    !isSaving;

  const materialSubtotal = materialGroups.reduce((sum, group) => {
    const qty = toNumberOrNull(group.estimated_quantity) ?? 0;
    const scrap = toNumberOrNull(group.scrap_factor_percent) ?? 0;
    return sum + qty * (1 + scrap / 100);
  }, 0);

  const operationsSubtotal = operations.reduce((sum, operation) => {
    const hours = toNumberOrNull(operation.estimated_hours) ?? 0;
    return sum + Math.max(0, hours);
  }, 0);

  const totalEstimate = materialSubtotal + operationsSubtotal;

  const addMaterialGroup = () => {
    setMaterialGroups((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        spec: '',
        estimated_quantity: '',
        unit: '',
        scrap_factor_percent: '',
        notes: '',
      },
    ]);
  };

  const updateMaterialGroup = (id: string, patch: Partial<MaterialGroupDraft>) => {
    setMaterialGroups((prev) => prev.map((group) => (group.id === id ? { ...group, ...patch } : group)));
  };

  const removeMaterialGroup = (id: string) => {
    setMaterialGroups((prev) => prev.filter((group) => group.id !== id));
  };

  const addOperation = () => {
    setOperations((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        operation_type: '',
        estimated_hours: '',
        skill_type: '',
        machine_type: '',
      },
    ]);
  };

  const updateOperation = (id: string, patch: Partial<OperationDraft>) => {
    setOperations((prev) => prev.map((operation) => (operation.id === id ? { ...operation, ...patch } : operation)));
  };

  const removeOperation = (id: string) => {
    setOperations((prev) => prev.filter((operation) => operation.id !== id));
  };

  const handleSaveDraft = async () => {
    if (!templateId) return;
    setError(null);
    const payload = {
      name: identity.name.trim(),
      description: identity.description.trim() || null,
      is_active: identity.is_active,
      material_groups: materialGroups.map((group) => ({
        id: group.id,
        name: group.name.trim(),
        spec: group.spec.trim(),
        estimated_quantity: toNumberOrNull(group.estimated_quantity),
        unit: group.unit.trim() || null,
        scrap_factor_percent: toNumberOrNull(group.scrap_factor_percent),
        notes: group.notes.trim() || null,
      })),
      fabrication_operations: operations.map((operation) => ({
        id: operation.id,
        operation_type: operation.operation_type,
        estimated_hours: toNumberOrNull(operation.estimated_hours) ?? 0,
        skill_type: operation.skill_type,
        machine_type: operation.machine_type || null,
      })),
    };

    const result = await saveTemplateDraft(templateId, payload);
    if (!result.success) {
      setError(result.error ?? 'Unable to save draft.');
    }
  };

  const handleSaveVersion = async () => {
    if (!templateId) return;
    if (!canSaveVersion) return;
    setError(null);
    const result = await saveTemplateVersion(templateId);
    if (!result.success) {
      setError(result.error ?? 'Unable to save new version.');
    }
  };

  if (!template && !isFetchingTemplates && hydrated) {
    return (
      <div className="page-container">
        <PageHeader title="Template Not Found" backTo="/manufacturing/templates" />
        <p className="text-sm text-muted-foreground">This manufacturing template could not be found.</p>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title={template?.name ? `Edit Template: ${template.name}` : 'Edit Manufacturing Template'}
        backTo="/manufacturing/templates"
      />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="form-section space-y-4">
        <h2 className="text-lg font-semibold">Template Identity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Name *</Label>
            <Input
              id="template-name"
              value={identity.name}
              onChange={(event) => setIdentity((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Template name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={identity.description}
              onChange={(event) => setIdentity((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={identity.is_active}
              onCheckedChange={(checked) => setIdentity((prev) => ({ ...prev, is_active: checked }))}
            />
            <Label>Active</Label>
          </div>
        </div>
      </div>

      <div className="form-section space-y-4">
        <h2 className="text-lg font-semibold">Material Groups</h2>
        {materialGroups.length === 0 ? (
          <div className="text-sm text-muted-foreground">No material groups added yet.</div>
        ) : (
          <div className="space-y-4">
            {materialGroups.map((group, index) => (
              <div key={group.id} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Group {index + 1}</div>
                  <Button variant="outline" size="sm" onClick={() => removeMaterialGroup(group.id)} disabled={isSaving}>
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`group-name-${group.id}`}>Name *</Label>
                    <Input
                      id={`group-name-${group.id}`}
                      value={group.name}
                      onChange={(event) => updateMaterialGroup(group.id, { name: event.target.value })}
                      placeholder="Material group name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`group-spec-${group.id}`}>Spec *</Label>
                    <Input
                      id={`group-spec-${group.id}`}
                      value={group.spec}
                      onChange={(event) => updateMaterialGroup(group.id, { spec: event.target.value })}
                      placeholder="Spec"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`group-qty-${group.id}`}>Estimated Quantity</Label>
                    <Input
                      id={`group-qty-${group.id}`}
                      type="number"
                      min="0"
                      value={group.estimated_quantity}
                      onChange={(event) => updateMaterialGroup(group.id, { estimated_quantity: event.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`group-unit-${group.id}`}>Unit</Label>
                    <Input
                      id={`group-unit-${group.id}`}
                      value={group.unit}
                      onChange={(event) => updateMaterialGroup(group.id, { unit: event.target.value })}
                      placeholder="ea, ft, lb"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`group-scrap-${group.id}`}>Scrap Factor %</Label>
                    <Input
                      id={`group-scrap-${group.id}`}
                      type="number"
                      min="0"
                      value={group.scrap_factor_percent}
                      onChange={(event) => updateMaterialGroup(group.id, { scrap_factor_percent: event.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`group-notes-${group.id}`}>Notes</Label>
                    <Textarea
                      id={`group-notes-${group.id}`}
                      value={group.notes}
                      onChange={(event) => updateMaterialGroup(group.id, { notes: event.target.value })}
                      placeholder="Optional notes"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={addMaterialGroup} disabled={isSaving}>
          Add Material Group
        </Button>
      </div>

      <div className="form-section space-y-4">
        <h2 className="text-lg font-semibold">Fabrication Operations</h2>
        {operations.length === 0 ? (
          <div className="text-sm text-muted-foreground">No operations added yet.</div>
        ) : (
          <div className="space-y-4">
            {operations.map((operation, index) => (
              <div key={operation.id} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Operation {index + 1}</div>
                  <Button variant="outline" size="sm" onClick={() => removeOperation(operation.id)} disabled={isSaving}>
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Operation Type *</Label>
                    <Select
                      value={operation.operation_type}
                      onValueChange={(value) => updateOperation(operation.id, { operation_type: value as OperationDraft['operation_type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select operation" />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATION_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`operation-hours-${operation.id}`}>Estimated Hours *</Label>
                    <Input
                      id={`operation-hours-${operation.id}`}
                      type="number"
                      min="0"
                      value={operation.estimated_hours}
                      onChange={(event) => updateOperation(operation.id, { estimated_hours: event.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Skill Type *</Label>
                    <Select
                      value={operation.skill_type}
                      onValueChange={(value) => updateOperation(operation.id, { skill_type: value as OperationDraft['skill_type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select skill" />
                      </SelectTrigger>
                      <SelectContent>
                        {SKILL_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Machine Type</Label>
                    <Select
                      value={operation.machine_type}
                      onValueChange={(value) => updateOperation(operation.id, { machine_type: value as OperationDraft['machine_type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        {MACHINE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={addOperation} disabled={isSaving}>
          Add Operation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Material Subtotal</Label>
              <Input readOnly value={formatNumber(materialSubtotal)} />
            </div>
            <div className="space-y-2">
              <Label>Operations Subtotal</Label>
              <Input readOnly value={formatNumber(operationsSubtotal)} />
            </div>
            <div className="space-y-2">
              <Label>Total</Label>
              <Input readOnly value={formatNumber(totalEstimate)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSaveDraft} disabled={isSaving || !templateId}>
          {isSavingDraft ? 'Saving...' : 'Save Draft'}
        </Button>
        <Button onClick={handleSaveVersion} disabled={!canSaveVersion || !templateId}>
          {isSavingVersion ? 'Saving...' : 'Save New Version'}
        </Button>
        <Button variant="outline" onClick={() => navigate('/manufacturing/templates')} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
