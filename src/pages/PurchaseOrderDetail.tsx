import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useRepos } from '@/repos';
import { useToast } from '@/hooks/use-toast';
import { Save, Plus, Trash2, PackageCheck, Lock, ChevronsUpDown } from 'lucide-react';
import { QuickAddDialog } from '@/components/ui/quick-add-dialog';
import { getPurchaseOrderDerivedStatus } from '@/services/purchaseOrderStatus';
import { StatusBadge } from '@/components/ui/status-badge';
import { SmartSearchSelect } from '@/components/common/SmartSearchSelect';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};
const formatCurrency = (value: number | string | null | undefined) => `$${toNumber(value).toFixed(2)}`;
const BROWSE_PARTS_PAGE_SIZE = 25;

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const repos = useRepos();
  const {
    purchaseOrders,
    createPurchaseOrder,
    poAddLine,
    poRemoveLine,
    poReceive,
    poClose,
    getPurchaseOrderLines,
    updatePurchaseOrderLinks,
  } = repos.purchaseOrders;
  const { vendors } = repos.vendors;
  const { categories } = repos.categories;
  const { parts, addPart } = repos.parts;
  const { salesOrders } = repos.salesOrders;
  const { workOrders } = repos.workOrders;
  const { customers } = repos.customers;
  const { units } = repos.units;
  const { getReturnsByPurchaseOrder, createReturn } = repos.returns;
  const { toast } = useToast();

  const isNew = id === 'new';
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [order, setOrder] = useState(() => (!isNew ? purchaseOrders.find((o) => o.id === id) : null));

  const [addPartOpen, setAddPartOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [newPartDialogOpen, setNewPartDialogOpen] = useState(false);
  const [newPartData, setNewPartData] = useState({
    part_number: '',
    description: '',
    vendor_id: '',
    category_id: '',
    cost: '',
    selling_price: '',
  });
  const [isBrowsePartsOpen, setIsBrowsePartsOpen] = useState(false);
  const [browsePartsInStockOnly, setBrowsePartsInStockOnly] = useState(false);
  const [browsePartsPage, setBrowsePartsPage] = useState(0);

  const [receiveLineId, setReceiveLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [linkSalesOrderId, setLinkSalesOrderId] = useState('');
  const [linkWorkOrderId, setLinkWorkOrderId] = useState('');
  const [openSalesOrderPicker, setOpenSalesOrderPicker] = useState(false);
  const [openWorkOrderPicker, setOpenWorkOrderPicker] = useState(false);
  const [soQuery, setSoQuery] = useState('');
  const [woQuery, setWoQuery] = useState('');
  const [soStatusFilter, setSoStatusFilter] = useState<'all' | 'open' | 'estimate' | 'invoiced'>('open');
  const [woStatusFilter, setWoStatusFilter] = useState<'all' | 'open' | 'estimate' | 'invoiced'>('open');
  const [showLinkConflictDialog, setShowLinkConflictDialog] = useState(false);
  const [showInvoicedDialog, setShowInvoicedDialog] = useState(false);

  const currentOrder = order || purchaseOrders.find((o) => o.id === id);
  const activeVendors = vendors.filter((v) => v.is_active);
  const activeParts = parts.filter((p) => p.is_active);
  const isClosed = currentOrder?.status === 'CLOSED';
  const poPartPickerItems = useMemo(
    () =>
      activeParts.map((part) => {
        const partNumber = (part.part_number ?? '').toString();
        const description = part.description ?? '';
        const vendor = (part as any).vendor_label ?? (part as any).vendor_name ?? '';
        const category = (part as any).category_label ?? (part as any).category_name ?? '';
        const rawSearchText = [partNumber, description, vendor, category].filter(Boolean).join(' ').toLowerCase();
        const labelParts = [partNumber, description].filter(Boolean);
        return {
          id: String(part.id),
          label: labelParts.length ? labelParts.join(' – ') : 'Unnamed part',
          searchText: rawSearchText,
          meta: { vendor, category },
        };
      }),
    [activeParts]
  );
  const browseableParts = useMemo(
    () =>
      activeParts.filter((part) => {
        if (browsePartsInStockOnly) {
          const qoh = (part as any).quantity_on_hand ?? 0;
          if (qoh <= 0) return false;
        }
        return true;
      }),
    [activeParts, browsePartsInStockOnly]
  );
  const pagedBrowseParts = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(browseableParts.length / BROWSE_PARTS_PAGE_SIZE));
    const clampedPage = Math.min(Math.max(browsePartsPage, 0), totalPages - 1);
    const start = clampedPage * BROWSE_PARTS_PAGE_SIZE;
    const end = start + BROWSE_PARTS_PAGE_SIZE;
    return {
      items: browseableParts.slice(start, end),
      totalPages,
      page: clampedPage,
    };
  }, [browsePartsPage, browseableParts]);

  if (!isNew && !currentOrder) {
    return (
      <div className="page-container">
        <PageHeader title="PO Not Found" backTo="/purchase-orders" />
        <p className="text-muted-foreground">This purchase order does not exist.</p>
      </div>
    );
  }

  const handleCreate = () => {
    if (!selectedVendorId) {
      toast({ title: 'Error', description: 'Please select a vendor', variant: 'destructive' });
      return;
    }
    const newOrder = createPurchaseOrder(selectedVendorId);
    navigate(`/purchase-orders/${newOrder.id}`, { replace: true });
    setOrder(newOrder);
    toast({ title: 'PO Created', description: `${newOrder.po_number} created` });
  };

  const handleAddPart = () => {
    if (!selectedPartId || !currentOrder) return;
    const result = poAddLine(currentOrder.id, selectedPartId, parseInt(partQty) || 1);
    if (result.success) {
      toast({ title: 'Part Added' });
      setAddPartOpen(false);
      setSelectedPartId('');
      setPartQty('1');
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleReceive = () => {
    if (!receiveLineId) return;
    const result = poReceive(receiveLineId, parseInt(receiveQty) || 0);
    if (result.success) {
      toast({ title: 'Items Received', description: 'Inventory has been updated' });
      setReceiveLineId(null);
      setReceiveQty('');
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleClose = () => {
    if (!currentOrder) return;
    const result = poClose(currentOrder.id);
    if (result.success) {
      toast({ title: 'PO Closed' });
      setShowCloseDialog(false);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };
  const handleQuickAddPart = () => {
    if (!newPartData.part_number.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Part number is required',
        variant: 'destructive',
      });
      return;
    }
    if (!newPartData.vendor_id) {
      toast({
        title: 'Validation Error',
        description: 'Vendor is required',
        variant: 'destructive',
      });
      return;
    }
    if (!newPartData.category_id) {
      toast({
        title: 'Validation Error',
        description: 'Category is required',
        variant: 'destructive',
      });
      return;
    }

    const exists = parts.some(
      (p) => (p.part_number || '').toLowerCase() === newPartData.part_number.trim().toLowerCase()
    );
    if (exists) {
      toast({
        title: 'Validation Error',
        description: 'A part with this number already exists',
        variant: 'destructive',
      });
      return;
    }

    const partNumber = newPartData.part_number.trim().toUpperCase();
    const newPart = addPart({
      part_number: partNumber,
      description: newPartData.description.trim() || null,
      vendor_id: newPartData.vendor_id,
      category_id: newPartData.category_id,
      cost: parseFloat(newPartData.cost) || 0,
      selling_price: parseFloat(newPartData.selling_price) || 0,
      quantity_on_hand: 0,
      core_required: false,
      core_charge: 0,
      min_qty: null,
      max_qty: null,
      bin_location: null,
      model: null,
      serial_number: null,
      is_kit: false,
      barcode: null,
    });

    toast({
      title: 'Part Created',
      description: `${partNumber} has been added`,
    });
    setNewPartDialogOpen(false);
    setNewPartData({
      part_number: '',
      description: '',
      vendor_id: '',
      category_id: '',
      cost: '',
      selling_price: '',
    });
    setSelectedPartId(newPart.id);
  };

  const lines = useMemo(
    () => (currentOrder ? getPurchaseOrderLines(currentOrder.id) : []),
    [currentOrder, getPurchaseOrderLines]
  );
  const vendor = vendors.find((v) => v.id === currentOrder?.vendor_id);
  const allReceived = lines.length > 0 && lines.every((l) => l.received_quantity >= l.ordered_quantity);
  const derivedStatus = currentOrder ? getPurchaseOrderDerivedStatus(currentOrder, lines) : 'OPEN';
  const linksLocked = derivedStatus === 'PARTIALLY_RECEIVED' || derivedStatus === 'RECEIVED';
  const lineSummary = useMemo(() => {
    const totals = {
      totalLines: lines.length,
      totalOrdered: 0,
      totalReceived: 0,
      totalRemaining: 0,
      totalCost: 0,
    };

    lines.forEach((line) => {
      totals.totalOrdered += line.ordered_quantity;
      totals.totalReceived += line.received_quantity;
      const remaining = Math.max(line.ordered_quantity - line.received_quantity, 0);
      totals.totalRemaining += remaining;
      totals.totalCost += (line.unit_cost ?? 0) * line.ordered_quantity;
    });

    return totals;
  }, [lines]);
  const linksDirty =
    linkSalesOrderId !== (currentOrder?.sales_order_id || '') ||
    linkWorkOrderId !== (currentOrder?.work_order_id || '');
  const hasRemainingQty = lineSummary.totalRemaining > 0;
  const derivedStatusLabel =
    derivedStatus === 'PARTIALLY_RECEIVED'
      ? 'Partially Received'
      : derivedStatus === 'RECEIVED'
      ? 'Received'
      : 'Open';
  const tableColumnCount = 6 + (isClosed ? 0 : 1);
  const linkStatusMessage = linksLocked
    ? 'Links locked once a PO is partially received or received.'
    : linksDirty
    ? 'Unsaved link changes.'
    : 'Links are synced.';
  const linkStatusBadge = linksLocked ? 'Locked' : linksDirty ? 'Unsaved' : 'Synced';

  useEffect(() => {
    setLinkSalesOrderId(currentOrder?.sales_order_id || '');
    setLinkWorkOrderId(currentOrder?.work_order_id || '');
  }, [currentOrder?.sales_order_id, currentOrder?.work_order_id]);
  useEffect(() => {
    setBrowsePartsPage(0);
  }, [browsePartsInStockOnly]);

  const getSalesOrderLabel = (id: string) => {
    if (!id) return 'None';
    const so = salesOrders.find((s) => s.id === id);
    if (!so) return 'None';
    const number = so.order_number || so.id;
    const displayNumber = number.startsWith('SO-') ? number : `SO-${number}`;
    return `${displayNumber} (${so.status})`;
  };

  const getWorkOrderLabel = (id: string) => {
    if (!id) return 'None';
    const wo = workOrders.find((w) => w.id === id);
    if (!wo) return 'None';
    const number = wo.order_number || wo.id;
    const displayNumber = number.startsWith('WO-') ? number : `WO-${number}`;
    return `${displayNumber} (${wo.status})`;
  };

  const workOrderOptions = useMemo(() => {
    const query = woQuery.trim().toLowerCase();
    const allowedStatuses = new Set(['ESTIMATE', 'OPEN', 'IN_PROGRESS', 'INVOICED']);
    const statusFilterSet =
      woStatusFilter === 'all'
        ? allowedStatuses
        : woStatusFilter === 'open'
        ? new Set(['OPEN', 'IN_PROGRESS'])
        : new Set([woStatusFilter.toUpperCase()]);
    return workOrders
      .filter((wo) => allowedStatuses.has(wo.status) && (wo as any).is_active !== false)
      .filter((wo) => statusFilterSet.has(wo.status))
      .map((wo) => {
        const number = wo.order_number || wo.id;
        const label = `${number} (${wo.status})`;
        const searchText = label.toLowerCase();
        return { id: wo.id, label, searchText };
      })
      .filter((opt) => (!query ? true : opt.searchText.includes(query)));
  }, [workOrders, woQuery, woStatusFilter]);

  const salesOrderOptions = useMemo(() => {
    const query = soQuery.trim().toLowerCase();
    const allowedStatuses = new Set(['OPEN', 'ESTIMATE', 'INVOICED']);
    const statusFilterSet =
      soStatusFilter === 'all'
        ? allowedStatuses
        : soStatusFilter === 'open'
        ? new Set(['OPEN', 'ESTIMATE'])
        : new Set([soStatusFilter.toUpperCase()]);
    return salesOrders
      .filter((so) => allowedStatuses.has(so.status) && (so as any).is_active !== false)
      .filter((so) => statusFilterSet.has(so.status))
      .map((so) => {
        const number = so.order_number || so.id;
        const label = `${number} (${so.status})`;
        const searchText = label.toLowerCase();
        return { id: so.id, label, searchText };
      })
      .filter((opt) => (!query ? true : opt.searchText.includes(query)));
  }, [salesOrders, soQuery, soStatusFilter]);

  const conflictingSalesOrderPo = useMemo(() => {
    if (!linkSalesOrderId || !currentOrder) return null;
    return purchaseOrders.find((po) => po.id !== currentOrder.id && po.sales_order_id === linkSalesOrderId) || null;
  }, [currentOrder, linkSalesOrderId, purchaseOrders]);

  const conflictingWorkOrderPo = useMemo(() => {
    if (!linkWorkOrderId || !currentOrder) return null;
    return purchaseOrders.find((po) => po.id !== currentOrder.id && po.work_order_id === linkWorkOrderId) || null;
  }, [currentOrder, linkWorkOrderId, purchaseOrders]);

  const isSelectedSalesOrderInvoiced = useMemo(() => {
    if (!linkSalesOrderId) return false;
    const so = salesOrders.find((s) => s.id === linkSalesOrderId);
    return so?.status === 'INVOICED';
  }, [linkSalesOrderId, salesOrders]);

  const isSelectedWorkOrderInvoiced = useMemo(() => {
    if (!linkWorkOrderId) return false;
    const wo = workOrders.find((w) => w.id === linkWorkOrderId);
    return wo?.status === 'INVOICED';
  }, [linkWorkOrderId, workOrders]);

  const linkedSalesOrder = useMemo(() => {
    const idToUse = linkSalesOrderId || currentOrder?.sales_order_id;
    return idToUse ? salesOrders.find((s) => s.id === idToUse) : null;
  }, [currentOrder?.sales_order_id, linkSalesOrderId, salesOrders]);

  const linkedWorkOrder = useMemo(() => {
    const idToUse = linkWorkOrderId || currentOrder?.work_order_id;
    return idToUse ? workOrders.find((w) => w.id === idToUse) : null;
  }, [currentOrder?.work_order_id, linkWorkOrderId, workOrders]);

  const linkedSalesCustomer = linkedSalesOrder ? customers.find((c) => c.id === linkedSalesOrder.customer_id) : null;
  const linkedWorkCustomer = linkedWorkOrder ? customers.find((c) => c.id === linkedWorkOrder.customer_id) : null;
  const linkedWorkUnit = linkedWorkOrder ? units.find((u) => u.id === linkedWorkOrder.unit_id) : null;
  const linkedWorkUnitLabel = useMemo(() => {
    if (!linkedWorkUnit) return '-';
    return (
      linkedWorkUnit.unit_name ||
      [linkedWorkUnit.year, linkedWorkUnit.make, linkedWorkUnit.model].filter(Boolean).join(' ') ||
      linkedWorkUnit.vin ||
      '-'
    );
  }, [linkedWorkUnit]);
  const poReturns = useMemo(
    () => (currentOrder ? getReturnsByPurchaseOrder(currentOrder.id) : []),
    [currentOrder, getReturnsByPurchaseOrder]
  );

  const handleSaveLinks = () => {
    if (!currentOrder) return;
    if (isSelectedSalesOrderInvoiced || isSelectedWorkOrderInvoiced) {
      setShowInvoicedDialog(true);
      return;
    }
    if (conflictingSalesOrderPo || conflictingWorkOrderPo) {
      setShowLinkConflictDialog(true);
      return;
    }
    performSaveLinks();
  };

  const handleCreateReturnForPo = () => {
    if (!currentOrder?.vendor_id) {
      toast({ title: 'Vendor required', description: 'Cannot create a return without a vendor.', variant: 'destructive' });
      return;
    }
    const ret = createReturn({
      vendor_id: currentOrder.vendor_id,
      purchase_order_id: currentOrder.id,
    });
    if (ret) {
      navigate(`/returns/${ret.id}`);
    }
  };

  const performSaveLinks = () => {
    if (!currentOrder) return;
    updatePurchaseOrderLinks(currentOrder.id, {
      sales_order_id: linkSalesOrderId || null,
      work_order_id: linkWorkOrderId || null,
    });
    toast({ title: 'Links Updated', description: 'Purchase order links saved' });
  };

  if (isNew && !order) {
    return (
      <div className="page-container">
        <PageHeader title="New Purchase Order" backTo="/purchase-orders" />
        <div className="form-section max-w-xl">
          <div className="space-y-4">
            <div>
              <Label>Vendor *</Label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {activeVendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.vendor_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Create PO
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title={currentOrder?.po_number || 'Purchase Order'}
        subtitle={
          <div className="flex items-center gap-2">
            <StatusBadge status={currentOrder?.status || 'OPEN'} />
            <Badge variant="outline" className="text-xs uppercase tracking-wide">
              {derivedStatusLabel}
            </Badge>
          </div>
        }
        description={
          <p className="text-xs text-muted-foreground">
            Vendor: {vendor?.vendor_name || 'Unassigned vendor'}
          </p>
        }
        backTo="/purchase-orders"
        actions={
          <div className="flex items-center gap-2">
            {currentOrder && hasRemainingQty && (
              <Button size="sm" onClick={() => navigate(`/receiving?poId=${currentOrder.id}`)}>
                Receive
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setAddPartOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Part
            </Button>
            {allReceived && (
              <Button size="sm" variant="outline" onClick={() => setShowCloseDialog(true)}>
                Close PO
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="px-2 py-1">
          Lines {lineSummary.totalLines}
        </Badge>
        <Badge variant="outline" className="px-2 py-1">
          Ordered {lineSummary.totalOrdered}
        </Badge>
        <Badge variant="outline" className="px-2 py-1">
          Received {lineSummary.totalReceived}
        </Badge>
        <Badge variant={lineSummary.totalRemaining > 0 ? 'destructive' : 'secondary'} className="px-2 py-1">
          Remaining {lineSummary.totalRemaining}
        </Badge>
        <Badge variant="outline" className="px-2 py-1">
          Total Cost {formatCurrency(lineSummary.totalCost)}
        </Badge>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="grid grid-cols-12 gap-x-4 gap-y-4">
            <div className="col-span-12 lg:col-span-4">
              <div className="flex items-center justify-between h-5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground leading-none">Vendor</span>
                <span aria-hidden="true" className="text-xs leading-none invisible">
                  .
                </span>
              </div>
              <div className="mt-2">
                <Input
                  value={vendor?.vendor_name || 'Unassigned vendor'}
                  disabled
                  readOnly
                  className="h-10 w-full"
                />
              </div>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <div className="flex items-center justify-between h-5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground leading-none">
                  Linked Sales Order
                </span>
                {linkedSalesOrder ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 leading-none h-5"
                    onClick={() => navigate(`/sales-orders/${linkedSalesOrder.id}`)}
                  >
                    View
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground leading-none opacity-70">None</span>
                )}
              </div>
              <div className="mt-2">
                <Popover open={openSalesOrderPicker} onOpenChange={setOpenSalesOrderPicker}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openSalesOrderPicker}
                      className="w-full justify-between h-10"
                      disabled={linksLocked}
                    >
                      {getSalesOrderLabel(linkSalesOrderId)}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-72">
                    <div className="border-b p-2 flex flex-wrap items-center gap-2 max-w-full">
                      {(['all', 'open', 'estimate', 'invoiced'] as const).map((filter) => (
                        <Button
                          key={filter}
                          size="sm"
                          variant={soStatusFilter === filter ? 'default' : 'outline'}
                          onClick={() => setSoStatusFilter(filter)}
                          className="shrink-0"
                        >
                          {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </Button>
                      ))}
                    </div>
                    <Command>
                      <CommandInput
                        placeholder="Search sales orders..."
                        value={soQuery}
                        onValueChange={setSoQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No sales orders found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__NONE__"
                            onSelect={(value) => {
                              setLinkSalesOrderId(value === '__NONE__' ? '' : value);
                              setOpenSalesOrderPicker(false);
                            }}
                          >
                            None
                          </CommandItem>
                          {salesOrderOptions.map((so) => (
                            <CommandItem
                              key={so.id}
                              value={so.searchText}
                              onSelect={() => {
                                setLinkSalesOrderId(so.id);
                                setOpenSalesOrderPicker(false);
                              }}
                            >
                              {so.label}
                            </CommandItem>
                          ))}
                          {salesOrderOptions.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No results</div>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {conflictingSalesOrderPo && (
                <p className="text-xs text-destructive">
                  This sales order is already linked to PO {conflictingSalesOrderPo.po_number || conflictingSalesOrderPo.id}.
                </p>
              )}
            </div>
            <div className="col-span-12 lg:col-span-3">
              <div className="flex items-center justify-between h-5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground leading-none">
                  Linked Work Order
                </span>
                {linkedWorkOrder ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 leading-none h-5"
                    onClick={() => navigate(`/work-orders/${linkedWorkOrder.id}`)}
                  >
                    View
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground leading-none opacity-70">None</span>
                )}
              </div>
              <div className="mt-2">
                <Popover open={openWorkOrderPicker} onOpenChange={setOpenWorkOrderPicker}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openWorkOrderPicker}
                      className="w-full justify-between h-10"
                      disabled={linksLocked}
                    >
                      {getWorkOrderLabel(linkWorkOrderId)}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-72">
                    <div className="border-b p-2 flex flex-wrap items-center gap-2 max-w-full">
                      {(['all', 'open', 'estimate', 'invoiced'] as const).map((filter) => (
                        <Button
                          key={filter}
                          size="sm"
                          variant={woStatusFilter === filter ? 'default' : 'outline'}
                          onClick={() => setWoStatusFilter(filter)}
                          className="shrink-0"
                        >
                          {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </Button>
                      ))}
                    </div>
                    <Command>
                      <CommandInput
                        placeholder="Search work orders..."
                        value={woQuery}
                        onValueChange={setWoQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No work orders found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__NONE__"
                            onSelect={(value) => {
                              setLinkWorkOrderId(value === '__NONE__' ? '' : value);
                              setOpenWorkOrderPicker(false);
                            }}
                          >
                            None
                          </CommandItem>
                          {workOrderOptions.map((wo) => (
                            <CommandItem
                              key={wo.id}
                              value={wo.searchText}
                              onSelect={() => {
                                setLinkWorkOrderId(wo.id);
                                setOpenWorkOrderPicker(false);
                              }}
                            >
                              {wo.label}
                            </CommandItem>
                          ))}
                          {workOrderOptions.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No results</div>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {conflictingWorkOrderPo && (
                <p className="text-xs text-destructive">
                  This work order is already linked to PO {conflictingWorkOrderPo.po_number || conflictingWorkOrderPo.id}.
                </p>
              )}
            </div>
            <div className="col-span-12 space-y-1">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Link Status</p>
                  <p className="text-sm text-muted-foreground">{linkStatusMessage}</p>
                </div>
                <Badge variant="outline" className="text-[11px] h-6 px-2 py-0.5 uppercase tracking-wide">
                  {linkStatusBadge}
                </Badge>
              </div>
            </div>
          </div>
          {linksDirty && (
            <div className="mt-4 border-t border-border pt-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={handleSaveLinks} disabled={linksLocked}>
                Save Links
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.15fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">PO Lines</CardTitle>
            <Badge variant="secondary" className="text-xs px-2 py-1">
              {lineSummary.totalLines} lines
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part #</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    {!isClosed && <TableHead className="text-right w-32">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={tableColumnCount} className="text-center py-8 text-muted-foreground space-y-3">
                        <p>No parts added yet.</p>
                        <Button size="sm" variant="outline" onClick={() => setAddPartOpen(true)}>
                          <Plus className="w-3 h-3 mr-1" />
                          Add Part
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line) => {
                      const part = parts.find((p) => p.id === line.part_id);
                      const remaining = Math.max(line.ordered_quantity - line.received_quantity, 0);
                      const cost = line.unit_cost ?? 0;
                      return (
                        <TableRow key={line.id}>
                          <TableCell className="font-mono">{part?.part_number}</TableCell>
                          <TableCell>{part?.description || '-'}</TableCell>
                          <TableCell className="text-right">{line.ordered_quantity}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-mono">{line.received_quantity}</span>
                              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                {line.received_quantity}/{line.ordered_quantity}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={remaining > 0 ? 'destructive' : 'secondary'} className="text-xs px-2 py-0.5">
                              {remaining}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(cost)}</TableCell>
                          {!isClosed && (
                            <TableCell>
                              <div className="flex items-center justify-end gap-2">
                                {remaining > 0 ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setReceiveLineId(line.id);
                                      setReceiveQty(String(remaining));
                                    }}
                                  >
                                    <PackageCheck className="w-3 h-3 mr-1" />
                                    Receive
                                  </Button>
                                ) : (
                                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                    Received
                                  </Badge>
                                )}
                                {line.received_quantity === 0 && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => poRemoveLine(line.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Returns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {poReturns.length === 0 ? (
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>No returns linked to this PO.</span>
                <Button size="sm" variant="outline" onClick={handleCreateReturnForPo}>
                  Create Return
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {poReturns.map((ret) => (
                  <div key={ret.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{ret.rma_number || ret.id}</span>
                      <StatusBadge status={ret.status} />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/returns/${ret.id}`)}>
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showInvoicedDialog} onOpenChange={setShowInvoicedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Linking to an Invoiced Order</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to link this Purchase Order to an invoiced Sales/Work Order. This is allowed, but double-check it's intentional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowInvoicedDialog(false);
                if (conflictingSalesOrderPo || conflictingWorkOrderPo) {
                  setShowLinkConflictDialog(true);
                  return;
                }
                performSaveLinks();
              }}
            >
              Link Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLinkConflictDialog} onOpenChange={setShowLinkConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Link Overrides</AlertDialogTitle>
            <AlertDialogDescription>
              The selected order(s) are already linked to another purchase order. Saving will override those links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            {conflictingSalesOrderPo && (
              <p className="text-sm">
                Sales Order currently linked to PO {conflictingSalesOrderPo.po_number || conflictingSalesOrderPo.id}.
              </p>
            )}
            {conflictingWorkOrderPo && (
              <p className="text-sm">
                Work Order currently linked to PO {conflictingWorkOrderPo.po_number || conflictingWorkOrderPo.id}.
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLinkConflictDialog(false);
                performSaveLinks();
              }}
            >
              Save Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Add Part Dialog */}
      <Dialog open={addPartOpen} onOpenChange={setAddPartOpen}>
        <DialogContent className="max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle>Add Part to PO</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Part *</Label>
              <div className="flex items-center gap-2">
                <SmartSearchSelect
                  className="flex-1 min-w-0"
                  value={selectedPartId || null}
                  onChange={(id) => setSelectedPartId(id ?? '')}
                  items={poPartPickerItems}
                  placeholder="Search parts by # or description..."
                  minChars={2}
                  limit={25}
                  renderItem={(item) => (
                    <div className="flex flex-col">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.meta?.vendor && `${item.meta.vendor} · `}
                        {String(item.meta?.category ?? '')}
                      </span>
                    </div>
                  )}
                />
                <Button
                  variant="outline"
                  className="flex-shrink-0"
                  type="button"
                  onClick={() => setIsBrowsePartsOpen(true)}
                >
                  Browse parts
                </Button>
                <Button
                  variant="outline"
                  className="flex-shrink-0"
                  type="button"
                  onClick={() => setNewPartDialogOpen(true)}
                >
                  New Part
                </Button>
              </div>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={partQty}
                onChange={(e) => setPartQty(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPartOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPart}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBrowsePartsOpen} onOpenChange={setIsBrowsePartsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Browse Parts</DialogTitle>
            <DialogDescription>Find parts by browsing without loading the entire catalog.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-2">
              Viewing all active parts. Use the in-stock filter and pagination to browse.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={browsePartsInStockOnly}
                  onCheckedChange={setBrowsePartsInStockOnly}
                  id="po-browse-in-stock"
                />
                <Label htmlFor="po-browse-in-stock" className="text-sm">
                  In stock only
                </Label>
              </div>
            </div>

            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part #</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>QOH</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedBrowseParts.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No parts found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedBrowseParts.items.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.part_number}</TableCell>
                        <TableCell>{p.description}</TableCell>
                        <TableCell>{(p as any).vendor_label ?? (p as any).vendor_name ?? '—'}</TableCell>
                        <TableCell>{(p as any).category_label ?? (p as any).category_name ?? '—'}</TableCell>
                        <TableCell>{(p as any).quantity_on_hand ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPartId(p.id);
                              setIsBrowsePartsOpen(false);
                            }}
                          >
                            Select
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>
                Page {pagedBrowseParts.page + 1} of {pagedBrowseParts.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBrowsePartsPage((p) => Math.max(0, p - 1))}
                  disabled={pagedBrowseParts.page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBrowsePartsPage((p) => Math.min(pagedBrowseParts.totalPages - 1, p + 1))}
                  disabled={pagedBrowseParts.page >= pagedBrowseParts.totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBrowsePartsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddDialog
        open={newPartDialogOpen}
        onOpenChange={setNewPartDialogOpen}
        title="New Part"
        onSave={handleQuickAddPart}
        onCancel={() => setNewPartDialogOpen(false)}
      >
        <div className="space-y-3">
          <div>
            <Label>Part Number *</Label>
            <Input
              value={newPartData.part_number}
              onChange={(e) => setNewPartData({ ...newPartData, part_number: e.target.value.toUpperCase() })}
              placeholder="e.g., BRK-001"
              className="font-mono"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={newPartData.description}
              onChange={(e) => setNewPartData({ ...newPartData, description: e.target.value })}
              placeholder="Part description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vendor *</Label>
              <Select
                value={newPartData.vendor_id}
                onValueChange={(value) => setNewPartData({ ...newPartData, vendor_id: value })}
              >
                <SelectTrigger>
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
            </div>
            <div>
              <Label>Category *</Label>
              <Select
                value={newPartData.category_id}
                onValueChange={(value) => setNewPartData({ ...newPartData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c.is_active)
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.category_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={newPartData.cost}
                onChange={(e) => setNewPartData({ ...newPartData, cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Selling Price</Label>
              <Input
                type="number"
                step="0.01"
                value={newPartData.selling_price}
                onChange={(e) => setNewPartData({ ...newPartData, selling_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </QuickAddDialog>

      {/* Receive Dialog */}
      <QuickAddDialog
        open={!!receiveLineId}
        onOpenChange={(o) => !o && setReceiveLineId(null)}
        title="Receive Items"
        onSave={handleReceive}
        onCancel={() => setReceiveLineId(null)}
      >
        <div>
          <Label>Quantity to Receive</Label>
          <Input
            type="number"
            min="1"
            value={receiveQty}
            onChange={(e) => setReceiveQty(e.target.value)}
          />
        </div>
      </QuickAddDialog>

      {/* Close PO Dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Purchase Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently lock the PO. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose}>Close PO</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
