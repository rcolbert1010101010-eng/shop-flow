import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRepos } from '@/repos';
import type { ManufacturedProductOption, ManufacturingProductBomItem, Part } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
  useCreateManufacturedProduct,
  useManufacturedProduct,
  useManufacturedProductOptions,
  useUpdateManufacturedProduct,
  useCreateManufacturedProductOption,
  useUpdateManufacturedProductOption,
  useDeactivateManufacturedProductOption,
  useProductBom,
  useSaveProductBom,
  useProductCostSummary,
  useBomAvailability,
} from '@/hooks/useManufacturing';

const PRODUCT_TYPES = [
  { value: 'DUMP_BODY', label: 'Dump Body' },
  { value: 'TRAILER', label: 'Trailer' },
  { value: 'CUSTOM_EQUIPMENT', label: 'Custom Equipment' },
];

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  product_type: z.enum(['DUMP_BODY', 'TRAILER', 'CUSTOM_EQUIPMENT']),
  base_price: z.number().min(0, 'Base price must be at least 0'),
  estimated_labor_hours: z.number().min(0),
  estimated_overhead: z.number().min(0),
  description: z.string().optional().nullable(),
  is_active: z.boolean(),
});

const optionSchema = z.object({
  name: z.string().min(1, 'Option name is required'),
  option_type: z.string().min(1, 'Option type is required'),
  price_delta: z.number(),
  sort_order: z.number().min(0),
  is_active: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;
type OptionFormValues = z.infer<typeof optionSchema>;

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};
const formatNumber = (value: number | string | null | undefined, digits = 2) => toNumber(value).toFixed(digits);
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

export default function ManufacturingProductFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const productId = params.id;
  const isNew = productId === 'new';
  const [isEditing, setIsEditing] = useState(isNew);
  const { toast } = useToast();
  const repos = useRepos();
  const { parts } = repos.parts;

  const {
    data: product,
    isLoading: productLoading,
  } = useManufacturedProduct(isNew ? undefined : productId ?? undefined);
  const optionsQuery = useManufacturedProductOptions(productId ?? undefined);
  const createProduct = useCreateManufacturedProduct();
  const updateProduct = useUpdateManufacturedProduct();
  const createOption = useCreateManufacturedProductOption(productId ?? undefined);
  const updateOption = useUpdateManufacturedProductOption(productId ?? undefined);
  const deactivateOption = useDeactivateManufacturedProductOption(productId ?? undefined);
  const { bom, isLoading: bomLoading } = useProductBom(!isNew ? productId ?? undefined : undefined);
  const saveBom = useSaveProductBom(!isNew ? productId ?? undefined : undefined);
  const { summary: costSummary } = useProductCostSummary(productId ?? undefined, product ?? null);
  const bomAvailability = useBomAvailability(!isNew ? productId ?? undefined : undefined);
  const [bomDraft, setBomDraft] = useState<ManufacturingProductBomItem[]>([]);
  const partsForBom = useMemo(() => parts.filter((part) => isUuid(part.id)), [parts]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      product_type: 'DUMP_BODY',
      base_price: 0,
      estimated_labor_hours: 0,
      estimated_overhead: 0,
      description: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        sku: product.sku,
        product_type: product.product_type,
        base_price: product.base_price,
        estimated_labor_hours: product.estimatedLaborHours ?? 0,
        estimated_overhead: product.estimatedOverhead ?? 0,
        description: product.description,
        is_active: product.is_active,
      });
    }
  }, [product, form]);

  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ManufacturedProductOption | null>(null);
  const optionForm = useForm<OptionFormValues>({
    resolver: zodResolver(optionSchema),
    defaultValues: {
      name: '',
      option_type: '',
      price_delta: 0,
      sort_order: 0,
      is_active: true,
    },
  });

  const handleOptionOpen = (option?: ManufacturedProductOption) => {
    if (option) {
      setEditingOption(option);
      optionForm.reset({
        name: option.name,
        option_type: option.option_type,
        price_delta: option.price_delta,
        sort_order: option.sort_order,
        is_active: option.is_active,
      });
    } else {
      setEditingOption(null);
      optionForm.reset({
        name: '',
        option_type: '',
        price_delta: 0,
        sort_order: 0,
        is_active: true,
      });
    }
    setOptionDialogOpen(true);
  };

  const handleOptionSubmit = async (values: OptionFormValues) => {
    if (!productId) return;
    try {
      if (editingOption) {
        await updateOption.mutateAsync({
          id: editingOption.id,
          patch: {
            name: values.name,
            option_type: values.option_type,
            price_delta: values.price_delta,
            sort_order: values.sort_order,
            is_active: values.is_active,
          },
        });
        toast({ title: 'Option updated' });
      } else {
        await createOption.mutateAsync({
          product_id: productId,
          name: values.name,
          option_type: values.option_type,
          price_delta: values.price_delta,
          sort_order: values.sort_order,
          is_active: values.is_active,
        });
        toast({ title: 'Option added' });
      }
      setOptionDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message ?? 'Unable to save option',
        variant: 'destructive',
      });
    }
  };

  const handleOptionDeactivate = async (option: ManufacturedProductOption) => {
    try {
      await deactivateOption.mutateAsync(option.id);
      toast({ title: 'Option deactivated' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message ?? 'Unable to deactivate option',
        variant: 'destructive',
      });
    }
  };

  const handleBomChange = (id: string, patch: Partial<ManufacturingProductBomItem>) => {
    setBomDraft((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleAddBomRow = () => {
    if (!productId || isNew) {
      toast({ title: 'Save product first', description: 'Save the product before adding a BOM', variant: 'destructive' });
      return;
    }
    if (partsForBom.length === 0) {
      toast({ title: 'No parts available in this tenant', variant: 'destructive' });
      return;
    }
    const defaultPartId = partsForBom[0].id;
    setBomDraft((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        productId,
        partId: defaultPartId,
        quantity: 1,
        scrapFactor: 0,
        notes: '',
      },
    ]);
  };

  const handleRemoveBomRow = (id: string) => {
    setBomDraft((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveBom = async () => {
    if (!productId || isNew) {
      toast({ title: 'Save product first', description: 'Save the product before adding a BOM', variant: 'destructive' });
      return;
    }
    const prepared = bomDraft
      .filter((item) => item.partId)
      .map((item) => ({
        ...item,
        partId: item.partId,
        quantity: toNumber(item.quantity),
        scrapFactor: toNumber(item.scrapFactor),
        notes: item.notes ?? null,
      }));
    if (prepared.length === 0) {
      toast({ title: 'Select at least one part', variant: 'destructive' });
      return;
    }
    const validPartIds = new Set(partsForBom.map((part) => part.id));
    if (prepared.some((item) => !validPartIds.has(item.partId))) {
      toast({ title: 'Invalid part selected (not in tenant)', variant: 'destructive' });
      return;
    }
    try {
      await saveBom.mutateAsync(prepared);
      toast({ title: 'BOM saved' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message ?? 'Unable to save BOM',
        variant: 'destructive',
      });
    }
  };

  const computeRowCost = (item: ManufacturingProductBomItem) => {
    const part = partsForBom.find((p) => p.id === item.partId);
    const partCost = part?.cost ?? item.cost ?? 0;
    const qty = toNumber(item.quantity);
    const scrap = toNumber(item.scrapFactor);
    const total = partCost * qty * (1 + scrap);
    return Number.isFinite(total) ? total : 0;
  };

  useEffect(() => {
    if (bom) {
      setBomDraft(
        bom.map((item) => ({
          ...item,
          quantity: toNumber(item.quantity) || 0,
          scrapFactor: toNumber(item.scrapFactor) || 0,
        }))
      );
    }
  }, [bom]);


  const handleSubmit = async (values: ProductFormValues) => {
    try {
      if (isNew) {
        const created = await createProduct.mutateAsync({
          name: values.name,
          sku: values.sku,
          product_type: values.product_type,
          base_price: values.base_price,
          estimated_labor_hours: values.estimated_labor_hours,
          estimated_overhead: values.estimated_overhead,
          description: values.description ?? null,
          is_active: values.is_active,
        });
        toast({ title: 'Product created' });
        navigate(`/manufacturing/products/${created.id}`);
      } else {
        await updateProduct.mutateAsync({ id: productId!, patch: values });
        toast({ title: 'Product updated' });
        setIsEditing(false);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message ?? 'Unable to save product',
        variant: 'destructive',
      });
    }
  };

  const optionList = optionsQuery.data ?? [];

  return (
    <div className="page-container space-y-6">
      <PageHeader
        backTo="/manufacturing/products"
        title={isNew ? 'New Product' : product?.name ?? 'Product'}
        subtitle={isNew ? 'Create a manufactured product' : 'Update product details and options'}
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="manufacturing" />
            {!isNew && (
              <Button variant="ghost" onClick={() => setIsEditing((prev) => !prev)}>
                <Edit className="w-4 h-4 mr-1" />
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
            )}
            <Button disabled={!isEditing && !isNew} type="submit" form="product-form">
              {isNew ? 'Create' : 'Save'}
            </Button>
          </div>
        }
      />

      <form id="product-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              {...form.register('sku')}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              {...form.register('name')}
              disabled={!isEditing}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Type *</Label>
            <Controller
              control={form.control}
              name="product_type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="base_price">Base Price *</Label>
            <Input
              id="base_price"
              type="number"
              step="0.01"
              {...form.register('base_price', { valueAsNumber: true })}
              disabled={!isEditing}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="estimated_labor_hours">Estimated Labor Hours</Label>
            <Input
              id="estimated_labor_hours"
              type="number"
              step="0.1"
              {...form.register('estimated_labor_hours', { valueAsNumber: true })}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="estimated_overhead">Estimated Overhead</Label>
            <Input
              id="estimated_overhead"
              type="number"
              step="0.01"
              {...form.register('estimated_overhead', { valueAsNumber: true })}
              disabled={!isEditing}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={4}
            {...form.register('description')}
            disabled={!isEditing}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="is_active">Active</Label>
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <Switch
                id="is_active"
                checked={field.value}
                onCheckedChange={(value) => field.onChange(value)}
                disabled={!isEditing}
              />
            )}
          />
        </div>
      </form>

      {!isNew && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Options</h2>
            <Button onClick={() => handleOptionOpen()} disabled={!isEditing}>
              <Plus className="w-4 h-4 mr-1" />
              Add Option
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price Delta</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {optionList.map((option) => (
                <TableRow key={option.id}>
                  <TableCell>{option.name}</TableCell>
                  <TableCell>{option.option_type}</TableCell>
                  <TableCell>${formatNumber(option.price_delta)}</TableCell>
                  <TableCell>{option.is_active ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => handleOptionOpen(option)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOptionDeactivate(option)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {optionList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                    No options yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!isNew && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Bill of Materials</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleSaveBom} disabled={saveBom.isPending || isNew || bomLoading || partsForBom.length === 0}>
                Save BOM
              </Button>
              <Button onClick={handleAddBomRow} disabled={isNew || bomLoading || partsForBom.length === 0}>
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
              <TableHead>Part</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Scrap</TableHead>
              <TableHead className="text-right">QOH</TableHead>
              <TableHead className="text-right">Shortage</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Material Cost</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bomLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                  Loading BOM...
                </TableCell>
              </TableRow>
            ) : bomDraft.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                  No BOM items
                </TableCell>
              </TableRow>
            ) : (
              bomDraft.map((item) => {
                const part = partsForBom.find((p) => p.id === item.partId);
                const rowCost = computeRowCost(item);
                const availability = bomAvailability.items.find(
                  (a) => a.partId === item.partId || a.bomItemId === item.id
                );
                const qoh = availability?.qoh ?? 0;
                const shortage = availability?.shortage ?? 0;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Select
                        value={item.partId}
                          onValueChange={(value) => handleBomChange(item.id, { partId: value })}
                          disabled={partsForBom.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={partsForBom.length === 0 ? 'No parts available' : 'Select part'} />
                          </SelectTrigger>
                          <SelectContent>
                            {partsForBom.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.part_number} — {p.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {part && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Cost: ${formatNumber(part.cost ?? 0)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleBomChange(item.id, { quantity: Number(e.target.value) })}
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.scrapFactor}
                          onChange={(e) => handleBomChange(item.id, { scrapFactor: Number(e.target.value) })}
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(qoh)}</TableCell>
                      <TableCell className="text-right">
                        {shortage > 0 ? (
                          <Badge variant="destructive">Short {formatNumber(shortage)}</Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.notes ?? ''}
                          onChange={(e) => handleBomChange(item.id, { notes: e.target.value })}
                          placeholder="Notes (optional)"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">${formatNumber(rowCost)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveBomRow(item.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
            )}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-1 text-sm font-medium sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground">
            {bomAvailability.unknown
              ? 'Availability unknown (no BOM or inventory data).'
              : bomAvailability.ready
              ? 'All parts available – ready to build.'
              : `Short parts: ${bomAvailability.shortages.length} BOM line${
                  bomAvailability.shortages.length === 1 ? '' : 's'
                } need stock.`}
          </div>
          <div>Total material cost: ${formatNumber(costSummary.materialCost)}</div>
        </div>
      </div>
    )}

      <Dialog open={optionDialogOpen} onOpenChange={setOptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOption ? 'Edit Option' : 'Add Option'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={optionForm.handleSubmit(handleOptionSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="option_name">Option Name *</Label>
              <Input id="option_name" {...optionForm.register('name')} />
            </div>
            <div>
              <Label htmlFor="option_type">Option Type *</Label>
              <Input id="option_type" {...optionForm.register('option_type')} />
            </div>
            <div>
              <Label htmlFor="price_delta">Price Delta *</Label>
              <Input
                id="price_delta"
                type="number"
                step="0.01"
                {...optionForm.register('price_delta', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                {...optionForm.register('sort_order', { valueAsNumber: true })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="option_active">Active</Label>
              <Controller
                control={optionForm.control}
                name="is_active"
                render={({ field }) => (
                  <Switch
                    id="option_active"
                    checked={field.value}
                    onCheckedChange={(value) => field.onChange(value)}
                  />
                )}
              />
            </div>
            <DialogFooter className="flex justify-between">
              <Button variant="outline" type="button" onClick={() => setOptionDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingOption ? 'Update Option' : 'Create Option'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
