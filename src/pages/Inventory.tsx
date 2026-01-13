import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Plus, Settings2, X as XIcon } from 'lucide-react';
import { useRepos } from '@/repos';
import type { Part } from '@/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useShopStore } from '@/stores/shopStore';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ResponsiveDataList } from '@/components/common/ResponsiveDataList';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImportPartsDialog } from '@/components/inventory/ImportPartsDialog';

export default function Inventory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const repos = useRepos();
  const { parts } = repos.parts;
  const { vendors } = repos.vendors;
  const { categories } = repos.categories;
  const poRepo = repos.purchaseOrders;
  const { toast } = useToast();
  const [scanValue, setScanValue] = useState('');
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const inventoryMovements = useShopStore((s) => s.inventoryMovements);
  const inventoryAdjustments = useShopStore((s) => s.inventoryAdjustments);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [newQoh, setNewQoh] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const closeAdjustDialog = () => {
    setAdjustDialogOpen(false);
    setSelectedPart(null);
    setNewQoh('');
    setAdjustReason('');
  };
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [needsReorderOnly, setNeedsReorderOnly] = useState(false);
  const [adjustWarning, setAdjustWarning] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [cycleCountMode, setCycleCountMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});
  const [batchReason, setBatchReason] = useState('');
  const [batchSummary, setBatchSummary] = useState<{ updated: number; skipped: number; failed: number } | null>(null);
  const countInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'none' | 'vendor' | 'category' | 'active' | 'price'>('none');
  const [bulkVendorId, setBulkVendorId] = useState<string | null>(null);
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null);
  const [bulkActiveState, setBulkActiveState] = useState<'active' | 'inactive' | ''>('');
  const [priceAdjustType, setPriceAdjustType] = useState<'percent' | 'flat'>('percent');
  const [priceAdjustValue, setPriceAdjustValue] = useState('');
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const toNumber = (value: number | string | null | undefined) => {
    const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
    return Number.isFinite(numeric) ? numeric : 0;
  };
  const formatMoney = (value: number | string | null | undefined) => `$${toNumber(value).toFixed(2)}`;
  const bulkActionLabels: Record<'vendor' | 'category' | 'active' | 'price', string> = {
    vendor: 'Set Vendor',
    category: 'Set Category',
    active: 'Set Active/Inactive',
    price: 'Apply Price Adjustment',
  };
  const computeAdjustedPrice = useCallback(
    (part: Part) => {
      const base = toNumber(part.selling_price);
      const delta = Number(priceAdjustValue);
      if (!Number.isFinite(delta)) {
        throw new Error('Enter a valid price adjustment value');
      }
      const next =
        priceAdjustType === 'percent'
          ? base * (1 + delta / 100)
          : base + delta;
      return Math.max(0, Math.round(next * 100) / 100);
    },
    [priceAdjustType, priceAdjustValue]
  );
  const movementSummary = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const summary: Record<string, { lastCountedAt: string | null; delta30d: number }> = {};
    inventoryMovements.forEach((m) => {
      const current = summary[m.part_id] ?? { lastCountedAt: null, delta30d: 0 };
      if (m.movement_type === 'COUNT' || (m.movement_type === 'ADJUST' && m.reason?.startsWith('COUNT:'))) {
        if (!current.lastCountedAt || new Date(m.performed_at) > new Date(current.lastCountedAt)) {
          current.lastCountedAt = m.performed_at;
        }
      }
      const performedTs = new Date(m.performed_at).getTime();
      if (Number.isFinite(performedTs) && performedTs >= cutoff) {
        let delta = 0;
        if (m.movement_type === 'RECEIVE' || m.movement_type === 'RETURN' || m.movement_type === 'ADJUST') {
          delta = m.qty_delta;
        } else if (m.movement_type === 'ISSUE') {
          delta = -m.qty_delta;
        }
        current.delta30d += delta;
      }
      summary[m.part_id] = current;
    });
    return summary;
  }, [inventoryMovements]);

  const columns: Column<Part>[] = [
    ...(cycleCountMode || bulkSelectMode
      ? [
          {
            key: 'select',
            header: '',
            sortable: false,
            render: (item: Part) => (
              <Checkbox
                checked={!!selectedIds[item.id]}
                onCheckedChange={(checked) =>
                  setSelectedIds((prev) => ({ ...prev, [item.id]: Boolean(checked) }))
                }
                onClick={(e) => e.stopPropagation()}
              />
            ),
            className: 'w-10',
          } as Column<Part>,
        ]
      : []),
    {
      key: 'part_number',
      header: 'Part #',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="font-mono font-semibold whitespace-nowrap max-w-[180px] truncate">{item.part_number}</span>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {(() => {
              const ms = movementSummary[item.id];
              const lastCountedAt = ms?.lastCountedAt;
              const delta30d = ms?.delta30d ?? 0;
              const needsReorder = item.min_qty != null && item.quantity_on_hand < item.min_qty;
              const suggested = item.max_qty != null && item.max_qty > 0 ? Math.max(0, item.max_qty - item.quantity_on_hand) : 0;
              return (
                <>
                  {lastCountedAt && (
                    <span className="rounded-md bg-muted px-2 py-0.5">
                      Last count {new Date(lastCountedAt).toLocaleDateString()}
                    </span>
                  )}
                  <span className="rounded-md bg-muted px-2 py-0.5">
                    30d Δ {delta30d > 0 ? `+${delta30d}` : delta30d}
                  </span>
                  {needsReorder && Number.isFinite(suggested) && suggested > 0 && (
                    <span className="rounded-md bg-muted px-2 py-0.5">
                      Suggested {suggested}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      ),
      className: 'font-mono w-[180px] min-w-[180px]',
    },
    { key: 'description', header: 'Description', sortable: true },
    {
      key: 'category_id',
      header: 'Category',
      sortable: true,
      render: (item) => {
        const category = categories.find((c) => c.id === item.category_id);
        return category?.category_name || '-';
      },
    },
    {
      key: 'bin_location',
      header: 'Bin',
      sortable: false,
      render: (item) => item.bin_location || '—',
    },
    {
      key: 'vendor_id',
      header: 'Vendor',
      sortable: true,
      render: (item) => {
        const vendor = vendors.find((v) => v.id === item.vendor_id);
        return vendor?.vendor_name || '-';
      },
    },
    {
      key: 'cost',
      header: 'Cost',
      sortable: true,
      render: (item) => formatMoney(item.cost),
      className: 'text-right',
    },
    {
      key: 'selling_price',
      header: 'Price',
      sortable: true,
      render: (item) => formatMoney(item.selling_price),
      className: 'text-right',
    },
    {
      key: 'min_qty',
      header: 'Min',
      sortable: false,
      render: (item) => (item.min_qty ?? '—'),
      className: 'text-right',
    },
    {
      key: 'max_qty',
      header: 'Max',
      sortable: false,
      render: (item) => (item.max_qty ?? '—'),
      className: 'text-right',
    },
    {
      key: 'quantity_on_hand',
      header: 'QOH',
      sortable: true,
      render: (item) => {
        const uom = item.uom ?? 'EA';
        const qty = item.quantity_on_hand ?? 0;
        const precision = item.qty_precision ?? (uom === 'EA' ? 0 : 2);
        const formattedQty = uom === 'EA' ? qty.toString() : qty.toFixed(precision).replace(/\.?0+$/, '');
        return (
        <div className="flex items-center gap-2 justify-end">
          <span
            className={cn(
              'font-medium',
              item.quantity_on_hand < 0 && 'text-destructive',
              item.quantity_on_hand === 0 && 'text-warning'
            )}
          >
            {formattedQty} {uom}
          </span>
          {cycleCountMode && (
            <Input
              type="number"
              placeholder="Counted"
              value={countInputs[item.id] ?? ''}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setCountInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => handleCountKeyDown(item.id, e)}
              className="h-8 w-24"
              disabled={!selectedIds[item.id]}
              ref={(el) => {
                countInputRefs.current[item.id] = el;
              }}
            />
          )}
        </div>
        );
      },
      className: 'text-right',
    },
    {
      key: 'reorder',
      header: 'Reorder',
      sortable: false,
      render: (item) => {
        const vendor = vendors.find((v) => v.id === item.vendor_id);
        const lead = (vendor as any)?.lead_time_days; // only if present in data; ignore otherwise
        const target = item.max_qty ?? item.min_qty ?? null;
        const suggested = target != null ? Math.max(0, target - item.quantity_on_hand) : 0;
        return (
          <div className="flex flex-col items-end text-sm">
            <span className={cn('font-semibold', suggested > 0 ? 'text-amber-800' : 'text-muted-foreground')}>
              {target == null ? '—' : suggested}
            </span>
            {lead ? <span className="text-[11px] text-muted-foreground">Lead: {lead}d</span> : null}
          </div>
        );
      },
      className: 'text-right',
    },
    {
      key: 'stock_status',
      header: 'Stock',
      sortable: false,
      render: (item) => {
        const isOut = item.quantity_on_hand === 0;
        const isLow = item.min_qty != null && item.quantity_on_hand < item.min_qty;
        const status = isOut ? 'OUT' : isLow ? 'LOW' : 'OK';
        const badgeClass =
          status === 'OUT'
            ? 'bg-destructive/15 text-destructive'
            : status === 'LOW'
            ? 'bg-amber-100 text-amber-800 border border-amber-300'
            : 'bg-emerald-100 text-emerald-800 border border-emerald-200';
        return (
          <span className={cn('inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold', badgeClass)}>
            {status}
          </span>
        );
      },
      className: 'text-right',
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right w-40',
      render: (item) =>
        item.is_active ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={() => {
                  navigate(`/inventory/${item.id}`);
                }}
              >
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/receiving?search=${encodeURIComponent(item.part_number)}`)}
              >
                Receive
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedPart(item);
                  setNewQoh(item.quantity_on_hand.toString());
                  setAdjustReason('');
                  setAdjustDialogOpen(true);
                }}
              >
                Adjust QOH
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-xs text-muted-foreground">Inactive</span>
        ),
    },
  ];

  const handleScan = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      const matched =
        parts.find((p) => p.barcode && p.barcode === trimmed) ||
        parts.find((p) => p.part_number === trimmed);
      if (matched) {
        navigate(`/inventory/${matched.id}`);
      } else {
        toast({ title: 'Barcode not found', description: 'No matching part for scanned value' });
      }
      setScanValue('');
    },
    [navigate, parts, toast]
  );

  useEffect(() => {
    if (!scanValue) return;
    const timer = setTimeout(() => handleScan(scanValue), 200);
    return () => clearTimeout(timer);
  }, [scanValue, handleScan]);

  useEffect(() => {
    const current = searchParams.get('search') || '';
    if (current !== searchInput) {
      setSearchInput(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = searchInput.trim();
      const current = searchParams.get('search') || '';
      if (current === trimmed) return;
      const next = new URLSearchParams(searchParams);
      if (trimmed) {
        next.set('search', trimmed);
      } else {
        next.delete('search');
      }
      setSearchParams(next);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput, searchParams, setSearchParams]);
  const recentMovements = useMemo(() => {
    if (!selectedPart) return [];
    return inventoryMovements
      .filter((m) => m.part_id === selectedPart.id)
      .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())
      .slice(0, 10);
  }, [inventoryMovements, selectedPart]);

  const recentAdjustments = useMemo(() => {
    if (!selectedPart) return [];
    return inventoryAdjustments
      .filter((a) => a.part_id === selectedPart.id)
      .sort((a, b) => new Date(b.adjusted_at).getTime() - new Date(a.adjusted_at).getTime())
      .slice(0, 10);
  }, [inventoryAdjustments, selectedPart]);

  const enhancedParts = useMemo(() => {
    return parts.map((p) => {
      const isOut = p.quantity_on_hand === 0;
      const isLow = p.min_qty != null && p.quantity_on_hand < p.min_qty;
      const target = p.max_qty ?? p.min_qty ?? null;
      const suggested = target != null ? Math.max(0, target - p.quantity_on_hand) : 0;
      const summary = movementSummary[p.id];
      return {
        ...p,
        __stock: (isOut ? 'OUT' : isLow ? 'LOW' : 'OK') as 'OUT' | 'LOW' | 'OK',
        __target: target,
        __suggested: suggested,
        __needsReorder: suggested > 0 && Number.isFinite(suggested) && suggested > 0,
        __lastCountedAt: summary?.lastCountedAt ?? null,
        __delta30d: summary?.delta30d ?? 0,
      };
    });
  }, [movementSummary, parts]);

  const filteredParts = useMemo(() => {
    let list = enhancedParts;
    const searchQuery = (searchParams.get('search') || '').toLowerCase();
    if (searchQuery) {
      list = list.filter(
        (p) =>
          p.part_number.toLowerCase().includes(searchQuery) ||
          (p.description || '').toLowerCase().includes(searchQuery)
      );
    }
    if (stockFilter !== 'ALL') {
      list = list.filter((p) => p.__stock === stockFilter);
    }
    if (needsReorderOnly) {
      list = list.filter((p) => p.__needsReorder);
    }
    return list;
  }, [enhancedParts, needsReorderOnly, searchParams, stockFilter]);
  const selectedParts = useMemo(
    () => filteredParts.filter((p) => selectedIds[p.id]),
    [filteredParts, selectedIds]
  );
  useEffect(() => {
    setBulkSummary(null);
  }, [bulkAction, selectedParts.length]);
  const invalidCount = useMemo(
    () =>
      selectedParts.filter((p) => {
        const raw = countInputs[p.id];
        const num = Number(raw);
        return raw == null || raw === '' || !Number.isFinite(num) || num < 0;
      }).length,
    [countInputs, selectedParts]
  );
  const validCount = useMemo(
    () =>
      selectedParts.filter((p) => {
        const raw = countInputs[p.id];
        const num = Number(raw);
        return raw != null && raw !== '' && Number.isFinite(num) && num >= 0;
      }).length,
    [countInputs, selectedParts]
  );
  const cycleCountIssues = useMemo(() => {
    const issues: string[] = [];
    if (!batchReason.trim()) issues.push('Reason required to apply counts.');
    if (selectedParts.length === 0) issues.push('Select at least one part.');
    const hasInvalid = selectedParts.some((p) => {
      const raw = countInputs[p.id];
      const num = Number(raw);
      return raw != null && raw !== '' && (!Number.isFinite(num) || num < 0);
    });
    if (hasInvalid) issues.push('Invalid counts present (must be >= 0).');
    const hasAnyEntry = selectedParts.some((p) => {
      const raw = countInputs[p.id];
      return raw != null && raw !== '';
    });
    if (selectedParts.length > 0 && !hasAnyEntry) issues.push('Enter a count for at least one selected part.');
    return issues;
  }, [batchReason, countInputs, selectedParts]);
  const cycleCountBlocker = cycleCountIssues[0] || '';
  const applyDisabled = Boolean(cycleCountBlocker);
  const poIssues = useMemo(() => {
    const issues: string[] = [];
    if (!bulkSelectMode || selectedParts.length === 0) return issues;
    const valid = selectedParts.filter(
      (p) => p.vendor_id && Number.isFinite((p as any).__suggested) && (p as any).__suggested > 0
    );
    if (valid.length === 0) {
      issues.push('Select parts with vendor and suggested qty > 0 to create draft PO.');
    }
    return issues;
  }, [bulkSelectMode, selectedParts]);
  const bulkActionReady = useMemo(() => {
    switch (bulkAction) {
      case 'vendor':
        return Boolean(bulkVendorId);
      case 'category':
        return Boolean(bulkCategoryId);
      case 'active':
        return Boolean(bulkActiveState);
      case 'price': {
        const parsed = Number(priceAdjustValue);
        return priceAdjustValue.trim() !== '' && Number.isFinite(parsed);
      }
      default:
        return false;
    }
  }, [bulkAction, bulkActiveState, bulkCategoryId, bulkVendorId, priceAdjustValue]);
  const bulkEditMutation = useMutation({
    mutationFn: async () => {
      if (!bulkSelectMode) throw new Error('Enable bulk select to run bulk actions.');
      if (selectedParts.length === 0) throw new Error('Select at least one part.');
      if (bulkAction === 'none') throw new Error('Choose a bulk action from the menu.');

      const attempted = selectedParts.length;
      let updated = 0;
      const updates: Promise<unknown>[] = [];

      selectedParts.forEach((part) => {
        const patch: Partial<Part> = {};
        if (bulkAction === 'vendor') {
          if (!bulkVendorId) throw new Error('Select a vendor to apply.');
          patch.vendor_id = bulkVendorId;
        } else if (bulkAction === 'category') {
          if (!bulkCategoryId) throw new Error('Select a category to apply.');
          patch.category_id = bulkCategoryId;
        } else if (bulkAction === 'active') {
          if (!bulkActiveState) throw new Error('Choose Active or Inactive.');
          patch.is_active = bulkActiveState === 'active';
        } else if (bulkAction === 'price') {
          patch.selling_price = computeAdjustedPrice(part);
        }
        if (Object.keys(patch).length > 0) {
          updates.push(Promise.resolve(repos.parts.updatePart(part.id, patch)));
          updated += 1;
        }
      });

      if (updated === 0) throw new Error('No changes to apply.');
      await Promise.all(updates);
      return { attempted, updated, skipped: attempted - updated };
    },
    onSuccess: (result) => {
      const label = bulkAction !== 'none' ? bulkActionLabels[bulkAction] : 'Bulk action';
      const message = `${result.updated} updated • ${result.skipped} skipped`;
      setBulkSummary(`${label}: ${message}`);
      setSelectedIds({});
      toast({ title: 'Bulk update applied', description: message });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Bulk action failed';
      toast({ title: 'Bulk action failed', description: message, variant: 'destructive' });
    },
  });
  const adjustIssues = useMemo(() => {
    const issues: string[] = [];
    if (!selectedPart) issues.push('Select a part to adjust.');
    if (!adjustReason.trim()) issues.push('Reason required.');
    if (!Number.isFinite(Number(newQoh))) issues.push('Enter a valid quantity.');
    return issues;
  }, [adjustReason, newQoh, selectedPart]);

  const handleCreateDraftPO = () => {
    if (!bulkSelectMode || selectedParts.length === 0) return;
    const grouped: Record<string, Part[]> = {};
    const skipped: string[] = [];
    selectedParts.forEach((p) => {
      const suggested = (p as any).__suggested ?? 0;
      if (!p.vendor_id || !Number.isFinite(suggested) || suggested <= 0) {
        skipped.push(p.part_number);
        return;
      }
      if (!grouped[p.vendor_id]) grouped[p.vendor_id] = [];
      grouped[p.vendor_id].push(p);
    });
    const vendorIds = Object.keys(grouped);
    if (vendorIds.length === 0) {
      toast({
        title: 'Cannot create draft PO',
        description: 'Selected parts need vendor and suggested quantity.',
        variant: 'destructive',
      });
      return;
    }
    const created: string[] = [];
    vendorIds.forEach((vendorId) => {
      const order = poRepo.createPurchaseOrder(vendorId);
      if (!order) return;
      created.push(order.id);
      grouped[vendorId].forEach((p) => {
        const suggested = Math.max(0, (p as any).__suggested ?? 0);
        if (suggested > 0) {
          poRepo.poAddLine(order.id, p.id, suggested);
        }
      });
    });
    const skippedText =
      skipped.length === 0
        ? ''
        : ` • Skipped ${skipped.length} part(s) without vendor/qty${skipped.length > 5 ? '...' : skipped.length ? ` (${skipped.slice(0, 5).join(', ')})` : ''}`;
    toast({
      title: 'Draft purchase orders created',
      description: `Created ${created.length} PO(s)${skippedText}`,
    });
    setBulkSelectMode(false);
    setSelectedIds({});
    setCountInputs({});
    setBatchSummary(null);
    if (created.length === 1) {
      navigate(`/purchase-orders/${created[0]}`);
    } else {
      navigate('/purchase-orders');
    }
  };

  const poPreview = useMemo(() => {
    const groups: { vendorId: string; name: string; parts: number; total: number }[] = [];
    let skipped = 0;
    if (!bulkSelectMode || selectedParts.length === 0) return { groups, skipped };
    const grouped: Record<string, { parts: number; total: number }> = {};
    selectedParts.forEach((p) => {
      const suggested = (p as any).__suggested ?? 0;
      if (!p.vendor_id || !Number.isFinite(suggested) || suggested <= 0) {
        skipped += 1;
        return;
      }
      if (!grouped[p.vendor_id]) {
        grouped[p.vendor_id] = { parts: 0, total: 0 };
      }
      grouped[p.vendor_id].parts += 1;
      grouped[p.vendor_id].total += suggested;
    });
    Object.entries(grouped).forEach(([vendorId, info]) => {
      const vendor = vendors.find((v) => v.id === vendorId);
      groups.push({
        vendorId,
        name: vendor?.vendor_name || 'Unknown Vendor',
        parts: info.parts,
        total: info.total,
      });
    });
    return { groups, skipped };
  }, [bulkSelectMode, selectedParts, vendors]);

  const renderStockBadge = (part: any) => {
    const status = part.__stock;
    const badgeClass =
      status === 'OUT'
        ? 'bg-destructive/15 text-destructive'
        : status === 'LOW'
        ? 'bg-amber-100 text-amber-800 border border-amber-300'
        : 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    return (
      <span className={cn('inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold', badgeClass)}>
        {status}
      </span>
    );
  };

  const renderPartCard = (item: any) => {
    const selected = !!selectedIds[item.id];
    const needsReorder = item.min_qty != null && item.quantity_on_hand < item.min_qty;
    const onToggleSelect = () => {
      if (cycleCountMode || bulkSelectMode) {
        setSelectedIds((prev) => ({ ...prev, [item.id]: !selected }));
      } else {
        navigate(`/inventory/${item.id}`);
      }
    };
    return (
      <div className="border rounded-lg p-3 space-y-3 bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              {(cycleCountMode || bulkSelectMode) && (
                <Checkbox checked={selected} onCheckedChange={onToggleSelect} onClick={(e) => e.stopPropagation()} />
              )}
              <span className="font-mono font-semibold text-sm whitespace-nowrap truncate max-w-[200px]">
                {item.part_number}
              </span>
              {renderStockBadge(item)}
            </div>
            <div className="text-sm text-muted-foreground break-words">{item.description || '—'}</div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => navigate(`/inventory/${item.id}`)}>View</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/receiving?search=${encodeURIComponent(item.part_number)}`)}>
                Receive
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedPart(item);
                  setNewQoh(item.quantity_on_hand.toString());
                  setAdjustReason('');
                  setAdjustDialogOpen(true);
                }}
              >
                Adjust QOH
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">QOH</p>
            <p className={cn('font-semibold', item.quantity_on_hand < 0 && 'text-destructive')}>
              {(() => {
                const uom = item.uom ?? 'EA';
                const qty = item.quantity_on_hand ?? 0;
                const precision = item.qty_precision ?? (uom === 'EA' ? 0 : 2);
                const formattedQty = uom === 'EA' ? qty.toString() : qty.toFixed(precision).replace(/\.?0+$/, '');
                return `${formattedQty} ${uom}`;
              })()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="font-semibold">${toNumber(item.selling_price).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vendor</p>
            <p className="font-medium">{(vendors.find((v) => v.id === item.vendor_id)?.vendor_name as string) || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Category</p>
            <p className="font-medium">{(categories.find((c) => c.id === item.category_id)?.category_name as string) || '—'}</p>
          </div>
        </div>
        {(cycleCountMode || bulkSelectMode) && (
          <div className="flex items-center gap-2">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} onClick={(e) => e.stopPropagation()} />
            <span className="text-sm text-muted-foreground">Select</span>
            {cycleCountMode && (
              <Input
                type="number"
                placeholder="Counted"
                value={countInputs[item.id] ?? ''}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setCountInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => handleCountKeyDown(item.id, e)}
                className="h-8 w-24 ml-auto"
                disabled={!selected}
              />
            )}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {needsReorder ? <span className="text-amber-700">Needs reorder</span> : <span>Healthy</span>}
          {item.bin_location && <span>Bin: {item.bin_location}</span>}
        </div>
      </div>
    );
  };
  const focusNextCountInput = (partId: string, direction: 'forward' | 'backward' = 'forward') => {
    const idx = filteredParts.findIndex((p) => p.id === partId);
    if (idx === -1) return;
    const enforceSelection = selectedParts.length > 0;
    const targetList = enforceSelection
      ? filteredParts.filter((p) => selectedIds[p.id])
      : filteredParts;
    const relativeIdx = targetList.findIndex((p) => p.id === partId);
    if (relativeIdx === -1) return;
    const start = direction === 'forward' ? relativeIdx + 1 : relativeIdx - 1;
    const step = direction === 'forward' ? 1 : -1;
    for (let i = start; i >= 0 && i < targetList.length; i += step) {
      const candidate = targetList[i];
      const ref = countInputRefs.current[candidate.id];
      if (ref && !ref.disabled) {
        ref.focus();
        ref.select?.();
        return;
      }
    }
  };

  const partsById = useMemo(() => new Map(filteredParts.map((p) => [p.id, p])), [filteredParts]);

  const handleCountKeyDown = (partId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      focusNextCountInput(partId, e.shiftKey ? 'backward' : 'forward');
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setCountInputs((prev) => {
        const part = partsById.get(partId);
        const baseline = prev[partId] === undefined || prev[partId] === '' ? part?.quantity_on_hand ?? 0 : Number(prev[partId]);
        const current = Number.isFinite(baseline) ? baseline : 0;
        const next =
          e.key === 'ArrowUp' ? current + 1 : Math.max(0, current - 1);
        return { ...prev, [partId]: String(next) };
      });
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
      e.preventDefault();
      applyCounts();
      return;
    }
    if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
  };

  const applyCounts = useCallback(() => {
    if (cycleCountBlocker) return;
    const reason = `COUNT: ${batchReason.trim()}`;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    for (const part of filteredParts) {
      if (!selectedIds[part.id]) continue;
      const raw = countInputs[part.id];
      if (raw == null || raw === '') {
        skipped += 1;
        continue;
      }
      const counted = Number(raw);
      if (!Number.isFinite(counted) || counted < 0) {
        failed += 1;
        continue;
      }
      if (counted === part.quantity_on_hand) {
        skipped += 1;
        continue;
      }
      const result = repos.parts.updatePartWithQohAdjustment(
        part.id,
        { quantity_on_hand: counted },
        { reason, adjusted_by: '' }
      );
      if (result?.error) {
        failed += 1;
      } else {
        updated += 1;
      }
    }
    setBatchSummary({ updated, skipped, failed });
    setSelectedIds({});
    setCountInputs({});
    setBatchReason('');
    toast({
      title: 'Quick cycle count applied',
      description: `Updated ${updated}, Skipped ${skipped}, Failed ${failed}`,
      variant: failed > 0 ? 'destructive' : 'default',
    });
  }, [batchReason, countInputs, cycleCountBlocker, filteredParts, repos.parts, selectedIds, toast]);

  const stockCounts = useMemo(() => {
    let low = 0;
    let out = 0;
    let needs = 0;
    let suggestedTotal = 0;
    let negative = 0;
    enhancedParts.forEach((p) => {
      if (p.quantity_on_hand < 0) negative += 1;
      if (p.__stock === 'OUT') out += 1;
      else if (p.__stock === 'LOW') low += 1;
      if (p.__needsReorder) {
        needs += 1;
        suggestedTotal += p.__suggested;
      }
    });
    return { low, out, needs, suggestedTotal, negative, total: enhancedParts.length };
  }, [enhancedParts]);

  const handleSaveAdjustment = () => {
    if (!selectedPart) return;
    const parsed = Number(newQoh);
    if (!Number.isFinite(parsed)) return;
    if (!adjustReason.trim()) return;
    const result = repos.parts.updatePartWithQohAdjustment(
      selectedPart.id,
      { quantity_on_hand: parsed },
      { reason: adjustReason.trim(), adjusted_by: '' }
    );
    if (result?.error) {
      setAdjustError(result.error);
      toast({ title: 'Adjustment blocked', description: result.error, variant: 'destructive' });
      return;
    }
    if (result?.warning) {
      setAdjustWarning(result.warning);
      toast({ title: 'Inventory adjusted', description: result.warning });
    }
    if (!result?.warning) {
      toast({ title: 'Inventory adjusted' });
    }
    setAdjustWarning(null);
    setAdjustError(null);
    closeAdjustDialog();
  };

  return (
    <TooltipProvider>
      <div className="page-container">
      <PageHeader
        title="Inventory"
        subtitle="Manage parts and stock levels"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Import Parts
            </Button>
            <Button onClick={() => navigate('/inventory/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Part
            </Button>
          </div>
        }
      />

      <div className="sticky top-16 z-20 bg-background/95 backdrop-blur border-b mb-4 space-y-3 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={scanInputRef}
              placeholder="Scan barcode"
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleScan(scanValue);
                }
              }}
              className="w-full max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={() => scanInputRef.current?.focus()}>
              Focus Scan
            </Button>
            <Button
              variant={cycleCountMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCycleCountMode((prev) => {
                  const next = !prev;
                  if (next) {
                    setBulkSelectMode(false);
                    setBulkAction('none');
                    setBulkVendorId(null);
                    setBulkCategoryId(null);
                    setBulkActiveState('');
                    setPriceAdjustValue('');
                    setBulkSummary(null);
                    setSelectedIds({});
                    setCountInputs({});
                    setBatchReason('');
                    setBatchSummary(null);
                  }
                  return next;
                });
                setSelectedIds({});
                setCountInputs({});
                setBatchReason('');
                setBatchSummary(null);
              }}
            >
              {cycleCountMode ? 'Exit Quick Cycle Count' : 'Quick Cycle Count'}
            </Button>
            <Button
              variant={bulkSelectMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setBulkSelectMode((prev) => {
                  const next = !prev;
                  if (next) {
                    setCycleCountMode(false);
                    setCountInputs({});
                    setBatchReason('');
                    setBatchSummary(null);
                    setBulkAction('none');
                    setBulkVendorId(null);
                    setBulkCategoryId(null);
                    setBulkActiveState('');
                    setPriceAdjustValue('');
                    setBulkSummary(null);
                  }
                  return next;
                });
                setSelectedIds({});
              }}
            >
              {bulkSelectMode ? 'Exit Bulk Select' : 'Bulk Select'}
            </Button>
          </div>
          <div className="flex items-center gap-2 lg:ml-auto w-full lg:w-auto">
            <Input
              placeholder="Search parts"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full lg:w-56"
            />
            {searchInput && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
              >
                <XIcon className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Inventory:</span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs">SKUs {stockCounts.total}</span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs">Low {stockCounts.low}</span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs">Out {stockCounts.out}</span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs">Negative {stockCounts.negative}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">Alerts:</span>
            <Button
              variant={stockFilter === 'LOW' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStockFilter('LOW')}
              className="rounded-full"
            >
              Low: {stockCounts.low}
            </Button>
            <Button
              variant={stockFilter === 'OUT' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStockFilter('OUT')}
              className="rounded-full"
            >
              Out: {stockCounts.out}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStockFilter('ALL')}
              className="rounded-full"
            >
              All
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">Reorder:</span>
            <Button
              variant={needsReorderOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setNeedsReorderOnly((prev) => !prev)}
              className="rounded-full"
            >
              Needs Reorder: {stockCounts.needs}
            </Button>
            <span className="text-xs text-muted-foreground">Suggested units: {stockCounts.suggestedTotal}</span>
          </div>
        </div>
      </div>

      {isMobile && filteredParts.length === 0 ? (
        <div className="rounded-lg border bg-card text-muted-foreground p-4 text-center">
          No parts found. Add your first part to get started.
        </div>
      ) : (
        <ResponsiveDataList
          items={filteredParts}
          renderMobileCard={renderPartCard}
          renderDesktop={(items) => (
            <DataTable
              data={items}
              columns={columns}
              searchKeys={['part_number', 'description']}
              searchPlaceholder="Search parts..."
              onRowClick={(part) => {
                if (cycleCountMode || bulkSelectMode) {
                  setSelectedIds((prev) => ({ ...prev, [part.id]: !prev[part.id] }));
                  return;
                }
                navigate(`/inventory/${part.id}`);
              }}
              
              emptyMessage="No parts found. Add your first part to get started."
            />
          )}
        />
      )}

      {(bulkSelectMode || cycleCountMode) && (
        <div className="mt-4 rounded-lg border bg-muted/40 p-4 space-y-3">
          {bulkSelectMode && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Bulk actions:</span>
                <span className="text-muted-foreground">Selected {selectedParts.length} part(s)</span>
                {bulkSummary && <Badge variant="outline">{bulkSummary}</Badge>}
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2 rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Draft Purchase Orders</span>
                    <Badge variant="secondary">{poPreview.groups.length} vendor group(s)</Badge>
                  </div>
                  {selectedParts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Select parts from the table to create draft purchase orders.
                    </p>
                  ) : (
                    <>
                      {poPreview.groups.length > 0 && (
                        <div className="space-y-1 text-sm">
                          {poPreview.groups.map((g) => (
                            <div key={g.vendorId} className="flex justify-between">
                              <span>{g.name}</span>
                              <span className="text-muted-foreground">
                                {g.parts} part(s) • Suggested {g.total}
                              </span>
                            </div>
                          ))}
                          {poPreview.skipped > 0 && (
                            <div className="text-[11px] text-muted-foreground">
                              Skipped {poPreview.skipped} without vendor/qty
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {poIssues.length > 0 ? (
                    <ul className="list-disc list-inside text-destructive text-sm">
                      {poIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Ready to create draft purchase order(s) from selection.</p>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={handleCreateDraftPO} disabled={poIssues.length > 0 || selectedParts.length === 0}>
                      Create Draft PO
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedIds({});
                        setBulkSelectMode(false);
                      }}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">Bulk Edit</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings2 className="w-4 h-4 mr-2" />
                          Bulk Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => setBulkAction('vendor')}>Set Vendor</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBulkAction('category')}>Set Category</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBulkAction('active')}>Set Active/Inactive</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBulkAction('price')}>Apply Price Adjustment</DropdownMenuItem>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuItem disabled className="opacity-60">
                              Adjust QOH (blocked)
                            </DropdownMenuItem>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            Quantity on hand requires inventory adjustments or receiving.
                          </TooltipContent>
                        </Tooltip>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {bulkAction !== 'none' && (
                      <Badge variant="secondary">{bulkActionLabels[bulkAction]}</Badge>
                    )}
                    <Badge variant="outline">Non-destructive: no deletes</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bulk edits update metadata and pricing only. QOH edits are blocked; use Receive Inventory or Adjust QOH for quantities.
                  </p>

                  {bulkAction === 'vendor' && (
                    <div className="space-y-2">
                      <Label>Vendor</Label>
                      <Select value={bulkVendorId ?? undefined} onValueChange={(val) => setBulkVendorId(val)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.vendor_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {bulkAction === 'category' && (
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={bulkCategoryId ?? undefined} onValueChange={(val) => setBulkCategoryId(val)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.category_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {bulkAction === 'active' && (
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={bulkActiveState || undefined} onValueChange={(val: 'active' | 'inactive') => setBulkActiveState(val)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Set active or inactive" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Set Active</SelectItem>
                          <SelectItem value="inactive">Set Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {bulkAction === 'price' && (
                    <div className="space-y-2">
                      <Label>Price Adjustment</Label>
                      <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
                        <Input
                          type="number"
                          value={priceAdjustValue}
                          onChange={(e) => setPriceAdjustValue(e.target.value)}
                          placeholder="Amount or percent"
                        />
                        <Select value={priceAdjustType} onValueChange={(val: 'percent' | 'flat') => setPriceAdjustType(val)}>
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">Percent</SelectItem>
                            <SelectItem value="flat">Flat $</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Applies to selling price only. Negative values are allowed but prices are floored at $0.00.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => bulkEditMutation.mutate()}
                      disabled={!bulkActionReady || selectedParts.length === 0 || bulkEditMutation.isPending}
                    >
                      {bulkEditMutation.isPending ? 'Applying…' : `Apply to ${selectedParts.length || 0} part(s)`}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setBulkAction('none');
                        setBulkVendorId(null);
                        setBulkCategoryId(null);
                        setBulkActiveState('');
                        setPriceAdjustValue('');
                        setBulkSummary(null);
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {cycleCountMode && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="batch_reason" className="text-sm font-semibold">
                    Reason *
                  </Label>
                  <Input
                    id="batch_reason"
                    value={batchReason}
                    onChange={(e) => setBatchReason(e.target.value)}
                    placeholder="Reason for this cycle count"
                    className="w-64"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedParts.length} • Valid: {validCount} • Invalid: {invalidCount}
                </div>
                {batchSummary && (
                  <div className="text-sm text-muted-foreground">
                    Updated {batchSummary.updated} • Skipped {batchSummary.skipped} • Failed {batchSummary.failed}
                  </div>
                )}
              </div>
              <div className="rounded-md border border-border/60 bg-muted/50 p-3 text-sm">
                {cycleCountIssues.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-destructive">
                    {cycleCountIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Ready to apply counts to {validCount} part(s).</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Tab/Shift+Tab moves • Enter next • ↑/↓ adjusts • ⌘/Ctrl+Enter applies • Esc blurs
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={applyCounts}
                  disabled={applyDisabled}
                >
                  Apply Counts
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCycleCountMode(false);
                    setSelectedIds({});
                    setCountInputs({});
                    setBatchReason('');
                    setBatchSummary(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <Dialog open={adjustDialogOpen} onOpenChange={(open) => { if (!open) closeAdjustDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust QOH {selectedPart ? `(${selectedPart.part_number})` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {adjustWarning && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {adjustWarning}
              </div>
            )}
            {adjustError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {adjustError}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Current QOH: <span className="font-medium text-foreground">{selectedPart?.quantity_on_hand ?? '—'}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_qoh">New QOH</Label>
              <Input
                id="new_qoh"
                type="number"
                value={newQoh}
                onChange={(e) => setNewQoh(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust_reason">Reason *</Label>
              <Input
                id="adjust_reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Why are you adjusting this quantity?"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Recent History</p>
              <div className="grid gap-3 md:grid-cols-2 max-h-[320px] overflow-auto pr-1">
                <div className="border rounded-md">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">Movements</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>By</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentMovements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                            No movements
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentMovements.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="uppercase text-xs font-semibold">{m.movement_type}</TableCell>
                            <TableCell className="text-right">{m.qty_delta}</TableCell>
                            <TableCell className="text-xs">{m.performed_by}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(m.performed_at).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="border rounded-md">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">Adjustments</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Old/New</TableHead>
                        <TableHead className="text-right">Delta</TableHead>
                        <TableHead>By</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentAdjustments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                            No adjustments
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentAdjustments.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs">
                              {a.old_qty} → {a.new_qty}
                              {a.reason ? ` (${a.reason})` : ''}
                            </TableCell>
                            <TableCell className="text-right">{a.delta}</TableCell>
                            <TableCell className="text-xs">{a.adjusted_by}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(a.adjusted_at).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4 flex flex-wrap items-start gap-3">
            {adjustIssues.length > 0 && (
              <div className="text-sm text-destructive mr-auto">
                <ul className="list-disc list-inside space-y-1">
                  {adjustIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeAdjustDialog}>
                Cancel
              </Button>
              <Button onClick={handleSaveAdjustment} disabled={adjustIssues.length > 0}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportPartsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        parts={parts}
        vendors={vendors}
        categories={categories}
      />
    </div>
    </TooltipProvider>
  );
}
