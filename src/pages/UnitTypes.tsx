import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit } from 'lucide-react';
import { QuickAddDialog } from '@/components/ui/quick-add-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRepos } from '@/repos';
import type { UnitType } from '@/integrations/supabase/units';
import { useShopStore } from '@/stores/shopStore';

export default function UnitTypes() {
  const repos = useRepos();
  const { toast } = useToast();
  const {
    listUnitTypes,
    createUnitType,
    updateUnitType,
    setUnitTypeActive,
    ensureUnitTypesSeeded,
  } = repos.units;
  const resetUnitsForTenant = useShopStore((state) => state.resetUnitsForTenant);
  const tenantSettingsId = useShopStore((state) => state.settings.id);
  const lastTenantSettingsIdRef = useRef<string | undefined>(undefined);

  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editName, setEditName] = useState('');
  const [editingType, setEditingType] = useState<UnitType | null>(null);

  const loadUnitTypes = useCallback(async () => {
    await ensureUnitTypesSeeded();
    const list = await listUnitTypes({ includeInactive: true });
    setUnitTypes(list);
  }, [ensureUnitTypesSeeded, listUnitTypes]);

  useEffect(() => {
    void loadUnitTypes();
  }, [loadUnitTypes]);

  useEffect(() => {
    const prev = lastTenantSettingsIdRef.current;
    const next = tenantSettingsId;
    if (prev && next && prev !== next) {
      // Tenant switch invalidates unit caches to prevent cross-tenant leakage.
      resetUnitsForTenant();
      setUnitTypes([]);
      void loadUnitTypes();
    }
    lastTenantSettingsIdRef.current = next;
  }, [loadUnitTypes, resetUnitsForTenant, tenantSettingsId]);

  const unitTypesForTenant = useMemo(() => unitTypes, [unitTypes]);

  const isDuplicateUnitTypeName = (name: string, excludeId?: string) =>
    unitTypesForTenant.some(
      (type) =>
        type.id !== excludeId && type.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const handleCreate = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast({
        title: 'Validation Error',
        description: 'Unit type name is required',
        variant: 'destructive',
      });
      return;
    }
    if (isDuplicateUnitTypeName(trimmedName)) {
      toast({
        title: 'Duplicate Unit Type',
        description: 'A unit type with this name already exists',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createUnitType(trimmedName);
      await loadUnitTypes();
      toast({
        title: 'Unit Type Created',
        description: `${trimmedName} has been added`,
      });
      setNewName('');
      setCreateOpen(false);
    } catch (error: any) {
      toast({
        title: 'Unable to add unit type',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleEditOpen = (unitType: UnitType) => {
    setEditingType(unitType);
    setEditName(unitType.name);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingType) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast({
        title: 'Validation Error',
        description: 'Unit type name is required',
        variant: 'destructive',
      });
      return;
    }
    if (isDuplicateUnitTypeName(trimmedName, editingType.id)) {
      toast({
        title: 'Duplicate Unit Type',
        description: 'A unit type with this name already exists',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateUnitType(editingType.id, trimmedName);
      await loadUnitTypes();
      toast({
        title: 'Unit Type Updated',
        description: `${trimmedName} has been updated`,
      });
      setEditOpen(false);
      setEditingType(null);
    } catch (error: any) {
      toast({
        title: 'Unable to update unit type',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (unitType: UnitType) => {
    try {
      await setUnitTypeActive(unitType.id, unitType.is_active === false);
      await loadUnitTypes();
    } catch (error: any) {
      toast({
        title: 'Unable to update unit type',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const columns: Column<UnitType>[] = [
    { key: 'name', header: 'Unit Type', sortable: true },
    {
      key: 'is_active',
      header: 'Status',
      render: (item) =>
        item.is_active === false ? (
          <Badge variant="destructive">Inactive</Badge>
        ) : (
          <Badge variant="secondary">Active</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-40 text-right',
      render: (item) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => handleEditOpen(item)}>
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant={item.is_active === false ? 'outline' : 'destructive'}
            onClick={() => handleToggleActive(item)}
          >
            {item.is_active === false ? 'Reactivate' : 'Deactivate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title="Unit Types"
        subtitle="Manage unit types for your units (Truck, Trailer, Tractor, etc.)"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Unit Type
          </Button>
        }
      />

      <DataTable
        data={unitTypesForTenant}
        columns={columns}
        searchKeys={['name']}
        searchPlaceholder="Search unit types..."
        showActiveFilter={false}
        emptyMessage="No unit types found. Add your first unit type to get started."
      />

      <QuickAddDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Unit Type"
        onSave={handleCreate}
        onCancel={() => setCreateOpen(false)}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="unit_type_name">Unit Type Name *</Label>
            <Input
              id="unit_type_name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Truck"
            />
          </div>
        </div>
      </QuickAddDialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Unit Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="edit_unit_type_name">Unit Type Name *</Label>
              <Input
                id="edit_unit_type_name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g., Truck"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
