import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRepos } from '@/repos';
import { useToast } from '@/hooks/use-toast';
import { Save, Plus, Trash2, FileCheck, Printer, Edit, X, Shield, RotateCcw, Check, Pencil, X as XIcon, Sparkles } from 'lucide-react';
import { QuickAddDialog } from '@/components/ui/quick-add-dialog';
import { PrintSalesOrder, PrintSalesOrderPickList } from '@/components/print/PrintInvoice';
import { calcPartPriceForLevel, getPartCostBasis } from '@/domain/pricing/partPricing';
import { getPurchaseOrderDerivedStatus } from '@/services/purchaseOrderStatus';
import { StatusBadge } from '@/components/ui/status-badge';
import { PurchaseOrderPreviewDialog } from '@/components/purchase-orders/PurchaseOrderPreviewDialog';
import type { SalesOrderStatus } from '@/types';
import { usePayments } from '@/hooks/usePayments';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { SmartSearchSelect } from '@/components/common/SmartSearchSelect';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AIAssistPanel } from '@/components/ai/AIAssistPanel';
import { suggestParts } from '@/services/aiAssist/aiAssistPreview';
import { ResponsiveDataList } from '@/components/common/ResponsiveDataList';
import { AdaptiveDialog } from '@/components/common/AdaptiveDialog';
import { MobileActionBar, MobileActionBarSpacer } from '@/components/common/MobileActionBar';
import { useIsMobile } from '@/hooks/useIsMobile';

const BROWSE_PARTS_PAGE_SIZE = 25;

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' },
  { value: 'other', label: 'Other' },
];

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const repos = useRepos();
  const {
    salesOrders,
    getSalesOrderLines,
    createSalesOrder,
    soAddPartLine,
    soUpdatePartQty,
    soUpdateLineUnitPrice,
    soRemovePartLine,
    soToggleWarranty,
    soToggleCoreReturned,
    soConvertToOpen,
    soInvoice,
    soSetStatus,
    updateSalesOrderNotes,
    getSalesOrderChargeLines,
    addSalesOrderChargeLine,
    updateSalesOrderChargeLine,
    removeSalesOrderChargeLine,
  } = repos.salesOrders;
  const { purchaseOrders, purchaseOrderLines } = repos.purchaseOrders;
  const { customers, addCustomer } = repos.customers;
  const { units } = repos.units;
  const { parts, addPart } = repos.parts;
  const { vendors } = repos.vendors;
  const { categories } = repos.categories;
  const { settings } = repos.settings;
  const { toast } = useToast();

  const unitFromQuery = searchParams.get('unit_id') || '';
  const createdParam = searchParams.get('created');
  const location = useLocation();
  const NONE_UNIT = '__NONE__';
  const isNew = id === 'new';
  const [selectedCustomerId, setSelectedCustomerId] = useState(searchParams.get('customer_id') || '');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(unitFromQuery || null);
  const [order, setOrder] = useState(() => {
    if (!isNew) return salesOrders.find((o) => o.id === id);
    return null;
  });

  const [addPartDialogOpen, setAddPartDialogOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [aiPartsQuery, setAiPartsQuery] = useState('');
  const [newPartDialogOpen, setNewPartDialogOpen] = useState(false);
  const [newPartData, setNewPartData] = useState({
    part_number: '',
    description: '',
    vendor_id: '',
    category_id: '',
    cost: '',
    selling_price: '',
  });

  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [editingPriceLineId, setEditingPriceLineId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<string>('');
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  
  const toNumber = (value: number | string | null | undefined) => {
    const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
    return Number.isFinite(numeric) ? numeric : 0;
  };
  const formatMoney = (value: number | string | null | undefined) => toNumber(value).toFixed(2);
  const aiAssistEnabled = (import.meta as any).env?.VITE_AI_ASSIST_PREVIEW === 'true';
  const isMobile = useIsMobile();

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [aiOriginalNote, setAiOriginalNote] = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const initialFocusRequested = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showCoreReturnDialog, setShowCoreReturnDialog] = useState(false);
  const [coreReturnLineId, setCoreReturnLineId] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<'invoice' | 'picklist'>('invoice');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'card' | 'ach' | 'other'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isBrowsePartsOpen, setIsBrowsePartsOpen] = useState(false);
  const [browsePartsInStockOnly, setBrowsePartsInStockOnly] = useState(false);
  const [browsePartsPage, setBrowsePartsPage] = useState(0);
  const [isBrowseCustomersOpen, setIsBrowseCustomersOpen] = useState(false);
  const [browseCustomersActiveOnly, setBrowseCustomersActiveOnly] = useState(true);
  const [browseCustomersPage, setBrowseCustomersPage] = useState(0);

  const currentOrder = salesOrders.find((o) => o.id === id) || order;
  const customer = customers.find((c) => c.id === (currentOrder?.customer_id || selectedCustomerId));
  const unit = units.find((u) => u.id === (currentOrder?.unit_id || selectedUnitId));

  const activeCustomers = customers.filter((c) => c.is_active);
  const browseableCustomers = useMemo(
    () =>
      customers.filter((c) => {
        if (browseCustomersActiveOnly) {
          if (c.is_active === false) return false;
        }
        if ((c as any).is_walk_in) return false;
        return true;
      }),
    [customers, browseCustomersActiveOnly]
  );
  const BROWSE_CUSTOMERS_PAGE_SIZE = 25;
  const totalBrowseCustomerPages = Math.max(1, Math.ceil(browseableCustomers.length / BROWSE_CUSTOMERS_PAGE_SIZE));
  const safeBrowseCustomersPage = Math.min(browseCustomersPage, totalBrowseCustomerPages - 1);
  const browseCustomersStart = safeBrowseCustomersPage * BROWSE_CUSTOMERS_PAGE_SIZE;
  const browseCustomersEnd = browseCustomersStart + BROWSE_CUSTOMERS_PAGE_SIZE;
  const pagedBrowseCustomers = browseableCustomers.slice(browseCustomersStart, browseCustomersEnd);
  useEffect(() => {
    setBrowseCustomersPage(0);
  }, [browseCustomersActiveOnly]);
  const customerPickerItems = useMemo(
    () =>
      activeCustomers.map((c) => {
        const company = (c as any).company_name ?? '';
        const contact = (c as any).contact_name ?? '';
        const phone = c.phone ?? '';
        const email = c.email ?? '';
        const street =
          (c as any).street_1 ??
          (c as any).street ??
          (c as any).address ??
          '';
        const city = (c as any).city ?? '';
        const state = (c as any).state ?? '';
        const postal = (c as any).postal_code ?? '';

        const primaryParts = [company, contact, phone].filter(Boolean);
        const secondaryParts = [email, street, city, state, postal].filter(Boolean);

        const baseLabel =
          primaryParts.length > 0
            ? primaryParts.join(' • ')
            : 'Unnamed customer';

        const label =
          secondaryParts.length > 0
            ? `${baseLabel} — ${secondaryParts.join(', ')}`
            : baseLabel;

        const searchText = [company, contact, phone, email, street, city, state, postal]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return {
          id: String(c.id),
          label,
          searchText,
        };
      }),
    [activeCustomers]
  );
  const customerUnits = useMemo(() => {
    if (!selectedCustomerId || selectedCustomerId === 'walkin') return [];
    return units.filter((u) => u.customer_id === selectedCustomerId && u.is_active);
  }, [selectedCustomerId, units]);
  const customerItems = useMemo(
    () =>
      activeCustomers.map((c) => {
        const phone = (c as any).phone ? String((c as any).phone).replace(/\D/g, '') : '';
        const contact = `${(c as any).first_name ?? ''} ${(c as any).last_name ?? ''}`.trim();
        const label = c.company_name || 'Customer';
        const detail = (c as any).city ? ` – ${(c as any).city}` : phone ? ` – ${phone}` : '';
        return {
          id: c.id,
          label: `${label}${detail}`,
          searchText: `${(c.company_name || '').toLowerCase()} ${phone.toLowerCase()} ${contact.toLowerCase()}`,
        };
      }),
    [activeCustomers]
  );
  const unitItems = useMemo(
    () =>
      customerUnits.map((u) => ({
        id: u.id,
        label: `${u.unit_name}${u.vin ? ` – ${u.vin.slice(-6)}` : ''}`,
        searchText: `${(u.unit_name || '').toLowerCase()} ${(u.vin || '').toLowerCase()} ${((u as any).license_plate || '').toLowerCase()}`,
      })),
    [customerUnits]
  );
  const activeParts = parts.filter((p) => p.is_active);
  const aiPartSuggestions = useMemo(
    () => (aiAssistEnabled ? suggestParts(aiPartsQuery, activeParts) : []),
    [aiAssistEnabled, aiPartsQuery, activeParts]
  );
  const partPickerItems = useMemo(
    () =>
      activeParts.map((part) => {
        const partNumber = (part.part_number ?? (part as any).partNumber ?? '').toString();
        const description = part.description ?? (part as any).part_description ?? '';
        const vendor =
          (part as any).vendor_label ??
          (part as any).vendor_name ??
          (part as any).vendor ??
          '';
        const category =
          (part as any).category_label ??
          (part as any).category_name ??
          (part as any).category ??
          '';

        const labelParts = [partNumber, description].filter(Boolean);
        const label = labelParts.length > 0 ? labelParts.join(' – ') : 'Unnamed part';

        const rawSearchText = [partNumber, description, vendor, category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return {
          id: String(
            part.id ??
              (part as any).part_id ??
              (part as any).partNumber ??
              part.part_number
          ),
          label,
          searchText: rawSearchText,
          meta: {
            quantity_on_hand:
              (part as any).quantity_on_hand ??
              (part as any).quantityOnHand ??
              0,
            vendor,
            category,
          },
        };
      }),
    [activeParts]
  );
  const browseableParts = useMemo(() => {
    return activeParts.filter((p) => {
      if (browsePartsInStockOnly) {
        const qoh = (p as any).quantity_on_hand ?? 0;
        if (qoh <= 0) return false;
      }
      return true;
    });
  }, [activeParts, browsePartsInStockOnly]);
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
  const activeVendors = vendors.filter((v) => v.is_active);
  const activeCategories = categories.filter((c) => c.is_active);

  useEffect(() => {
    setBrowsePartsPage(0);
  }, [browsePartsInStockOnly]);

  const isInvoiced = currentOrder?.status === 'INVOICED';
  const isEstimate = currentOrder?.status === 'ESTIMATE';
  const isCancelled = currentOrder?.status === 'CANCELLED';
  const isLocked = isInvoiced || isCancelled;
  const showMobileActionBar = isMobile && !isLocked;
  const isCustomerOnHold = Boolean(customer?.credit_hold);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const statusLabel =
    currentOrder?.status === 'INVOICED'
      ? 'Invoiced'
      : currentOrder?.status === 'ESTIMATE'
      ? 'Estimate'
      : currentOrder?.status === 'PARTIAL'
      ? 'Partial'
      : currentOrder?.status === 'COMPLETED'
      ? 'Completed'
      : currentOrder?.status === 'CANCELLED'
      ? 'Cancelled'
      : 'Open';
  const currentOrderId = currentOrder?.id ?? null;
  const currentOrderUpdatedAt =
    (currentOrder as any)?.updated_at ?? (currentOrder as any)?.updatedAt ?? null;

  const orderLines = useMemo(
    () => (currentOrder ? getSalesOrderLines(currentOrder.id) : []),
    [currentOrder, currentOrderId, currentOrderUpdatedAt, getSalesOrderLines]
  );
  const chargeLines = useMemo(
    () => (currentOrder ? getSalesOrderChargeLines(currentOrder.id) : []),
    [currentOrder, currentOrderId, currentOrderUpdatedAt, getSalesOrderChargeLines]
  );
  const orderTotal = toNumber(currentOrder?.total);
  const payments = usePayments('SALES_ORDER', currentOrder?.id, orderTotal);
  const paymentStatusClass = useMemo(() => {
    switch (payments.summary.status) {
      case 'PAID':
        return 'bg-green-100 text-green-700';
      case 'OVERPAID':
        return 'bg-amber-100 text-amber-800';
      case 'PARTIAL':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }, [payments.summary.status]);

  useEffect(() => {
    if (!currentOrder) return;
    if (paymentAmount !== '') return;
    if (payments.summary.balanceDue > 0) {
      setPaymentAmount(payments.summary.balanceDue.toFixed(2));
    }
  }, [currentOrder, paymentAmount, payments.summary.balanceDue]);

  if (!isNew && !currentOrder) {
    return (
      <div className="page-container">
        <PageHeader title="Order Not Found" backTo="/sales-orders" />
        <p className="text-muted-foreground">This sales order does not exist.</p>
      </div>
    );
  }

  const handleCreateOrder = () => {
    if (!selectedCustomerId) {
      toast({ title: 'Error', description: 'Please select a customer', variant: 'destructive' });
      return;
    }
    const newOrder = createSalesOrder(selectedCustomerId, selectedUnitId);
    navigate(`/sales-orders/${newOrder.id}`, { replace: true, state: { justCreated: true } });
    setOrder(newOrder);
    toast({ title: 'Order Created', description: `Sales Order ${newOrder.order_number} created` });
    setIsDirty(false);
  };

  const handleAddPart = () => {
    if (!selectedPartId || !currentOrder) return;
    if (isLocked) {
      toast({ title: 'Locked', description: 'Order is locked and cannot be edited.', variant: 'destructive' });
      return;
    }
    const qty = parseInt(partQty) || 1;
    const result = soAddPartLine(currentOrder.id, selectedPartId, qty);
    if (result.success) {
      toast({ title: 'Part Added' });
      setAddPartDialogOpen(false);
      setSelectedPartId('');
      setPartQty('1');
      setIsDirty(true);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleUpdateQty = (lineId: string, newQty: number) => {
    if (isLocked) {
      toast({ title: 'Locked', description: 'Order is locked and cannot be edited.', variant: 'destructive' });
      return;
    }
    if (newQty <= 0) {
      handleRemoveLine(lineId);
      return;
    }
    const result = soUpdatePartQty(lineId, newQty);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      setIsDirty(true);
    }
  };

  const handleSetStatus = (status: SalesOrderStatus) => {
    if (!currentOrder) return;
    const result = soSetStatus(currentOrder.id, status);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      return;
    }
    setOrder((prev) => (prev && prev.id === currentOrder.id ? { ...prev, status } : prev || currentOrder));
    toast({ title: 'Status Updated', description: `Order marked ${status.toLowerCase()}` });
  };

  const handleRemoveLine = (lineId: string) => {
    if (isLocked) {
      toast({ title: 'Locked', description: 'Order is locked and cannot be edited.', variant: 'destructive' });
      return;
    }
    const result = soRemovePartLine(lineId);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      setIsDirty(true);
    }
  };

  const handleInvoice = () => {
    if (!currentOrder) return;
    if (isCustomerOnHold) {
      toast({
        title: 'Credit Hold',
        description: 'Cannot invoice while customer is on credit hold.',
        variant: 'destructive',
      });
      return;
    }
    const result = soInvoice(currentOrder.id);
    if (result.success) {
      toast({ title: 'Order Invoiced' });
      setShowInvoiceDialog(false);
      setIsDirty(false);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleQuickAddCustomer = () => {
    if (!newCustomerName.trim()) return;
    const result = addCustomer({
      company_name: newCustomerName.trim(),
      contact_name: null,
      phone: null,
      email: null,
      address: null,
      notes: null,
      price_level: 'RETAIL',
      is_tax_exempt: false,
      tax_rate_override: null,
    });
    if (!result.success || !result.customer) {
      toast({ title: 'Unable to add customer', description: result.error, variant: 'destructive' });
      return;
    }
    setSelectedCustomerId(result.customer.id);
    setQuickAddCustomerOpen(false);
    setNewCustomerName('');
    toast({ title: 'Customer Added' });
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
    setIsDirty(true);
  };

  const handleEditNotes = () => {
    setNotesValue(currentOrder?.notes || '');
    setIsEditingNotes(true);
  };

  const isNewlyCreated = Boolean(createdParam === '1' || location.state?.justCreated);
  useEffect(() => {
    if (!isNewlyCreated) return;
    if (initialFocusRequested.current) return;
    initialFocusRequested.current = true;
    requestAnimationFrame(() => {
      notesRef.current?.focus();
    });
  }, [isNewlyCreated]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    const handlePopState = () => {
      if (!isDirty) return;
      const confirmLeave = window.confirm('You have unsaved changes. Leave without saving?');
      if (!confirmLeave) {
        window.history.pushState(null, '', location.pathname + location.search + location.hash);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDirty, location.pathname, location.search, location.hash]);

  const handleSaveNotes = () => {
    if (!currentOrder) return;
    updateSalesOrderNotes(currentOrder.id, notesValue.trim() || null);
    setIsEditingNotes(false);
    toast({ title: 'Notes Updated' });
    setIsDirty(false);
  };

  const handleAiApplyNote = (original: string, rewritten: string) => {
    setAiOriginalNote(original);
    setNotesValue(rewritten);
    setIsEditingNotes(true);
    setIsDirty(true);
  };

  const handleAddPayment = async () => {
    if (!currentOrder) return;
    const amountValue = toNumber(paymentAmount);
    if (amountValue <= 0) {
      toast({ title: 'Enter amount', description: 'Payment amount must be greater than 0', variant: 'destructive' });
      return;
    }
    try {
      await payments.addPayment.mutateAsync({
        amount: amountValue,
        method: paymentMethod,
        reference: paymentReference || null,
        notes: paymentNotes || null,
      });
      toast({ title: 'Payment recorded' });
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
    } catch (error: any) {
      toast({
        title: 'Unable to record payment',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleVoidPayment = async (paymentId: string) => {
    const reason = window.prompt('Enter void reason (optional)') ?? '';
    try {
      await payments.voidPayment.mutateAsync({ paymentId, reason });
      toast({ title: 'Payment voided' });
    } catch (error: any) {
      toast({
        title: 'Unable to void payment',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleMarkCoreReturned = (lineId: string) => {
    setCoreReturnLineId(lineId);
    setShowCoreReturnDialog(true);
  };

  const handleConvertToOpen = () => {
    if (!currentOrder) return;
    const result = soConvertToOpen(currentOrder.id);
    if (result.success) {
      setOrder(null);
      toast({
        title: 'Order Converted',
        description: 'Estimate converted to sales order',
      });
      setIsDirty(false);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const confirmMarkCoreReturned = () => {
    if (!coreReturnLineId) return;
    const result = repos.salesOrders.soMarkCoreReturned(coreReturnLineId);
    if (result.success) {
      toast({ title: 'Core Returned', description: 'Refund line has been created' });
      setIsDirty(true);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setShowCoreReturnDialog(false);
    setCoreReturnLineId(null);
  };

  const poLinesByPo = useMemo(() => {
    return purchaseOrderLines.reduce<Record<string, typeof purchaseOrderLines>>((acc, line) => {
      acc[line.purchase_order_id] = acc[line.purchase_order_id] || [];
      acc[line.purchase_order_id].push(line);
      return acc;
    }, {});
  }, [purchaseOrderLines]);
  const linkedPurchaseOrders = useMemo(() => {
    if (!currentOrder) return [];
    return purchaseOrders
      .filter((po) => po.sales_order_id === currentOrder.id)
      .map((po) => ({
        ...po,
        derivedStatus: getPurchaseOrderDerivedStatus(po, poLinesByPo[po.id] || []),
      }));
  }, [currentOrder, poLinesByPo, purchaseOrders]);
  const priceLevelLabel =
    customer?.price_level === 'WHOLESALE'
      ? 'Wholesale'
      : customer?.price_level === 'FLEET'
      ? 'Fleet'
      : 'Retail';
  
  // Separate part lines and refund lines for display
  const partLines = orderLines.filter((l) => !l.is_core_refund_line);
  const refundLines = orderLines.filter((l) => l.is_core_refund_line);

  // New order form
  if (isNew && !order) {
    return (
      <div className="page-container">
        <PageHeader title="New Sales Order" backTo="/sales-orders" />
        <div className="form-section max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Order Details</h2>
          <div className="space-y-4">
            <div>
              <Label>Customer *</Label>
              <div className="flex items-center gap-2">
                <SmartSearchSelect
                  label={undefined}
                  className="flex-1 min-w-0"
                  items={customerPickerItems}
                  value={selectedCustomerId || null}
                  onChange={(v) => {
                    const next = v ?? '';
                    setSelectedCustomerId(next);
                    if (!unitFromQuery) {
                      setSelectedUnitId(null);
                    }
                    setIsDirty(true);
                  }}
                  placeholder="Search customers by name, phone, email, or address..."
                  minChars={2}
                  limit={25}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="flex-shrink-0"
                  onClick={() => setIsBrowseCustomersOpen(true)}
                >
                  Browse customers
                </Button>
                <Button variant="outline" size="icon" onClick={() => setQuickAddCustomerOpen(true)} className="flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {selectedCustomerId && selectedCustomerId !== 'walkin' && customerUnits.length > 0 && (
              <div>
                <Label>Unit (optional)</Label>
                <SmartSearchSelect
                  label={undefined}
                  items={[{ id: NONE_UNIT, label: 'No unit', searchText: 'none' }, ...unitItems]}
                  value={selectedUnitId && selectedUnitId !== '' ? selectedUnitId : unitFromQuery || NONE_UNIT}
                  onChange={(v) => {
                    const next = v === NONE_UNIT ? null : v;
                    setSelectedUnitId(next);
                    if (!unitFromQuery) {
                      setIsDirty(true);
                    }
                  }}
                  placeholder="Search units…"
                  disabled={!!unitFromQuery}
                />
              </div>
            )}

            {selectedCustomerId === 'walkin' && (
              <p className="text-sm text-muted-foreground">Walk-in customers cannot have units assigned.</p>
            )}

            <Button onClick={handleCreateOrder} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {isNew ? 'Create Order' : 'Save'}
            </Button>
          </div>
        </div>

        <QuickAddDialog open={quickAddCustomerOpen} onOpenChange={setQuickAddCustomerOpen} title="Quick Add Customer" onSave={handleQuickAddCustomer} onCancel={() => setQuickAddCustomerOpen(false)}>
          <div>
            <Label>Company Name *</Label>
            <Input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Enter company name" />
          </div>
        </QuickAddDialog>

        <Dialog open={isBrowseCustomersOpen} onOpenChange={setIsBrowseCustomersOpen}>
          <DialogContent className="max-w-4xl w-full">
            <DialogHeader>
              <DialogTitle>Browse customers</DialogTitle>
            </DialogHeader>

            <p className="text-sm text-muted-foreground mb-3">
              Viewing customers. Use the active filter and pagination to browse, then select one to attach to this order.
            </p>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={browseCustomersActiveOnly}
                    onChange={(e) => setBrowseCustomersActiveOnly(e.target.checked)}
                  />
                  Active only
                </label>
              </div>

              <div className="text-xs text-muted-foreground">
                Page {safeBrowseCustomersPage + 1} of {totalBrowseCustomerPages} • {browseableCustomers.length} customers
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Customer</th>
                    <th className="px-3 py-2 text-left font-medium">Phone</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Location</th>
                    <th className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBrowseCustomers.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{(c as any).company_name || (c as any).contact_name || 'Unnamed'}</div>
                        {(c as any).contact_name && (c as any).company_name && (
                          <div className="text-xs text-muted-foreground">{(c as any).contact_name}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">{c.phone ?? '-'}</td>
                      <td className="px-3 py-2">{c.email ?? '-'}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-muted-foreground">
                          {[(c as any).city, (c as any).state].filter(Boolean).join(', ') || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const idStr = String(c.id);
                            setSelectedCustomerId(idStr);
                            if (!unitFromQuery) {
                              setSelectedUnitId(null);
                            }
                            setIsDirty(true);
                            setIsBrowseCustomersOpen(false);
                          }}
                        >
                          Select
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {pagedBrowseCustomers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safeBrowseCustomersPage === 0}
                onClick={() => setBrowseCustomersPage((page) => Math.max(0, page - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safeBrowseCustomersPage >= totalBrowseCustomerPages - 1}
                onClick={() => setBrowseCustomersPage((page) => Math.min(totalBrowseCustomerPages - 1, page + 1))}
              >
                Next
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Existing order view
  return (
    <div className="page-container">
      <PageHeader
        title={currentOrder?.order_number || 'Sales Order'}
        subtitle={statusLabel}
        backTo="/sales-orders"
        description={
          unit ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => navigate(`/units/${unit.id}`)}
            >
              {unit.unit_name || 'Unit'} {unit.vin ? `• ${unit.vin}` : ''}
            </Button>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {aiAssistEnabled && currentOrder && (
              <Button variant="outline" onClick={() => setAiAssistOpen(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                AI Assist
              </Button>
            )}
            {currentOrder && <StatusBadge status={currentOrder.status} />}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPrintMode('picklist');
                setTimeout(() => window.print(), 0);
              }}
            >
              <Printer className="w-4 h-4 mr-2" />
              Pick List
            </Button>
            {!isLocked && (
              <>
                {isEstimate ? (
                  <Button onClick={handleConvertToOpen}>
                    <Save className="w-4 h-4 mr-2" />
                    Convert to Sales Order
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => handleSetStatus('PARTIAL')}>
                      Mark Partial
                    </Button>
                    <Button variant="outline" onClick={() => handleSetStatus('COMPLETED')}>
                      Mark Completed
                    </Button>
                    <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          <Save className="w-4 h-4 mr-2" />
                          Cancel Order
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel sales order?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will lock the order but keep history. Inventory will not change.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Order</AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                handleSetStatus('CANCELLED');
                                setCancelDialogOpen(false);
                              }}
                            >
                              Cancel Order
                            </Button>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      onClick={() => setShowInvoiceDialog(true)}
                      disabled={isCustomerOnHold}
                      title={isCustomerOnHold ? 'Customer is on credit hold' : undefined}
                    >
                      <FileCheck className="w-4 h-4 mr-2" />
                      Invoice
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        }
      />

      {isCustomerOnHold && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Customer is on Credit Hold</AlertTitle>
          <AlertDescription>{customer?.credit_hold_reason || 'Resolve hold before invoicing.'}</AlertDescription>
        </Alert>
      )}
      {isCancelled && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Order Cancelled</AlertTitle>
          <AlertDescription>This order is cancelled and cannot be edited.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* Order Info */}
        <div className="form-section">
          <h2 className="text-lg font-semibold mb-4">Order Information</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Customer:</span>
              <p className="font-medium">{customer?.company_name || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Price Level:</span>
              <p className="font-medium">{customer ? priceLevelLabel : 'Retail'}</p>
            </div>
            {unit && (
              <div>
                <span className="text-muted-foreground">Unit:</span>
                <p className="font-medium">{unit.unit_name}</p>
                {unit.vin && <p className="text-xs text-muted-foreground font-mono">{unit.vin}</p>}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Created:</span>
              <p className="font-medium">{new Date(currentOrder?.created_at || '').toLocaleString()}</p>
            </div>
            {currentOrder?.invoiced_at && (
              <div>
                <span className="text-muted-foreground">Invoiced:</span>
                <p className="font-medium">{new Date(currentOrder.invoiced_at).toLocaleString()}</p>
              </div>
            )}
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-sm font-medium">Purchase Orders</p>
              {linkedPurchaseOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No purchase orders linked.</p>
              ) : (
                <div className="space-y-2">
                  {linkedPurchaseOrders.map((po) => (
                    <div key={po.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="space-y-1">
                        <p className="font-medium">{po.po_number || po.id}</p>
                        <StatusBadge status={po.derivedStatus} />
                      </div>
                      <PurchaseOrderPreviewDialog
                        poId={po.id}
                        trigger={
                          <Button variant="outline" size="sm">
                            View PO
                          </Button>
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Notes Section */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm">Notes:</span>
              {!isLocked && !isEditingNotes && (
                <Button variant="ghost" size="sm" onClick={handleEditNotes}>
                  <Edit className="w-3 h-3" />
                </Button>
              )}
            </div>
            {isEditingNotes ? (
              <div className="space-y-2">
                <Textarea
                  ref={notesRef}
                  value={notesValue}
                  onChange={(e) => {
                    setNotesValue(e.target.value);
                    setIsDirty(true);
                  }}
                  rows={3}
                  placeholder="Add notes..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNotes}><Save className="w-3 h-3 mr-1" />Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingNotes(false)}><X className="w-3 h-3 mr-1" />Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm">{currentOrder?.notes || '-'}</p>
            )}
          </div>
        </div>

        {/* Parts */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Parts</h2>
            {!isLocked && (
              <Button size="sm" onClick={() => setAddPartDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Part
              </Button>
            )}
          </div>

          {isMobile && orderLines.length === 0 ? (
            <div className="rounded-lg border bg-card text-muted-foreground p-4 text-center">No parts added yet</div>
          ) : (
            <ResponsiveDataList
              items={orderLines}
              renderMobileCard={(line) => {
                const part = parts.find((p) => p.id === line.part_id);
                const priceLevel = customer?.price_level ?? 'RETAIL';
                const suggestedUnitPrice = part ? calcPartPriceForLevel(part, settings, priceLevel) : null;
                const showSuggested =
                  suggestedUnitPrice != null && Math.abs(suggestedUnitPrice - line.unit_price) > 0.009;
                const { basis } = part ? getPartCostBasis(part) : { basis: null };
                const isEditingPrice = editingPriceLineId === line.id;
                return (
                  <div
                    className={`border rounded-lg p-3 space-y-3 ${
                      line.is_warranty ? 'bg-accent/30 border-accent/60' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="font-mono font-semibold text-sm whitespace-nowrap truncate">
                          {part?.part_number || '-'}
                        </div>
                        <div className="text-sm text-muted-foreground break-words">
                          {part?.description || line.description || '-'}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {line.is_warranty && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Warranty
                            </Badge>
                          )}
                          {line.core_charge > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <RotateCcw className="w-3 h-3" />
                              Core ${formatMoney(line.core_charge)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {!isLocked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLine(line.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>

                    {line.core_charge > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        {line.core_status === 'CORE_OWED' ? (
                          <Button size="sm" variant="outline" onClick={() => handleMarkCoreReturned(line.id)} className="h-7 text-xs">
                            Core Owed (${line.core_charge})
                          </Button>
                        ) : line.core_status === 'CORE_CREDITED' ? (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" />
                            Credited
                          </Badge>
                        ) : null}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Qty</div>
                        {isLocked ? (
                          <div className="font-medium">{line.quantity}</div>
                        ) : (
                          <Input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleUpdateQty(line.id, parseInt(e.target.value) || 0)}
                            className="w-full"
                          />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Price</div>
                        {isLocked ? (
                          <div className="font-medium">${formatMoney(line.unit_price)}</div>
                        ) : isEditingPrice ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={priceDraft}
                              onChange={(e) => setPriceDraft(e.target.value)}
                              className="w-full text-right"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const parsed = parseFloat(priceDraft);
                                const result = soUpdateLineUnitPrice(line.id, parsed);
                                if (!result.success) {
                                  toast({ title: 'Error', description: result.error, variant: 'destructive' });
                                  return;
                                }
                                setEditingPriceLineId(null);
                                setPriceDraft('');
                                setIsDirty(true);
                              }}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingPriceLineId(null);
                                setPriceDraft('');
                              }}
                            >
                              <XIcon className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (suggestedUnitPrice != null) {
                                  setPriceDraft(formatMoney(suggestedUnitPrice));
                                }
                              }}
                            >
                              Reset
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">${formatMoney(line.unit_price)}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingPriceLineId(line.id);
                                setPriceDraft(formatMoney(line.unit_price));
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        {showSuggested && (
                          <span className="text-xs text-muted-foreground">
                            Suggested ({priceLevel}): ${formatMoney(suggestedUnitPrice!)}
                          </span>
                        )}
                        {basis !== null && line.unit_price < basis && (
                          <span className="text-xs text-destructive">
                            Warning: below cost (basis ${formatMoney(basis)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">Warranty</span>
                        {!isLocked ? (
                          <Checkbox
                            checked={line.is_warranty}
                            onCheckedChange={() => {
                              soToggleWarranty(line.id);
                              setIsDirty(true);
                            }}
                          />
                        ) : line.is_warranty ? (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Warranty
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Line Total</div>
                        <div className="font-semibold">
                          {line.is_warranty ? <span className="text-muted-foreground">$0.00</span> : `$${formatMoney(line.line_total)}`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }}
              renderDesktop={(items) => (
                <div className="table-container overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Part #</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Warranty</TableHead>
                        <TableHead className="text-center">Core</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        {!isLocked && <TableHead className="w-10"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No parts added yet</TableCell>
                        </TableRow>
                      ) : (
                        items.map((line) => {
                          const part = parts.find((p) => p.id === line.part_id);
                          const priceLevel = customer?.price_level ?? 'RETAIL';
                          const suggestedUnitPrice = part ? calcPartPriceForLevel(part, settings, priceLevel) : null;
                          const showSuggested =
                            suggestedUnitPrice != null && Math.abs(suggestedUnitPrice - line.unit_price) > 0.009;
                          const { basis } = part ? getPartCostBasis(part) : { basis: null };
                          return (
                            <TableRow key={line.id} className={line.is_warranty ? 'bg-accent/30' : ''}>
                              <TableCell className="font-mono">{part?.part_number || '-'}</TableCell>
                              <TableCell>{part?.description || '-'}</TableCell>
                              <TableCell className="text-center">
                                {!isLocked ? (
                                  <Checkbox
                                    checked={line.is_warranty}
                                    onCheckedChange={() => {
                                      soToggleWarranty(line.id);
                                      setIsDirty(true);
                                    }}
                                  />
                                ) : line.is_warranty ? (
                                  <Badge variant="secondary"><Shield className="w-3 h-3" /></Badge>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-center">
                                {line.core_charge > 0 && (
                                  <div className="flex items-center justify-center gap-1">
                                    {line.core_status === 'CORE_OWED' ? (
                                      <Button size="sm" variant="outline" onClick={() => handleMarkCoreReturned(line.id)} className="h-6 text-xs">
                                        Core Owed (${line.core_charge})
                                      </Button>
                                    ) : line.core_status === 'CORE_CREDITED' ? (
                                      <Badge variant="secondary"><RotateCcw className="w-3 h-3 mr-1" />Credited</Badge>
                                    ) : null}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {isLocked ? line.quantity : (
                                  <Input type="number" min="1" value={line.quantity} onChange={(e) => handleUpdateQty(line.id, parseInt(e.target.value) || 0)} className="w-16 text-right" />
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-1">
                                  {isLocked ? (
                                    <span>${formatMoney(line.unit_price)}</span>
                                  ) : editingPriceLineId === line.id ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={priceDraft}
                                        onChange={(e) => setPriceDraft(e.target.value)}
                                        className="w-24 h-8 text-right"
                                      />
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                          const parsed = parseFloat(priceDraft);
                                          const result = soUpdateLineUnitPrice(line.id, parsed);
                                          if (!result.success) {
                                            toast({ title: 'Error', description: result.error, variant: 'destructive' });
                                            return;
                                          }
                                          setEditingPriceLineId(null);
                                          setPriceDraft('');
                                          setIsDirty(true);
                                        }}
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingPriceLineId(null);
                                          setPriceDraft('');
                                        }}
                                      >
                                        <XIcon className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          if (suggestedUnitPrice != null) {
                                            setPriceDraft(formatMoney(suggestedUnitPrice));
                                          }
                                        }}
                                      >
                                        Reset
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2">
                                      <span>${formatMoney(line.unit_price)}</span>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingPriceLineId(line.id);
                                          setPriceDraft(formatMoney(line.unit_price));
                                        }}
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  )}
                                  {showSuggested && (
                                    <span className="text-xs text-muted-foreground">
                                      Suggested ({priceLevel}): ${formatMoney(suggestedUnitPrice!)}
                                    </span>
                                  )}
                                  {basis !== null && line.unit_price < basis && (
                                    <span className="text-xs text-destructive">
                                      Warning: below cost (basis ${formatMoney(basis)})
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {line.is_warranty ? <span className="text-muted-foreground">$0.00</span> : `$${formatMoney(line.line_total)}`}
                              </TableCell>
                              {!isLocked && (
                                <TableCell>
                                  <Button variant="ghost" size="icon" onClick={() => handleRemoveLine(line.id)} className="text-destructive hover:text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            />
          )}

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>${formatMoney(currentOrder?.subtotal)}</span>
              </div>
              {(currentOrder?.core_charges_total ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Core Charges:</span>
                  <span>${formatMoney(currentOrder?.core_charges_total)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({currentOrder?.tax_rate}%):</span>
                <span>${formatMoney(currentOrder?.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t border-border pt-2">
                <span>Total:</span>
                <span>${formatMoney(currentOrder?.total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="border rounded-lg p-4 bg-muted/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <p className="font-semibold">
                    ${formatMoney(payments.summary.totalPaid)} paid of ${formatMoney(orderTotal)}
                  </p>
                </div>
                <Badge variant="outline" className={paymentStatusClass}>
                  {payments.summary.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Paid</span>
                  <span className="font-medium">${formatMoney(payments.summary.totalPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance Due</span>
                  <span className="font-medium">${formatMoney(payments.summary.balanceDue)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Record Payment</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                  <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="Reference (optional)"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
                <Input
                  placeholder="Notes (optional)"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
                <Button onClick={handleAddPayment} disabled={!currentOrder || payments.addPayment.isPending}>
                  {payments.addPayment.isPending ? 'Saving...' : 'Add Payment'}
                </Button>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Payment History</h3>
                {payments.isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
              </div>
              <div className="space-y-2 text-sm">
                {payments.payments.length === 0 && (
                  <p className="text-muted-foreground">No payments recorded yet.</p>
                )}
                {payments.payments.map((payment) => (
                  <div key={payment.id} className="border rounded-md p-3 bg-background space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        ${formatMoney(payment.amount)} · {payment.method}
                      </span>
                      {payment.voided_at ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive">
                          Voided
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleVoidPayment(payment.id)}
                          disabled={payments.voidPayment.isPending}
                        >
                          Void
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(payment.created_at).toLocaleString()}</span>
                      {payment.reference && <span>Ref: {payment.reference}</span>}
                    </div>
                    {payment.notes && <div className="text-xs text-muted-foreground">Notes: {payment.notes}</div>}
                    {payment.void_reason && (
                      <div className="text-xs text-muted-foreground">Void reason: {payment.void_reason}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showMobileActionBar && (
        <div className="no-print">
          <MobileActionBar
            primary={
              <Button size="sm" onClick={() => setAddPartDialogOpen(true)} className="flex-1">
                <Plus className="w-4 h-4 mr-2" />
                Add Part
              </Button>
            }
            secondary={
              isEstimate ? (
                <Button size="sm" variant="outline" onClick={handleConvertToOpen} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  Convert
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowInvoiceDialog(true)}
                  disabled={isCustomerOnHold}
                  className="flex-1"
                >
                  <FileCheck className="w-4 h-4 mr-2" />
                  Invoice
                </Button>
              )
            }
          />
          <MobileActionBarSpacer />
        </div>
      )}

      {/* Print Invoice */}
      {currentOrder && (
        <>
          {printMode === 'invoice' && (
            <PrintSalesOrder order={currentOrder} lines={orderLines} customer={customer} unit={unit} parts={parts} shopName={settings.shop_name} />
          )}
          {printMode === 'picklist' && (
            <PrintSalesOrderPickList order={currentOrder} lines={orderLines} customer={customer} unit={unit} parts={parts} shopName={settings.shop_name} />
          )}
        </>
      )}

      {aiAssistEnabled && currentOrder && (
        <Dialog open={aiAssistOpen} onOpenChange={setAiAssistOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>AI Assist (Preview)</DialogTitle>
              <DialogDescription>This is a demo. No external AI calls.</DialogDescription>
            </DialogHeader>
            <AIAssistPanel
              context={{
                type: 'salesOrder',
                order: currentOrder,
                customer,
                unit,
                lines: orderLines,
                chargeLines,
              }}
              parts={parts}
              notesValue={notesValue}
              originalStoredNote={aiOriginalNote}
              onApplyNote={handleAiApplyNote}
              onSelectPart={(partId) => {
                setSelectedPartId(partId);
                setAddPartDialogOpen(true);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add Part Dialog */}
      <AdaptiveDialog
        open={addPartDialogOpen}
        onOpenChange={setAddPartDialogOpen}
        title="Add Part"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddPartDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPart}>Save</Button>
          </div>
        }
      >
          <div className="space-y-4">
            <div>
              <Label>Part *</Label>
              <div className="flex items-center gap-2">
                <SmartSearchSelect
                  label={undefined}
                  className="flex-1 min-w-0"
                  items={partPickerItems}
                  value={selectedPartId || null}
                  onChange={(v) => setSelectedPartId(v ?? '')}
                  placeholder="Search parts by # or description..."
                  renderItem={(item) => (
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{item.label}</span>
                      {typeof item.meta?.quantity_on_hand === 'number' && (
                        <span className="text-xs text-muted-foreground">QOH: {item.meta.quantity_on_hand}</span>
                      )}
                    </div>
                  )}
                />
                <Button variant="outline" className="flex-shrink-0" onClick={() => setIsBrowsePartsOpen(true)}>
                  Browse parts
                </Button>
                <Button variant="outline" className="flex-shrink-0" onClick={() => setNewPartDialogOpen(true)}>
                  New Part
                </Button>
              </div>
            </div>
            {aiAssistEnabled && (
              <div className="space-y-2">
                <Label className="text-sm">Parts Lookup Assist (Preview)</Label>
                <Input
                  value={aiPartsQuery}
                  onChange={(e) => setAiPartsQuery(e.target.value)}
                  placeholder="Describe a part or paste a part number"
                />
                <p className="text-xs text-muted-foreground">
                  Demo only. Selecting fills the picker and never auto-adds a line.
                </p>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {aiPartSuggestions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Start typing to see suggestions.</p>
                  ) : (
                    aiPartSuggestions.map((suggestion) => (
                      <div key={suggestion.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div className="text-sm">
                          <div className="font-medium">
                            {suggestion.partNumber} — {suggestion.description || 'Part'}
                          </div>
                          <div className="text-xs text-muted-foreground">Reason: {suggestion.reason}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedPartId(suggestion.id)}
                        >
                          Use
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            <div>
              <Label>Quantity</Label>
              <Input type="number" min="1" value={partQty} onChange={(e) => setPartQty(e.target.value)} />
            </div>
          </div>
      </AdaptiveDialog>

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
                  id="browse-in-stock"
                />
                <Label htmlFor="browse-in-stock" className="text-sm">In stock only</Label>
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
                        <TableCell>{(p.vendor as any)?.vendor_name || (p as any).vendor_label || '—'}</TableCell>
                        <TableCell>{(p.category as any)?.name || (p as any).category_label || '—'}</TableCell>
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

      {/* Quick Add Part Dialog */}
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
            <Textarea
              value={newPartData.description}
              onChange={(e) => setNewPartData({ ...newPartData, description: e.target.value })}
              rows={2}
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
                  {activeCategories.map((category) => (
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

      {/* Invoice Confirmation Dialog */}
      <AlertDialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invoice this Order?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently lock the order. No further changes can be made after invoicing.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleInvoice}>Invoice Order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Core Return Confirmation Dialog */}
      <AlertDialog open={showCoreReturnDialog} onOpenChange={setShowCoreReturnDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Core Returned?</AlertDialogTitle>
            <AlertDialogDescription>This will create a refund/credit line for the core deposit.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMarkCoreReturned}>Mark Returned</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
