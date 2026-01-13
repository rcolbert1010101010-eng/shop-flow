import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRepos } from '@/repos';
import { useToast } from '@/hooks/use-toast';
import { Save, X, Trash2, Edit, Plus, Copy } from 'lucide-react';
import { QuickAddDialog } from '@/components/ui/quick-add-dialog';
import { calcPartPriceForLevel, getPartCostBasis } from '@/domain/pricing/partPricing';
import type { Part } from '@/types';
import { useShopStore } from '@/stores/shopStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileActionBar, MobileActionBarSpacer } from '@/components/common/MobileActionBar';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};
const formatNumber = (value: number | string | null | undefined, digits = 2) => toNumber(value).toFixed(digits);

export default function PartForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const repos = useRepos();
  const {
    parts,
    addPart,
    updatePart,
    updatePartWithQohAdjustment,
    deactivatePart,
    reactivatePart,
  } = repos.parts;
  const {
    kitComponents,
    addKitComponent,
    updateKitComponentQuantity,
    removeKitComponent,
  } = repos.kitComponents;
  const { vendors } = repos.vendors;
  const { categories } = repos.categories;
  const { addVendor } = repos.vendors;
  const { addCategory } = repos.categories;
  const { vendorCostHistory } = repos.vendorCostHistory;
  const { purchaseOrders, purchaseOrderLines } = repos.purchaseOrders;
  const { settings } = repos.settings;
  const { toast } = useToast();
  const sessionUserName = (settings.session_user_name || 'system').trim() || 'system';
  const isMobile = useIsMobile();

  const isNew = id === 'new';
  const part = !isNew ? parts.find((p) => p.id === id) : null;
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  const [editing, setEditing] = useState(isNew);
  const [formData, setFormData] = useState({
    part_number: part?.part_number || '',
    description: part?.description || '',
    vendor_id: part?.vendor_id || '',
    category_id: part?.category_id || '',
    cost: part?.cost?.toString() || '',
    selling_price: part?.selling_price?.toString() || '',
    core_required: part?.core_required || false,
    core_charge: part?.core_charge?.toString() || '0',
    barcode: part?.barcode || '',
    is_kit: part?.is_kit ?? false,
    min_qty: part?.min_qty?.toString() || '',
    max_qty: part?.max_qty?.toString() || '',
    bin_location: part?.bin_location ?? '',
    model: part?.model ?? '',
    serial_number: part?.serial_number ?? '',
    uom: (part?.uom ?? 'EA') as 'EA' | 'FT' | 'SQFT',
    initial_qoh: '',
    material_kind: (part?.material_kind ?? 'STANDARD') as 'STANDARD' | 'SHEET',
    sheet_width_in: part?.sheet_width_in?.toString() || '',
    sheet_length_in: part?.sheet_length_in?.toString() || '',
    thickness_in: part?.thickness_in?.toString() || '',
    grade: part?.grade || '',
  });

  // Quick add dialogs
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [newQoh, setNewQoh] = useState('');
  const [newComponentId, setNewComponentId] = useState('');
  const [newComponentQty, setNewComponentQty] = useState('1');
  const [copying, setCopying] = useState(false);

  const activeVendors = vendors.filter((v) => v.is_active);
  const activeCategories = categories.filter((c) => c.is_active);
  const partCostHistory = vendorCostHistory
    .filter((h) => h.part_id === id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15);
  const suggestedReorder =
    part?.max_qty != null && Number.isFinite(part.max_qty) && part.max_qty > 0
      ? Math.max(0, part.max_qty - (part.quantity_on_hand ?? 0))
      : null;

  const tempPartForPricing: Part = part || {
    id: 'temp',
    part_number: formData.part_number,
    description: formData.description || null,
    vendor_id: formData.vendor_id,
    category_id: formData.category_id,
    cost: parseFloat(formData.cost) || 0,
    selling_price: parseFloat(formData.selling_price) || 0,
    quantity_on_hand: 0,
    core_required: part?.core_required ?? false,
    core_charge: parseFloat(formData.core_charge) || 0,
    min_qty: formData.min_qty === '' ? null : (Number.isFinite(parseInt(formData.min_qty)) ? parseInt(formData.min_qty) : null),
    max_qty: formData.max_qty === '' ? null : (Number.isFinite(parseInt(formData.max_qty)) ? parseInt(formData.max_qty) : null),
    bin_location: formData.bin_location.trim() || null,
    location: part?.location ?? null,
    uom: formData.uom,
    allow_fractional_qty: formData.uom === 'FT' || formData.uom === 'SQFT',
    qty_precision: formData.uom === 'EA' ? 0 : 2,
    last_cost: part?.last_cost ?? null,
    avg_cost: part?.avg_cost ?? null,
    model: part?.model ?? null,
    serial_number: part?.serial_number ?? null,
    barcode: part?.barcode ?? (formData.barcode.trim() ? formData.barcode.trim() : null),
    is_kit: part?.is_kit ?? formData.is_kit ?? false,
    is_active: true,
    created_at: '',
    updated_at: '',
  };

  const costBasis = getPartCostBasis(tempPartForPricing);
  const suggestedRetail = calcPartPriceForLevel(tempPartForPricing, settings, 'RETAIL');
  const suggestedFleet = calcPartPriceForLevel(tempPartForPricing, settings, 'FLEET');
  const suggestedWholesale = calcPartPriceForLevel(tempPartForPricing, settings, 'WHOLESALE');
  const poLinesForPart = part
    ? purchaseOrderLines
        .map((line) => {
          const po = purchaseOrders.find((p) => p.id === line.purchase_order_id);
          return { line, po };
        })
        .filter(({ line, po }) => po && po.status === 'OPEN' && line.part_id === part.id)
    : [];
  const poLinesWithOutstanding = poLinesForPart
    .map(({ line, po }) => {
      const outstanding = (line.ordered_quantity ?? 0) - (line.received_quantity ?? 0);
      return { line, po: po!, outstanding: Math.max(0, outstanding) };
    })
    .filter((entry) => entry.outstanding > 0);
  const totalOnOrder = poLinesWithOutstanding.reduce((sum, entry) => sum + entry.outstanding, 0);
  const poLinesSorted = poLinesWithOutstanding.sort(
    (a, b) => new Date(b.po.created_at).getTime() - new Date(a.po.created_at).getTime()
  );
  const kitComponentsForPart = part
    ? kitComponents.filter((component) => component.kit_part_id === part.id && component.is_active)
    : [];
  const availableComponentParts = parts.filter(
    (p) => p.is_active && p.id !== part?.id && !p.is_kit
  );
  const inventoryMovements = useShopStore((state) => state.inventoryMovements);
  const recentMovements = useMemo(() => {
    if (!id || id === 'new') return [];
    return inventoryMovements
      .filter((m) => m.part_id === id)
      .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())
      .slice(0, 20);
  }, [inventoryMovements, id]);

  if (!isNew && !part) {
    return (
      <div className="page-container">
        <PageHeader title="Part Not Found" backTo="/inventory" />
        <p className="text-muted-foreground">This part does not exist.</p>
      </div>
    );
  }

  const renderStatusChips = () => {
    if (!part) return null;
    const chips: React.ReactNode[] = [];
    chips.push(
      <span
        key="active"
        className={`rounded-md px-2 py-1 ${part.is_active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}
      >
        {part.is_active ? 'Active' : 'Inactive'}
      </span>
    );
    if (part.quantity_on_hand < 0) {
      chips.push(
        <span key="negative" className="rounded-md bg-destructive/10 text-destructive px-2 py-1">
          Negative
        </span>
      );
    } else if (part.quantity_on_hand === 0) {
      chips.push(
        <span key="out" className="rounded-md bg-muted px-2 py-1">
          Out
        </span>
      );
    }
    if (part.min_qty != null && part.quantity_on_hand > 0 && part.quantity_on_hand < part.min_qty) {
      chips.push(
        <span key="low" className="rounded-md bg-muted px-2 py-1">
          Low
        </span>
      );
    }
    if (suggestedReorder && suggestedReorder > 0) {
      chips.push(
        <span key="reorder" className="rounded-md bg-muted px-2 py-1">
          Needs Reorder
        </span>
      );
    }
    return <div className="flex flex-wrap gap-2 text-xs">{chips}</div>;
  };

  const resetForm = () => {
    setFormData({
      part_number: part?.part_number || '',
      description: part?.description || '',
      vendor_id: part?.vendor_id || '',
      category_id: part?.category_id || '',
      cost: part?.cost?.toString() || '',
      selling_price: part?.selling_price?.toString() || '',
      core_required: part?.core_required || false,
      core_charge: part?.core_charge?.toString() || '0',
      barcode: part?.barcode || '',
      is_kit: part?.is_kit ?? false,
      min_qty: part?.min_qty?.toString() || '',
      max_qty: part?.max_qty?.toString() || '',
      bin_location: part?.bin_location ?? '',
      model: part?.model ?? '',
      serial_number: part?.serial_number ?? '',
      uom: (part?.uom ?? 'EA') as 'EA' | 'FT' | 'SQFT',
      initial_qoh: '',
      material_kind: (part?.material_kind ?? 'STANDARD') as 'STANDARD' | 'SHEET',
      sheet_width_in: part?.sheet_width_in?.toString() || '',
      sheet_length_in: part?.sheet_length_in?.toString() || '',
      thickness_in: part?.thickness_in?.toString() || '',
      grade: part?.grade || '',
    });
  };

  const recentActivity = recentMovements.slice(0, 10);

  const resolveActivityLink = (movement: typeof recentMovements[number]) => {
    if (movement.ref_type === 'CYCLE_COUNT') {
      return movement.ref_id ? `/cycle-counts/${movement.ref_id}` : '/cycle-counts';
    }
    if (movement.movement_type === 'COUNT' || movement.reason?.startsWith('COUNT:')) {
      return movement.ref_id ? `/cycle-counts/${movement.ref_id}` : '/cycle-counts';
    }
    if (movement.movement_type === 'RECEIVE' || movement.ref_type === 'PURCHASE_ORDER') {
      return part?.part_number
        ? `/receiving?search=${encodeURIComponent(part.part_number)}`
        : '/receiving';
    }
    if (movement.ref_type && movement.ref_id) {
      // Fallback to inventory search when we cannot map confidently
      return part?.part_number
        ? `/inventory?search=${encodeURIComponent(part.part_number)}`
        : '/inventory';
    }
    return part?.part_number
      ? `/inventory?search=${encodeURIComponent(part.part_number)}`
      : '/inventory';
  };

  useEffect(() => {
    if (editing || isNew || !part) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      const key = e.key.toLowerCase();
      if (key === 'e') {
        e.preventDefault();
        setEditing(true);
        return;
      }
      if (key === 'r') {
        e.preventDefault();
        navigate(`/receiving?search=${encodeURIComponent(part.part_number)}`);
        return;
      }
      if (key === 'a') {
        e.preventDefault();
        setNewQoh(part.quantity_on_hand?.toString() || '');
        setAdjustReason('');
        setAdjustDialogOpen(true);
        return;
      }
      if (key === 'c') {
        e.preventDefault();
        (async () => {
          try {
            setCopying(true);
            await navigator.clipboard.writeText(part.part_number);
            toast({ title: 'Copied', description: 'Part number copied to clipboard' });
          } catch {
            toast({ title: 'Copy failed', variant: 'destructive' });
          } finally {
            setCopying(false);
          }
        })();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, isNew, navigate, part, toast]);

  const handleSave = () => {
    if (!formData.part_number.trim()) {
      toast({ title: 'Validation Error', description: 'Part number is required', variant: 'destructive' });
      return;
    }
    if (!formData.vendor_id) {
      toast({ title: 'Validation Error', description: 'Vendor is required', variant: 'destructive' });
      return;
    }
    if (!formData.category_id) {
      toast({ title: 'Validation Error', description: 'Category is required', variant: 'destructive' });
      return;
    }

    // Check for duplicate part number
    const exists = parts.some(
      (p) => p.id !== id && p.part_number.toLowerCase() === formData.part_number.toLowerCase()
    );
    if (exists) {
      toast({ title: 'Validation Error', description: 'A part with this number already exists', variant: 'destructive' });
      return;
    }

    // Validate initial QOH if provided
    let initialQohRounded: number | null = null;
    if (isNew && formData.initial_qoh.trim()) {
      const parsed = parseFloat(formData.initial_qoh);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast({ title: 'Validation Error', description: 'Initial QOH must be >= 0', variant: 'destructive' });
        return;
      }
      if (formData.uom === 'EA' && !Number.isInteger(parsed)) {
        toast({ title: 'Validation Error', description: 'EA quantities must be whole numbers', variant: 'destructive' });
        return;
      }
      if (formData.uom === 'FT' || formData.uom === 'SQFT') {
        const precision = 2;
        const multiplier = Math.pow(10, precision);
        initialQohRounded = Math.round(parsed * multiplier) / multiplier;
      } else {
        initialQohRounded = parsed;
      }
    }

    // Validate sheet fields when material_kind = SHEET and uom = SQFT
    if (formData.material_kind === 'SHEET' && formData.uom === 'SQFT') {
      const width = parseFloat(formData.sheet_width_in);
      const length = parseFloat(formData.sheet_length_in);
      if (!Number.isFinite(width) || width <= 0) {
        toast({ title: 'Validation Error', description: 'Standard Sheet Width must be > 0', variant: 'destructive' });
        return;
      }
      if (!Number.isFinite(length) || length <= 0) {
        toast({ title: 'Validation Error', description: 'Standard Sheet Length must be > 0', variant: 'destructive' });
        return;
      }
      if (formData.thickness_in.trim()) {
        const thickness = parseFloat(formData.thickness_in);
        if (!Number.isFinite(thickness) || thickness <= 0) {
          toast({ title: 'Validation Error', description: 'Thickness must be > 0 if provided', variant: 'destructive' });
          return;
        }
      }
    }

    const uom = formData.uom;
    const allow_fractional_qty = uom === 'FT' || uom === 'SQFT';
    const qty_precision = uom === 'EA' ? 0 : 2;

    const partData = {
      part_number: formData.part_number.trim().toUpperCase(),
      description: formData.description.trim() || null,
      vendor_id: formData.vendor_id,
      category_id: formData.category_id,
      cost: parseFloat(formData.cost) || 0,
      selling_price: parseFloat(formData.selling_price) || 0,
      quantity_on_hand: part?.quantity_on_hand ?? 0,
      core_required: formData.core_required,
      core_charge: parseFloat(formData.core_charge) || 0,
      barcode: formData.barcode.trim() ? formData.barcode.trim() : null,
      is_kit: formData.is_kit,
      min_qty: formData.min_qty === '' ? null : (Number.isFinite(parseInt(formData.min_qty)) ? parseInt(formData.min_qty) : null),
      max_qty: formData.max_qty === '' ? null : (Number.isFinite(parseInt(formData.max_qty)) ? parseInt(formData.max_qty) : null),
      bin_location: formData.bin_location.trim() || null,
      model: formData.model.trim() || null,
      serial_number: formData.serial_number.trim() || null,
      uom,
      allow_fractional_qty,
      qty_precision,
      material_kind: formData.material_kind,
      sheet_width_in: formData.material_kind === 'SHEET' && formData.sheet_width_in.trim() ? parseFloat(formData.sheet_width_in) : null,
      sheet_length_in: formData.material_kind === 'SHEET' && formData.sheet_length_in.trim() ? parseFloat(formData.sheet_length_in) : null,
      thickness_in: formData.material_kind === 'SHEET' && formData.thickness_in.trim() ? parseFloat(formData.thickness_in) : null,
      grade: formData.material_kind === 'SHEET' && formData.grade.trim() ? formData.grade.trim() : null,
    };

    if (isNew) {
      const newPart = addPart(partData);
      if (initialQohRounded != null && initialQohRounded > 0) {
        const result = updatePartWithQohAdjustment(newPart.id, { quantity_on_hand: initialQohRounded }, {
          reason: 'Initial Stock',
          adjusted_by: sessionUserName,
        });
        if (result?.error) {
          toast({ title: 'Part Created', description: `${formData.part_number} has been added, but initial QOH adjustment failed: ${result.error}`, variant: 'destructive' });
        } else {
          toast({ title: 'Part Created', description: `${formData.part_number} has been added with initial QOH of ${initialQohRounded}` });
        }
      } else {
        toast({ title: 'Part Created', description: `${formData.part_number} has been added` });
      }
      navigate(`/inventory/${newPart.id}`);
    } else {
      updatePart(id!, partData);
      toast({ title: 'Part Updated', description: 'Changes have been saved' });
      setEditing(false);
    }
  };

  const handleDeactivate = () => {
    deactivatePart(id!);
    toast({ title: 'Part Deactivated', description: 'Part has been deactivated' });
    setEditing(false);
  };

  const handleReactivate = async () => {
    try {
      if (reactivatePart) {
        await reactivatePart(id!);
      } else {
        updatePart(id!, { is_active: true });
      }
      toast({ title: 'Part Reactivated', description: 'Part has been reactivated' });
    } catch (error) {
      toast({
        title: 'Server unavailable — reactivation saved locally',
        description: 'The server could not be reached. State has been updated locally.',
        variant: 'destructive',
      });
    } finally {
      setEditing(false);
    }
  };

  const handleQuickAddVendor = () => {
    if (!newVendorName.trim()) return;
    const newVendor = addVendor({
      vendor_name: newVendorName.trim(),
      phone: null,
      email: null,
      notes: null,
    });
    setFormData({ ...formData, vendor_id: newVendor.id });
    setVendorDialogOpen(false);
    setNewVendorName('');
    toast({ title: 'Vendor Added', description: `${newVendor.vendor_name} has been created` });
  };

  const handleQuickAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCategory = addCategory({
      category_name: newCategoryName.trim(),
      description: null,
    });
    setFormData({ ...formData, category_id: newCategory.id });
    setCategoryDialogOpen(false);
    setNewCategoryName('');
    toast({ title: 'Category Added', description: `${newCategory.category_name} has been created` });
  };

  const handleAddKitComponent = () => {
    if (!editing) return;
    if (!formData.is_kit) return;
    if (!part) {
      toast({ title: 'Save Part First', description: 'Save the part before adding kit components', variant: 'destructive' });
      return;
    }
    if (!newComponentId) {
      toast({ title: 'Validation Error', description: 'Select a component part to add', variant: 'destructive' });
      return;
    }
    const quantity = parseFloat(newComponentQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: 'Validation Error', description: 'Quantity must be greater than 0', variant: 'destructive' });
      return;
    }

    const existing = kitComponents.find(
      (component) =>
        component.kit_part_id === part.id &&
        component.component_part_id === newComponentId &&
        component.is_active
    );

    if (existing) {
      updateKitComponentQuantity(existing.id, quantity);
      toast({ title: 'Component Updated', description: 'Quantity has been updated' });
    } else {
      addKitComponent({
        kit_part_id: part.id,
        component_part_id: newComponentId,
        quantity,
      });
      toast({ title: 'Component Added', description: 'Component added to kit' });
    }

    setNewComponentId('');
    setNewComponentQty('1');
  };

  const handleUpdateKitComponentQty = (componentId: string, value: string) => {
    if (!editing) return;
    const quantity = parseFloat(value);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    updateKitComponentQuantity(componentId, quantity);
  };

  const handleRemoveKitComponent = (componentId: string) => {
    if (!editing) return;
    removeKitComponent(componentId);
    toast({ title: 'Component Removed', description: 'Component removed from kit' });
  };

  const handleConfirmAdjustment = () => {
    if (!part) return;
    if (!adjustReason.trim()) {
      toast({ title: 'Validation Error', description: 'Reason is required', variant: 'destructive' });
      return;
    }
    const parsedQoh = parseFloat(newQoh);
    if (!Number.isFinite(parsedQoh)) {
      toast({ title: 'Validation Error', description: 'Enter a valid quantity', variant: 'destructive' });
      return;
    }
    const partData = {
      part_number: part.part_number.trim().toUpperCase(),
      description: part.description?.trim() || null,
      vendor_id: part.vendor_id,
      category_id: part.category_id,
      cost: part.cost || 0,
      selling_price: part.selling_price || 0,
      quantity_on_hand: parsedQoh,
      core_required: part.core_required,
      core_charge: part.core_charge || 0,
      barcode: part.barcode?.trim() ? part.barcode.trim() : null,
      is_kit: part.is_kit,
      min_qty: part.min_qty ?? null,
      max_qty: part.max_qty ?? null,
      bin_location: part.bin_location?.trim() || null,
    };
    const result = updatePartWithQohAdjustment(id!, partData, {
      reason: adjustReason.trim(),
      adjusted_by: '',
    });
    if (result?.error) {
      toast({ title: 'Adjustment blocked', description: result.error, variant: 'destructive' });
      return;
    }
    if (result?.warning) {
      toast({ title: 'Inventory adjusted', description: result.warning, variant: 'default' });
    } else {
      toast({ title: 'Part Updated', description: 'Changes have been saved' });
    }
    setAdjustDialogOpen(false);
    setAdjustReason('');
    setNewQoh('');
    setEditing(false);
  };

  return (
    <div className="page-container space-y-4">
      <PageHeader
        title={isNew ? 'New Part' : part?.part_number || 'Part'}
        subtitle={
          isNew ? 'Add a new part to inventory' : part?.description || (part?.is_active ? 'Active Part' : 'Inactive Part')
        }
        backTo="/inventory"
        actions={
          editing ? (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    part?.part_number
                      ? `/receiving?search=${encodeURIComponent(part.part_number)}`
                      : '/receiving'
                  )
                }
              >
                Receive
              </Button>
              {!isNew && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewQoh(part?.quantity_on_hand?.toString() || '');
                    setAdjustDialogOpen(true);
                  }}
                >
                  Adjust QOH
                </Button>
              )}
              {!isNew && (
                part?.is_active ? (
                  <AlertDialog open={confirmDeactivateOpen} onOpenChange={setConfirmDeactivateOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Deactivate
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate part?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will hide the part from active lists but keep history and movements. You can reactivate it later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setConfirmDeactivateOpen(false);
                              handleDeactivate();
                            }}
                          >
                            Deactivate
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button variant="outline" onClick={handleReactivate}>
                    Reactivate
                  </Button>
                )
              )}
              {!isNew && (
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setEditing(false);
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                {isNew ? 'Create Part' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    part?.part_number
                      ? `/receiving?search=${encodeURIComponent(part.part_number)}`
                      : '/receiving'
                  )
                }
              >
                Receive
              </Button>
              {!isNew && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewQoh(part?.quantity_on_hand?.toString() || '');
                    setAdjustDialogOpen(true);
                  }}
                >
                  Adjust QOH
                </Button>
              )}
              {!isNew &&
                (part?.is_active ? (
                  <AlertDialog open={confirmDeactivateOpen} onOpenChange={setConfirmDeactivateOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Deactivate
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate part?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will hide the part from active lists but keep history and movements. You can reactivate it later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setConfirmDeactivateOpen(false);
                              handleDeactivate();
                            }}
                          >
                            Deactivate
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button variant="outline" onClick={handleReactivate}>
                    Reactivate
                  </Button>
                ))}
              <Button onClick={() => setEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              {!isNew && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="inline-flex" title="Keyboard shortcuts">
                      ?
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-48 text-sm">
                    <div className="space-y-1">
                      <div className="flex justify-between"><span>E</span><span>Edit</span></div>
                      <div className="flex justify-between"><span>R</span><span>Receive</span></div>
                      <div className="flex justify-between"><span>A</span><span>Adjust QOH</span></div>
                      <div className="flex justify-between"><span>C</span><span>Copy Part #</span></div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-muted-foreground">Part</div>
                <div className="text-xl font-semibold leading-tight">
                  {formData.part_number || part?.part_number || 'Untitled Part'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formData.description || part?.description || 'No description'}
                </div>
              </div>
              {!isNew && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={copying}
                  onClick={async () => {
                    try {
                      setCopying(true);
                      await navigator.clipboard.writeText(part?.part_number || '');
                      toast({ title: 'Copied', description: 'Part number copied to clipboard' });
                    } catch {
                      toast({ title: 'Copy failed', variant: 'destructive' });
                    } finally {
                      setCopying(false);
                    }
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copying ? 'Copying…' : 'Copy Part #'}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="part_number">Part Number *</Label>
                <Input
                  id="part_number"
                  value={formData.part_number}
                  onChange={(e) => setFormData({ ...formData, part_number: e.target.value.toUpperCase() })}
                  disabled={!editing}
                  placeholder="e.g., BRK-001"
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  disabled={!editing}
                  placeholder="Scan or enter barcode"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={!editing}
                  rows={2}
                  placeholder="Part description"
                />
              </div>
              <div>
                <Label htmlFor="vendor">Vendor *</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.vendor_id}
                    onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
                    disabled={!editing}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeVendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.vendor_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editing && (
                    <Button type="button" variant="outline" size="icon" onClick={() => setVendorDialogOpen(true)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="category">Category *</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    disabled={!editing}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editing && (
                    <Button type="button" variant="outline" size="icon" onClick={() => setCategoryDialogOpen(true)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="bin_location">Bin / Location</Label>
                <Input
                  id="bin_location"
                  value={formData.bin_location}
                  onChange={(e) => setFormData({ ...formData, bin_location: e.target.value })}
                  disabled={!editing}
                  placeholder="e.g., Aisle 3 - Bin 12"
                />
              </div>
              <div>
                <Label htmlFor="material_kind">Material Type</Label>
                <Select
                  value={formData.material_kind}
                  onValueChange={(value: 'STANDARD' | 'SHEET') => {
                    const newUom = value === 'SHEET' ? 'SQFT' : formData.uom === 'SQFT' ? 'EA' : formData.uom;
                    setFormData({ ...formData, material_kind: value, uom: newUom as 'EA' | 'FT' | 'SQFT' });
                  }}
                  disabled={!editing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">STANDARD</SelectItem>
                    <SelectItem value="SHEET">SHEET MATERIAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="uom">Unit of Measure</Label>
                <Select
                  value={formData.uom}
                  onValueChange={(value: 'EA' | 'FT' | 'SQFT') => setFormData({ ...formData, uom: value })}
                  disabled={!editing || formData.material_kind === 'SHEET'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EA">EA (Each)</SelectItem>
                    <SelectItem value="FT">FT (Feet)</SelectItem>
                    <SelectItem value="SQFT">SQFT (Square Feet)</SelectItem>
                  </SelectContent>
                </Select>
                {formData.uom === 'SQFT' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Track QOH by area. Receiving can convert sheets to SQFT.
                  </p>
                )}
              </div>
              {formData.material_kind === 'SHEET' && formData.uom === 'SQFT' && (
                <>
                  <div>
                    <Label htmlFor="sheet_width_in">Standard Sheet Width (in) *</Label>
                    <Input
                      id="sheet_width_in"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.sheet_width_in}
                      onChange={(e) => setFormData({ ...formData, sheet_width_in: e.target.value })}
                      disabled={!editing}
                      placeholder="e.g., 48"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sheet_length_in">Standard Sheet Length (in) *</Label>
                    <Input
                      id="sheet_length_in"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.sheet_length_in}
                      onChange={(e) => setFormData({ ...formData, sheet_length_in: e.target.value })}
                      disabled={!editing}
                      placeholder="e.g., 96"
                    />
                  </div>
                  <div>
                    <Label htmlFor="thickness_in">Thickness (in)</Label>
                    <Input
                      id="thickness_in"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.thickness_in}
                      onChange={(e) => setFormData({ ...formData, thickness_in: e.target.value })}
                      disabled={!editing}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label htmlFor="grade">Grade</Label>
                    <Input
                      id="grade"
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      disabled={!editing}
                      placeholder="e.g., A36, 5052"
                    />
                  </div>
                </>
              )}
              {isNew && (
                <div>
                  <Label htmlFor="initial_qoh">Initial QOH</Label>
                  <Input
                    id="initial_qoh"
                    type="number"
                    step={formData.uom === 'FT' ? '0.01' : '1'}
                    value={formData.initial_qoh}
                    onChange={(e) => setFormData({ ...formData, initial_qoh: e.target.value })}
                    disabled={!editing}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Creates an inventory adjustment for audit history.
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  disabled={!editing}
                />
              </div>
              <div>
                <Label htmlFor="serial_number">Serial Number</Label>
                <Input
                  id="serial_number"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  disabled={!editing}
                />
              </div>
              <div>
                <Label htmlFor="min_qty">Min Qty</Label>
                <Input
                  id="min_qty"
                  type="number"
                  value={formData.min_qty}
                  onChange={(e) => setFormData({ ...formData, min_qty: e.target.value })}
                  disabled={!editing}
                />
              </div>
              <div>
                <Label htmlFor="max_qty">Max Qty</Label>
                <Input
                  id="max_qty"
                  type="number"
                  value={formData.max_qty}
                  onChange={(e) => setFormData({ ...formData, max_qty: e.target.value })}
                  disabled={!editing}
                />
              </div>
            </div>

            <div className="border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="core_required"
                  checked={formData.core_required}
                  onChange={(e) => setFormData({ ...formData, core_required: e.target.checked })}
                  disabled={!editing}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="core_required" className="font-medium">
                  Core Required
                </Label>
              </div>
              {formData.core_required && (
                <div>
                  <Label htmlFor="core_charge">Core Charge Amount</Label>
                  <Input
                    id="core_charge"
                    type="number"
                    step="0.01"
                    value={formData.core_charge}
                    onChange={(e) => setFormData({ ...formData, core_charge: e.target.value })}
                    disabled={!editing}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This amount will be added to orders and refunded when the core is returned.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cost">Cost</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  disabled={!editing}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="selling_price">Selling Price</Label>
                <Input
                  id="selling_price"
                  type="number"
                  step="0.01"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  disabled={!editing}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Last Cost</Label>
                <Input value={part?.last_cost != null ? formatNumber(part.last_cost) : '—'} disabled placeholder="N/A" />
              </div>
              <div>
                <Label>Avg Cost</Label>
                <Input value={part?.avg_cost != null ? formatNumber(part.avg_cost) : '—'} disabled placeholder="N/A" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Suggested Basis</Label>
                <Input
                  value={
                    costBasis.basis != null
                      ? `$${formatNumber(costBasis.basis)} (${costBasis.source.replace('_', ' ')})`
                      : '—'
                  }
                  disabled
                />
              </div>
              {editing && (
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (suggestedRetail != null) {
                        setFormData({ ...formData, selling_price: formatNumber(suggestedRetail) });
                      }
                    }}
                  >
                    Apply Retail Suggested
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Retail Suggested</Label>
                <Input value={suggestedRetail != null ? formatNumber(suggestedRetail) : '—'} disabled />
              </div>
              <div>
                <Label>Fleet Suggested</Label>
                <Input value={suggestedFleet != null ? formatNumber(suggestedFleet) : '—'} disabled />
              </div>
              <div>
                <Label>Wholesale Suggested</Label>
                <Input value={suggestedWholesale != null ? formatNumber(suggestedWholesale) : '—'} disabled />
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_kit"
                  checked={formData.is_kit}
                  onChange={(e) => setFormData({ ...formData, is_kit: e.target.checked })}
                  disabled={!editing}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="is_kit" className="font-medium">
                  Kit
                </Label>
              </div>
              {formData.is_kit && isNew && (
                <span className="text-xs text-muted-foreground">Save the part to manage components</span>
              )}
            </div>
            {formData.is_kit && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-2">
                    <Label htmlFor="component_part_id">Add Component</Label>
                    <Select value={newComponentId} onValueChange={setNewComponentId} disabled={!editing || isNew}>
                      <SelectTrigger id="component_part_id">
                        <SelectValue placeholder="Select part" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableComponentParts.map((componentPart) => (
                          <SelectItem key={componentPart.id} value={componentPart.id}>
                            {componentPart.part_number} — {componentPart.description || 'No description'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="component_qty">Qty</Label>
                    <Input
                      id="component_qty"
                      type="number"
                      min="1"
                      step="1"
                      value={newComponentQty}
                      onChange={(e) => setNewComponentQty(e.target.value)}
                      disabled={!editing || isNew}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={handleAddKitComponent} disabled={!editing || isNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Component
                  </Button>
                </div>
                <div className="space-y-2">
                  {kitComponentsForPart.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No components added yet.</p>
                  ) : (
                    kitComponentsForPart.map((component) => {
                      const componentPart = parts.find((p) => p.id === component.component_part_id);
                      return (
                        <div
                          key={component.id}
                          className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{componentPart?.part_number || 'Component'}</span>
                            <span className="text-xs text-muted-foreground">
                              {componentPart?.description || 'No description'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={component.quantity}
                              onChange={(e) => handleUpdateKitComponentQty(component.id, e.target.value)}
                              disabled={!editing}
                              className="w-20"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveKitComponent(component.id)}
                              disabled={!editing}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Inventory Snapshot</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground items-start">
              <div className="space-y-2">
                <div className="text-xs">QOH</div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-semibold text-foreground">
                    {(() => {
                      if (!part) return '0 EA';
                      const uom = part.uom ?? 'EA';
                      const qty = part.quantity_on_hand ?? 0;
                      const precision = part.qty_precision ?? (uom === 'EA' ? 0 : 2);
                      const formattedQty = uom === 'EA' ? qty.toString() : qty.toFixed(precision).replace(/\.?0+$/, '');
                      return `${formattedQty} ${uom}`;
                    })()}
                  </div>
                  {!isNew && renderStatusChips()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">To change QOH, use Adjust QOH.</p>
              </div>
              <div>
                <div className="text-xs">On Order</div>
                <div className="text-lg font-semibold text-foreground">{totalOnOrder}</div>
              </div>
              <div>
                <div className="text-xs">Last Cost</div>
                <div className="font-medium text-foreground">
                  {part?.last_cost != null ? `$${formatNumber(part.last_cost)}` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs">Avg Cost</div>
                <div className="font-medium text-foreground">
                  {part?.avg_cost != null ? `$${formatNumber(part.avg_cost)}` : '—'}
                </div>
              </div>
              {!isNew && suggestedReorder != null && suggestedReorder > 0 && (
                <div className="col-span-2 text-sm">
                  <div className="text-xs text-muted-foreground">Suggested Reorder</div>
                  <div className="font-medium text-foreground">{suggestedReorder}</div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Recent Activity</h3>
              <span className="text-xs text-muted-foreground">Last 10</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {recentActivity.length === 0 ? (
                <p className="text-muted-foreground">No recent activity.</p>
              ) : (
                <div className="space-y-2">
                  {recentActivity.map((m) => {
                    const delta = m.qty_delta;
                    const source =
                      m.movement_type === 'RECEIVE'
                        ? 'Receiving'
                        : m.movement_type === 'COUNT' || m.reason?.startsWith('COUNT:')
                        ? 'Cycle Count'
                        : 'Manual';
                    const link = resolveActivityLink(m);
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
                      >
                        <div className="space-y-0.5">
                          <div className="text-foreground font-medium">
                            {new Date(m.performed_at).toLocaleString()}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{source}</div>
                        </div>
                        <div className="text-right space-y-0.5">
                          <div className="font-semibold text-foreground">{delta > 0 ? `+${delta}` : delta}</div>
                          <div className="text-[11px] text-muted-foreground">{m.reason || '—'}</div>
                          <div>
                            <Button
                              variant="link"
                              size="sm"
                              className="px-0 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (link) navigate(link);
                              }}
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isNew && (
        <div className="space-y-4">
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">On Order</h3>
              <span className="text-sm font-medium">
                {totalOnOrder > 0 ? 'Yes' : 'No'} (Qty: {totalOnOrder})
              </span>
            </div>
            {poLinesSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open purchase orders for this part.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1">PO</th>
                    <th className="py-1">Vendor</th>
                    <th className="py-1 text-right">Qty On Order</th>
                    <th className="py-1">Status</th>
                    <th className="py-1">Created</th>
                    <th className="py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {poLinesSorted.slice(0, 15).map(({ line, po, outstanding }) => {
                    const vendor = vendors.find((v) => v.id === po.vendor_id);
                    return (
                      <tr key={line.id} className="border-t border-border/60">
                        <td className="py-1 font-mono">{po.po_number || po.id}</td>
                        <td className="py-1">{vendor?.vendor_name || '—'}</td>
                        <td className="py-1 text-right">{outstanding}</td>
                        <td className="py-1">{po.status}</td>
                        <td className="py-1">{new Date(po.created_at).toLocaleDateString()}</td>
                        <td className="py-1 text-right">
                          <Button variant="link" size="sm" onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Cost History</h3>
              <span className="text-xs text-muted-foreground">Last 15</span>
            </div>
            {partCostHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cost history yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1">Date</th>
                    <th className="py-1">Vendor</th>
                    <th className="py-1 text-right">Unit Cost</th>
                    <th className="py-1 text-right">Qty</th>
                    <th className="py-1">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {partCostHistory.map((entry) => {
                    const vendor = vendors.find((v) => v.id === entry.vendor_id);
                    return (
                      <tr key={entry.id} className="border-t border-border/60">
                        <td className="py-1">{new Date(entry.created_at).toLocaleDateString()}</td>
                        <td className="py-1">{vendor?.vendor_name || '—'}</td>
                        <td className="py-1 text-right">${formatNumber(entry.unit_cost)}</td>
                        <td className="py-1 text-right">{entry.quantity ?? '—'}</td>
                        <td className="py-1 uppercase text-xs text-muted-foreground">{entry.source}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent Movements</h3>
              <span className="text-xs text-muted-foreground">Last 20</span>
            </div>
            {!recentMovements || recentMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No movements yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="h-9">
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Delta</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMovements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">{new Date(m.performed_at).toLocaleString()}</TableCell>
                      <TableCell className="uppercase text-xs font-semibold">{m.movement_type}</TableCell>
                      <TableCell className={m.qty_delta < 0 ? 'text-destructive' : ''}>{m.qty_delta}</TableCell>
                      <TableCell className="max-w-xs break-words">{m.reason || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.ref_type ? `${m.ref_type}${m.ref_id ? `:${m.ref_id}` : ''}` : '—'}
                      </TableCell>
                      <TableCell>{m.performed_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      {/* Quick Add Vendor Dialog */}
      <QuickAddDialog
        open={vendorDialogOpen}
        onOpenChange={setVendorDialogOpen}
        title="Quick Add Vendor"
        onSave={handleQuickAddVendor}
        onCancel={() => setVendorDialogOpen(false)}
      >
        <div>
          <Label htmlFor="new_vendor_name">Vendor Name *</Label>
          <Input
            id="new_vendor_name"
            value={newVendorName}
            onChange={(e) => setNewVendorName(e.target.value)}
            placeholder="Enter vendor name"
          />
        </div>
      </QuickAddDialog>

      {/* Quick Add Category Dialog */}
      <QuickAddDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        title="Quick Add Category"
        onSave={handleQuickAddCategory}
        onCancel={() => setCategoryDialogOpen(false)}
      >
        <div>
          <Label htmlFor="new_category_name">Category Name *</Label>
          <Input
            id="new_category_name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Enter category name"
          />
        </div>
      </QuickAddDialog>

      {/* Inventory Adjustment Reason Dialog */}
      <QuickAddDialog
        open={adjustDialogOpen}
        onOpenChange={(open) => {
          setAdjustDialogOpen(open);
          if (!open) {
            setAdjustReason('');
            setNewQoh('');
          }
        }}
        title="Inventory Adjustment"
        onSave={handleConfirmAdjustment}
        onCancel={() => {
          setAdjustDialogOpen(false);
          setAdjustReason('');
          setNewQoh('');
        }}
      >
        <div>
          <Label htmlFor="new_qoh">New QOH</Label>
          <Input
            id="new_qoh"
            type="number"
            value={newQoh}
            onChange={(e) => setNewQoh(e.target.value)}
            placeholder={part?.quantity_on_hand?.toString() || '0'}
          />
        </div>
        <div>
          <Label htmlFor="adjust_reason">Reason *</Label>
          <Textarea
            id="adjust_reason"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            placeholder="Provide a reason for the quantity change"
            rows={3}
          />
        </div>
      </QuickAddDialog>

      {editing && isMobile && (
        <div className="no-print">
          <MobileActionBar
            primary={
              <Button onClick={handleSave} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            }
            secondary={
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            }
          />
          <MobileActionBarSpacer />
        </div>
      )}
    </div>
  );
}
