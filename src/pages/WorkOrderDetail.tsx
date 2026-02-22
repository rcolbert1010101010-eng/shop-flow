import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useShopStore } from '@/stores/shopStore';
import { useToast } from '@/hooks/use-toast';
import { Save, Plus, Trash2, FileCheck, Printer, Edit, X, Clock, Square, Shield, RotateCcw, Check, Pencil, X as XIcon, Info, ClipboardList, Sparkles } from 'lucide-react';
import { SmartSearchSelect } from '@/components/common/SmartSearchSelect';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { Switch } from '@/components/ui/switch';
import { QuickAddDialog } from '@/components/ui/quick-add-dialog';
import { PrintWorkOrder, PrintWorkOrderPickList } from '@/components/print/PrintInvoice';
import { calcPartPriceForLevel, getPartCostBasis } from '@/domain/pricing/partPricing';
import { getPurchaseOrderDerivedStatus } from '@/services/purchaseOrderStatus';
import { StatusBadge } from '@/components/ui/status-badge';
import { PurchaseOrderPreviewDialog } from '@/components/purchase-orders/PurchaseOrderPreviewDialog';
import { AddUnitDialog } from '@/components/units/AddUnitDialog';
import { useRepos } from '@/repos';
import { summarizeFabJob } from '@/services/fabJobSummary';
import { usePayments } from '@/hooks/usePayments';
import { useQuickBooksIntegration } from '@/hooks/useQuickBooksIntegration';
import { AIAssistPanel } from '@/components/ai/AIAssistPanel';
import { suggestParts } from '@/services/aiAssist/aiAssistPreview';
import { AdaptiveDialog } from '@/components/common/AdaptiveDialog';
import { ResponsiveDataList } from '@/components/common/ResponsiveDataList';
import { MobileActionBar, MobileActionBarSpacer } from '@/components/common/MobileActionBar';
import { useIsMobile } from '@/hooks/useIsMobile';
import { normalizeQty, formatQtyWithUom } from '@/lib/utils';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/security/usePermissions';
import { ProfitabilityPanel } from '@/components/orders/ProfitabilityPanel';
import { useWorkOrderLock } from '@/hooks/useWorkOrderLock';
import type {
  FabJobLine,
  PlasmaJobLine,
  WorkOrder,
  WorkOrderJobLine,
  WorkOrderJobPartsStatus,
  WorkOrderJobStatus,
  WorkOrderPartLine,
  WorkOrderLaborLine,
  WorkOrderTimeEntry,
} from '@/types';

const toNumeric = (value: number | string | null | undefined) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

type JobDraft = {
  title: string;
  status: WorkOrderJobStatus;
};

type WorkOrderCccDraft = {
  complaint: string;
  cause: string;
  correction: string;
};

type WorkOrderWithCcc = WorkOrder & {
  complaint?: string | null;
  cause?: string | null;
  correction?: string | null;
};

type JobProfitSummary = {
  jobPartLines: WorkOrderPartLine[];
  jobLaborLines: WorkOrderLaborLine[];
  jobActualHours: number;
  partsRevenue: number;
  partsCost: number;
  laborRevenue: number;
  laborCost: number;
  hasLaborCost: boolean;
  margin: number;
  marginPercent: number;
};

const DEFAULT_JOB_PROFIT_SUMMARY: JobProfitSummary = {
  jobPartLines: [],
  jobLaborLines: [],
  jobActualHours: 0,
  partsRevenue: 0,
  partsCost: 0,
  laborRevenue: 0,
  laborCost: 0,
  hasLaborCost: false,
  margin: 0,
  marginPercent: 0,
};

const JOB_STATUS_OPTIONS: { value: WorkOrderJobStatus; label: string }[] = [
  { value: 'INTAKE', label: 'Intake' },
  { value: 'DIAGNOSING', label: 'Diagnosing' },
  { value: 'ESTIMATING', label: 'Estimating' },
  { value: 'WAITING_APPROVAL', label: 'Waiting Approval' },
  { value: 'WAITING_PARTS', label: 'Waiting on Parts' },
  { value: 'READY', label: 'Ready' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'QA', label: 'QA' },
  { value: 'COMPLETE', label: 'Complete' },
  { value: 'WARRANTY', label: 'Warranty' },
];

type BlockerChip = { label: string; variant: 'outline' | 'secondary' | 'destructive' };

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' },
  { value: 'other', label: 'Other' },
];

const BROWSE_PARTS_PAGE_SIZE = 25;

const PRINT_STYLES = `
  @media print {
    aside,
    [data-sidebar],
    .sidebar,
    .layout-sidebar,
    .vertical-nav {
      display: none !important;
    }
    [role="tablist"],
    button,
    input,
    select,
    textarea,
    .print\\:hidden,
    .print-hidden {
      display: none !important;
    }
    #wo-overview-print {
      display: block !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    #wo-tech-print {
      display: none !important;
    }
    body[data-print-mode="OVERVIEW"] * {
      visibility: hidden !important;
    }
    body[data-print-mode="OVERVIEW"] #wo-overview-print,
    body[data-print-mode="OVERVIEW"] #wo-overview-print * {
      visibility: visible !important;
    }
    body[data-print-mode="OVERVIEW"] #wo-overview-print {
      display: block !important;
    }
    body[data-print-mode="TECH"] * {
      visibility: hidden !important;
    }
    body[data-print-mode="TECH"] #wo-tech-print,
    body[data-print-mode="TECH"] #wo-tech-print * {
      visibility: visible !important;
    }
    body[data-print-mode="TECH"] #wo-tech-print {
      display: block !important;
    }
    @page {
      size: auto;
      margin: 0.5in;
    }
  }
`;

function computeEntryHours(entry: WorkOrderTimeEntry): number {
  const startMs = new Date(entry.started_at).getTime();
  const endMs = entry.ended_at ? new Date(entry.ended_at).getTime() : Date.now();
  return Math.max((endMs - startMs) / 3600000, 0);
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    workOrders,
    customers,
    units,
    parts,
    settings,
    technicians,
    vendors,
    categories,
    getWorkOrderPartLines,
    getWorkOrderLaborLines,
    getWorkOrderJobLines,
    getWorkOrderActivity,
    getJobPartReadiness,
    getJobTimeEntries,
    getActiveJobTimers,
    getJobActualHours,
    getWorkOrderActualHours,
    getTimeEntriesByWorkOrder,
    getActiveTimeEntry,
    createWorkOrder,
    woAddPartLine,
    woUpdatePartQty,
    woUpdateLineUnitPrice,
    woRemovePartLine,
    woTogglePartWarranty,
    woToggleCoreReturned,
    woMarkCoreReturned,
    woAddLaborLine,
    woRemoveLaborLine,
    woToggleLaborWarranty,
    woEnsureDefaultJobLine,
    woCreateJobLine,
    woUpdateJobLine,
    woSetJobStatus,
    woDeleteJobLine,
    woClockIn,
    woClockOut,
    woUpdateStatus,
    woInvoice,
    updateWorkOrderNotes,
    clockIn,
    clockOut,
    addCustomer,
    addPart,
    addUnit,
    purchaseOrders,
    purchaseOrderLines,
    warrantyClaims,
    createWarrantyClaim,
    getClaimsByWorkOrder,
  } = useShopStore();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canCreateInvoices = can('invoices.create');
  const { autoExportOnFinalize } = useQuickBooksIntegration();
  const repos = useRepos();
  const fabricationRepo = repos.fabrication;
  const plasmaRepo = repos.plasma;
  const workOrderRepo = repos.workOrders;
  const schedulingRepo = repos.scheduling;
  const { addCategory } = repos.categories;
  const formatNumber = (value: number | string | null | undefined, digits = 2) =>
    toNumeric(value).toFixed(digits);
  const formatMoney = (value: number | string | null | undefined) => toNumeric(value).toFixed(2);
  const env = (import.meta as any).env || {};
  const aiAssistEnabled = import.meta.env.DEV || env.VITE_AI_ASSIST_PREVIEW === 'true';
  const isMobile = useIsMobile();
  const workOrderJobLines = useShopStore((state) => state.workOrderJobLines);
  const resetWorkOrdersForTenant = useShopStore((state) => state.resetWorkOrdersForTenant);
  const tenantSettingsId = useShopStore((state) => state.settings.id);
  const lastTenantSettingsIdRef = useRef<string | undefined>(undefined);

  const isNew = id === 'new';
  const unitFromQuery = searchParams.get('unit_id') || '';
  const [selectedCustomerId, setSelectedCustomerId] = useState(searchParams.get('customer_id') || '');
  const [selectedUnitId, setSelectedUnitId] = useState(unitFromQuery);
  const [order, setOrder] = useState<WorkOrderWithCcc | null>(() => {
    if (!isNew) return (workOrders.find((o) => o.id === id) as WorkOrderWithCcc | undefined) ?? null;
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
  const [quickAddVendorOpen, setQuickAddVendorOpen] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [quickAddCategoryOpen, setQuickAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingPriceLineId, setEditingPriceLineId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<string>('');
  const [printMode, setPrintMode] = useState<'invoice' | 'picklist'>('invoice');
  const [sheetPrintMode, setSheetPrintMode] = useState<'NONE' | 'OVERVIEW' | 'TECH'>('NONE');

  const [addLaborDialogOpen, setAddLaborDialogOpen] = useState(false);
  const [laborDescription, setLaborDescription] = useState('');
  const [laborHours, setLaborHours] = useState('1');
  const [laborTechnicianId, setLaborTechnicianId] = useState('');
  const [partDialogJobLineId, setPartDialogJobLineId] = useState<string | null>(null);
  const [laborDialogJobLineId, setLaborDialogJobLineId] = useState<string | null>(null);

  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [quickAddUnitOpen, setQuickAddUnitOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [aiAssistOpen, setAiAssistOpen] = useState(false);

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [aiOriginalNote, setAiOriginalNote] = useState<string | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showCoreReturnDialog, setShowCoreReturnDialog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [coreReturnLineId, setCoreReturnLineId] = useState<string | null>(null);
  const [createClaimOpen, setCreateClaimOpen] = useState(false);
  const [selectedClaimVendor, setSelectedClaimVendor] = useState('');
  const [jobDrafts, setJobDrafts] = useState<Record<string, JobDraft>>({});
  const [jobEditingMode, setJobEditingMode] = useState<Record<string, boolean>>({});
  const [jobSaving, setJobSaving] = useState<Record<string, boolean>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobCccDrafts, setJobCccDrafts] = useState<Record<string, WorkOrderCccDraft>>({});
  const [jobCccPersisted, setJobCccPersisted] = useState<Record<string, WorkOrderCccDraft>>({});
  const [jobCccLoading, setJobCccLoading] = useState<Record<string, boolean>>({});
  const [jobCccFetched, setJobCccFetched] = useState<Record<string, boolean>>({});
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'card' | 'ach' | 'other'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [deleteJobDialog, setDeleteJobDialog] = useState<{ open: boolean; jobId: string | null; jobTitle: string }>({ open: false, jobId: null, jobTitle: '' });
  const [deleteJobConfirmText, setDeleteJobConfirmText] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [jobTechnicianSelection, setJobTechnicianSelection] = useState<Record<string, string>>({});
  const [fabWarnings, setFabWarnings] = useState<string[]>([]);
  const [plasmaWarnings, setPlasmaWarnings] = useState<string[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [expandedLaborNotes, setExpandedLaborNotes] = useState<Record<string, boolean>>({});
  const [isBrowsePartsOpen, setIsBrowsePartsOpen] = useState(false);
  const [browsePartsInStockOnly, setBrowsePartsInStockOnly] = useState(false);
  const [browsePartsPage, setBrowsePartsPage] = useState(0);
  const [isBrowseCustomersOpen, setIsBrowseCustomersOpen] = useState(false);
  const [browseCustomersActiveOnly, setBrowseCustomersActiveOnly] = useState(true);
  const [browseCustomersPage, setBrowseCustomersPage] = useState(0);
  const prevOrderIdRef = useRef<string | undefined>(undefined);
  const didInitDefaultJobEditRef = useRef(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'jobs' | 'activity' | 'parts' | 'labor' | 'fabrication' | 'plasma' | 'time'
  >('overview');
  const { get: getSystemSetting } = useSystemSettings();
  const currentOrder =
    (workOrders.find((o) => o.id === id) as WorkOrderWithCcc | undefined) || order;
  const currentOrderId = currentOrder?.id ?? null;
  const currentOrderUpdatedAt =
    (currentOrder as any)?.updated_at ?? (currentOrder as any)?.updatedAt ?? null;
  const {
    isLocked: isInvoiced,
    lockMessage: workOrderLockMessage,
    notifyLocked: notifyWorkOrderLocked,
    guardLockedAction,
  } = useWorkOrderLock(currentOrder);

  useEffect(() => {
    const prev = lastTenantSettingsIdRef.current;
    const next = tenantSettingsId;
    if (prev && next && prev !== next) {
      // Tenant switch invalidates work order caches to prevent cross-tenant leakage.
      resetWorkOrdersForTenant();
      setOrder(null);
      if (!isNew) {
        navigate('/work-orders', { replace: true });
      }
    }
    lastTenantSettingsIdRef.current = next;
  }, [isNew, navigate, resetWorkOrdersForTenant, tenantSettingsId]);
  const scheduleItems = schedulingRepo.list();
  const isScheduled =
    !!currentOrder &&
    scheduleItems.some((s) => s.source_ref_type === 'WORK_ORDER' && s.source_ref_id === currentOrder.id);
  const isSchedulable = !!currentOrder && ['OPEN', 'IN_PROGRESS'].includes(currentOrder.status);
  const handleSendToSchedule = () => {
    if (!currentOrder) return;
    const res = schedulingRepo.ensureScheduleItemForWorkOrder(currentOrder);
    if (!res?.item) {
      toast({
        title: 'Not scheduled',
        description: res?.reason || 'Could not create schedule item',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Sent to Scheduling', description: 'Work order added to schedule' });
    navigate(`/scheduling?focusScheduleItemId=${res.item.id}&open=1`);
  };
  useEffect(() => {
    if (currentOrder && !isInvoiced) {
      plasmaRepo.createForWorkOrder(currentOrder.id);
      fabricationRepo.createForWorkOrder(currentOrder.id);
    }
  }, [currentOrder, fabricationRepo, isInvoiced, plasmaRepo]);
  useEffect(() => {
    setBrowsePartsPage(0);
  }, [browsePartsInStockOnly]);
  const aiPartSuggestions = useMemo(
    () => (aiAssistEnabled ? suggestParts(aiPartsQuery, parts) : []),
    [aiAssistEnabled, aiPartsQuery, parts]
  );
  const jobLines: WorkOrderJobLine[] = useMemo(
    () => {
      void workOrderJobLines;
      return currentOrder ? getWorkOrderJobLines(currentOrder.id) : [];
    },
    [currentOrder, getWorkOrderJobLines, workOrderJobLines]
  );
  const jobLinesForDisplay = useMemo(() => [...jobLines].reverse(), [jobLines]);
  const activityEvents = currentOrder ? getWorkOrderActivity(currentOrder.id) : [];
  const jobMap = useMemo(
    () => {
      const map: Record<string, WorkOrderJobLine> = {};
      jobLines.forEach((job) => {
        map[job.id] = job;
      });
      return map;
    },
    [jobLines]
  );
  const jobReadinessById = useMemo(() => {
    const map: Record<string, WorkOrderJobPartsStatus> = {};
    jobLines.forEach((job) => {
      map[job.id] = getJobPartReadiness(job.id);
    });
    return map;
  }, [jobLines, getJobPartReadiness]);
  const allPartLines = currentOrder ? getWorkOrderPartLines(currentOrder.id) : [];
  const laborLines = useMemo(
    () => (currentOrder ? getWorkOrderLaborLines(currentOrder.id) : []),
    [currentOrder, getWorkOrderLaborLines]
  );
  const partLines = allPartLines.filter((l) => !l.is_core_refund_line);
  const activeJobTimers = currentOrder ? getActiveJobTimers(currentOrder.id) : [];
  const orderTotal = toNumeric(currentOrder?.total);
  const payments = usePayments('WORK_ORDER', currentOrder?.id, orderTotal);
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
  const workOrderActualHours = currentOrder ? getWorkOrderActualHours(currentOrder.id) : 0;
  const laborRate = getSystemSetting('labor_rate');
  const jobProfitSummaries = useMemo(() => {
    const summary: Record<string, JobProfitSummary> = {};
    jobLines.forEach((job) => {
      const jobPartLines = partLines.filter((line) => line.job_line_id === job.id);
      const jobLaborLines = laborLines.filter((line) => line.job_line_id === job.id);
      const jobTimeEntries = getJobTimeEntries(job.id);
      const jobActualHours = getJobActualHours(job.id);
      const partsRevenue = jobPartLines.reduce((sum, line) => sum + toNumeric(line.line_total), 0);
      const partsCost = jobPartLines.reduce((sum, line) => {
        const part = parts.find((p) => p.id === line.part_id);
        return sum + line.quantity * (part?.cost ?? 0);
      }, 0);
      let laborCost = 0;
      let hasLaborCost = false;
      jobTimeEntries.forEach((entry) => {
        const entryHours = computeEntryHours(entry);
        const technician = entry.technician_id ? technicians.find((t) => t.id === entry.technician_id) : undefined;
        const rate = technician?.hourly_cost_rate ?? 0;
        if (technician && rate > 0) {
          hasLaborCost = true;
          laborCost += entryHours * rate;
        }
      });
      const laborRevenue = jobActualHours * laborRate;
      const revenue = partsRevenue + laborRevenue;
      const cost = partsCost + laborCost;
      const margin = revenue - cost;
      const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;
      summary[job.id] = {
        jobPartLines,
        jobLaborLines,
        jobActualHours,
        partsRevenue,
        partsCost,
        laborRevenue,
        laborCost,
        hasLaborCost,
        margin,
        marginPercent,
      };
    });
    return summary;
  }, [jobLines, partLines, laborLines, parts, technicians, laborRate, getJobTimeEntries, getJobActualHours]);
  const woProfitTotals = useMemo(() => {
    const totals = Object.values(jobProfitSummaries).reduce(
      (acc, summary) => ({
        partsRevenue: acc.partsRevenue + summary.partsRevenue,
        partsCost: acc.partsCost + summary.partsCost,
        laborRevenue: acc.laborRevenue + summary.laborRevenue,
        laborCost: acc.laborCost + summary.laborCost,
        margin: acc.margin + summary.margin,
      }),
      { partsRevenue: 0, partsCost: 0, laborRevenue: 0, laborCost: 0, margin: 0 }
    );
    const revenue = totals.partsRevenue + totals.laborRevenue;
    return {
      ...totals,
      marginPercent: revenue > 0 ? (totals.margin / revenue) * 100 : 0,
    };
  }, [jobProfitSummaries]);
  const jobReadinessValues = Object.values(jobReadinessById);
  const hasWaitingPartsStatus = jobLines.some((job) => job.status === 'WAITING_PARTS');
  const hasWaitingApprovalStatus = jobLines.some((job) => job.status === 'WAITING_APPROVAL');
  const hasQAStatus = jobLines.some((job) => job.status === 'QA');
  const hasPartsMissingReadiness = jobReadinessValues.some((status) => status.readiness === 'MISSING');
  const hasPartsRiskReadiness = jobReadinessValues.some((status) => status.readiness === 'RISK');
  const blockerChips = [
    hasWaitingPartsStatus && { label: 'Waiting on Parts', variant: 'outline' },
    hasWaitingApprovalStatus && { label: 'Waiting Approval', variant: 'outline' },
    hasQAStatus && { label: 'QA', variant: 'outline' },
    hasPartsMissingReadiness && { label: 'Parts Missing', variant: 'destructive' },
    hasPartsRiskReadiness && { label: 'Parts Risk', variant: 'secondary' },
  ].filter((chip): chip is BlockerChip => Boolean(chip));
  const firstJobToSave =
    jobLines.length === 1 ? jobLines[0] : jobLines.find((job) => job.title === 'General') ?? null;
  const isFirstJobBlocking =
    firstJobToSave && jobLines.length === 1 && (jobEditingMode[firstJobToSave.id] ?? false);
  const addJobDisabled = isInvoiced || !currentOrder || Boolean(isFirstJobBlocking);

  const fetchJobCCC = useCallback(
    async (jobId: string) => {
      setJobCccLoading((prev) => ({ ...prev, [jobId]: true }));
      try {
        const { data, error } = await supabase
          .from('work_order_jobs')
          .select('complaint, cause, correction')
          .eq('id', jobId)
          .maybeSingle();
        if (error) {
          toast({ title: 'Load failed', description: error.message, variant: 'destructive' });
        }
        const ccc = {
          complaint: data?.complaint ?? '',
          cause: data?.cause ?? '',
          correction: data?.correction ?? '',
        };
        setJobCccPersisted((prev) => ({ ...prev, [jobId]: ccc }));
        setJobCccDrafts((prev) => ({ ...prev, [jobId]: prev[jobId] ?? ccc }));
      } finally {
        setJobCccFetched((prev) => ({ ...prev, [jobId]: true }));
        setJobCccLoading((prev) => ({ ...prev, [jobId]: false }));
      }
    },
    [toast]
  );

  const upsertJobCCC = useCallback(
    async (
      jobId: string,
      workOrderId: string,
      ccc: WorkOrderCccDraft,
      title: string,
      status: WorkOrderJobStatus
    ) => {
      const { data } = await supabase
        .from('work_order_jobs')
        .select('id')
        .eq('id', jobId)
        .maybeSingle();
      if (!data?.id) return false;
      const { error } = await supabase
        .from('work_order_jobs')
        .update({
          title,
          status,
          complaint: ccc.complaint || null,
          cause: ccc.cause || null,
          correction: ccc.correction || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      if (error) throw error;
      return true;
    },
    []
  );

  useEffect(() => {
    if (jobLines.length === 0) {
      setSelectedJobId(null);
      return;
    }
    if (selectedJobId && jobLines.some((job) => job.id === selectedJobId)) return;
    setSelectedJobId(jobLines[0].id);
  }, [jobLines, selectedJobId]);

  useEffect(() => {
    if (jobLines.length === 0) return;
    setJobCccDrafts((prev) => {
      const next = { ...prev };
      let updated = false;
      jobLines.forEach((job) => {
        if (!next[job.id]) {
          next[job.id] = {
            complaint: job.complaint ?? '',
            cause: job.cause ?? '',
            correction: job.correction ?? '',
          };
          updated = true;
        }
      });
      return updated ? next : prev;
    });
    setJobCccPersisted((prev) => {
      const next = { ...prev };
      let updated = false;
      jobLines.forEach((job) => {
        if (!next[job.id]) {
          next[job.id] = {
            complaint: job.complaint ?? '',
            cause: job.cause ?? '',
            correction: job.correction ?? '',
          };
          updated = true;
        }
      });
      return updated ? next : prev;
    });
  }, [jobLines]);

  useEffect(() => {
    const jobId = selectedJobId;
    if (!jobId) return;
    if (jobCccFetched[jobId]) return;
    if (jobCccLoading[jobId]) return;
    fetchJobCCC(jobId);
  }, [fetchJobCCC, jobCccFetched, jobCccLoading, selectedJobId]);

  useEffect(() => {
    if (!isNew && currentOrder?.id) {
      woEnsureDefaultJobLine(currentOrder.id);
    }
  }, [currentOrder?.id, isNew, woEnsureDefaultJobLine]);

  useEffect(() => {
    if (jobLines.length === 0) return;
    setJobDrafts((prev) => {
      const next = { ...prev };
      let updated = false;
      jobLines.forEach((job) => {
        if (!next[job.id]) {
          next[job.id] = {
            title: job.title,
            status: job.status,
          };
          updated = true;
        }
      });
      return updated ? next : prev;
    });
  }, [jobLines]);

  useEffect(() => {
    if (jobLines.length === 0) return;

    // Find the default "General" job for this work order
    const generalJob = jobLines.find((job) => job.title === 'General');
    if (!generalJob) return;
    if (didInitDefaultJobEditRef.current) return;

    // If it's already in editing mode, do nothing
    if (jobEditingMode[generalJob.id]) return;

    const draft = jobDrafts[generalJob.id];
    if (!draft) return;

    // Only auto-edit if the draft still matches the pristine job state
    const isPristine = draft.title === generalJob.title && draft.status === generalJob.status;

    if (!isPristine) return;

    // Clear title so the input shows the "Job Title" placeholder
    setJobDrafts((prev) => ({
      ...prev,
      [generalJob.id]: {
        ...prev[generalJob.id],
        title: '',
      },
    }));

    // Start the default job in editing mode
    setJobEditingMode((prev) => ({
      ...prev,
      [generalJob.id]: true,
    }));
    didInitDefaultJobEditRef.current = true;
  }, [jobLines, jobDrafts, jobEditingMode]);

  const handleJobDraftChange = <K extends keyof JobDraft>(jobId: string, field: K, value: JobDraft[K]) => {
    setJobDrafts((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        [field]: value,
      },
    }));
  };

  const handleJobCccChange = <K extends keyof WorkOrderCccDraft>(
    jobId: string,
    field: K,
    value: WorkOrderCccDraft[K]
  ) => {
    setJobCccDrafts((prev) => ({
      ...prev,
      [jobId]: {
        ...(prev[jobId] ?? { complaint: '', cause: '', correction: '' }),
        [field]: value,
      },
    }));
  };

  const handleSaveJob = async (jobId: string) => {
    if (isInvoiced) {
      notifyWorkOrderLocked();
      return;
    }
    const job = jobLines.find((j) => j.id === jobId);
    const workOrderId = job?.work_order_id ?? currentOrder?.id ?? order?.id;
    const fallbackDraft: JobDraft = {
      title: job?.title ?? 'Job',
      status: (job?.status ?? 'INTAKE') as WorkOrderJobStatus,
    };
    const effectiveDraft = jobDrafts[jobId] ?? fallbackDraft;
    if (!jobDrafts[jobId]) {
      setJobDrafts((prev) => ({
        ...prev,
        [jobId]: {
          title: effectiveDraft.title,
          status: effectiveDraft.status,
        },
      }));
    }
    if (!workOrderId) {
      toast({
        title: 'Save failed',
        description: 'Work order not found',
        variant: 'destructive',
      });
      return;
    }
    const selectedTechnicianId = jobTechnicianSelection[jobId] || '';
    const hasValidTechnician = Boolean(
      selectedTechnicianId && technicians.some((technician) => technician.id === selectedTechnicianId)
    );
    const title = effectiveDraft.title.trim();
    if (!title || !hasValidTechnician) {
      toast({
        title: 'Missing required fields',
        description: 'Select a technician and enter a job title before saving.',
        variant: 'destructive',
      });
      return;
    }
    setJobSaving((prev) => ({ ...prev, [jobId]: true }));
    const cccDraft = jobCccDrafts[jobId] ?? { complaint: '', cause: '', correction: '' };
    const status = effectiveDraft.status;
    try {
      const cccSaved = await upsertJobCCC(jobId, workOrderId, cccDraft, title, status);
      woUpdateJobLine(jobId, {
        title,
        status,
      });
      setJobDrafts((prev) => ({
        ...prev,
        [jobId]: {
          title,
          status: status as WorkOrderJobStatus,
        },
      }));
      if (cccSaved) {
        setJobCccPersisted((prev) => ({
          ...prev,
          [jobId]: {
            complaint: cccDraft.complaint ?? '',
            cause: cccDraft.cause ?? '',
            correction: cccDraft.correction ?? '',
          },
        }));
        setJobCccDrafts((prev) => ({
          ...prev,
          [jobId]: {
            complaint: cccDraft.complaint ?? '',
            cause: cccDraft.cause ?? '',
            correction: cccDraft.correction ?? '',
          },
        }));
        setJobCccFetched((prev) => ({ ...prev, [jobId]: true }));
      } else {
        toast({
          title: 'Saved job (CCC pending)',
          description: 'Job saved. Complaint/Cause/Correction will save after this job is synced.',
        });
      }
      setJobEditingMode((prev) => ({ ...prev, [jobId]: false }));
      toast({ title: 'Job Saved', description: `${title || 'Job'} has been saved` });
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error?.message || 'Unable to save job',
        variant: 'destructive',
      });
    } finally {
      setJobSaving((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const handleEditJob = (jobId: string) => {
    const job = jobLines.find((j) => j.id === jobId);
    if (!job) return;
    setSelectedJobId(jobId);
    setJobCccDrafts((prev) => ({
      ...prev,
      [jobId]: prev[jobId] ?? jobCccPersisted[jobId] ?? { complaint: '', cause: '', correction: '' },
    }));
    // Initialize draft from current job state if not already in drafts
    setJobDrafts((prev) => ({
      ...prev,
      [jobId]: prev[jobId] ?? {
        title: job.title,
        status: job.status,
      },
    }));
    setJobEditingMode((prev) => ({ ...prev, [jobId]: true }));
  };

  const handleCancelEditJob = (jobId: string) => {
    const job = jobLines.find((j) => j.id === jobId);
    if (!job) return;
    // Reset draft to current job state
    setJobDrafts((prev) => ({
      ...prev,
      [jobId]: {
        title: job.title,
        status: job.status,
      },
    }));
    const persistedCcc = jobCccPersisted[jobId] ?? { complaint: '', cause: '', correction: '' };
    setJobCccDrafts((prev) => ({
      ...prev,
      [jobId]: persistedCcc,
    }));
    setJobEditingMode((prev) => ({ ...prev, [jobId]: false }));
  };

  const handleDeleteJob = (jobId: string) => {
    const result = woDeleteJobLine(jobId);
    if (result.success) {
      toast({ title: 'Job Deleted', description: 'The job has been removed' });
      setDeleteJobDialog({ open: false, jobId: null, jobTitle: '' });
      setDeleteJobConfirmText('');
      setJobDrafts((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      setJobCccDrafts((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      setJobCccPersisted((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      setJobCccFetched((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      setJobCccLoading((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      useShopStore.setState((state) => ({
        workOrderJobLines: state.workOrderJobLines.filter((j) => j.id !== jobId),
      }));
      const remaining = jobLines.filter((j) => j.id !== jobId);
      if (selectedJobId === jobId) {
        setSelectedJobId(remaining[0]?.id ?? null);
      }
    } else {
      toast({ title: 'Cannot Delete Job', description: result.error, variant: 'destructive' });
    }
  };

  const openDeleteJobDialog = (job: WorkOrderJobLine) => {
    setDeleteJobDialog({ open: true, jobId: job.id, jobTitle: job.title });
    setDeleteJobConfirmText('');
  };

  const handleAddJob = () => {
    if (!currentOrder || !newJobTitle.trim()) return;
    guardLockedAction(() => {
      const job = woCreateJobLine(currentOrder.id, newJobTitle.trim());
      setNewJobTitle('');
      setJobDrafts((prev) => ({
        ...prev,
        [job.id]: {
          title: job.title,
          status: job.status,
        },
      }));
      const blankCcc = { complaint: '', cause: '', correction: '' };
      setJobCccDrafts((prev) => ({
        ...prev,
        [job.id]: blankCcc,
      }));
      setJobCccPersisted((prev) => ({
        ...prev,
        [job.id]: blankCcc,
      }));
      setJobCccFetched((prev) => ({ ...prev, [job.id]: true }));
      // New jobs start in editing mode
      setJobEditingMode((prev) => ({ ...prev, [job.id]: true }));
      setActiveTab('jobs');
      setSelectedJobId(job.id);
    });
  };
  const handleJobClockIn = (jobId: string) => {
    if (!currentOrder) return;
    const technicianId = jobTechnicianSelection[jobId];
    if (!technicianId) {
      toast({ title: 'Error', description: 'Please select a technician first', variant: 'destructive' });
      return;
    }
    const technicianName = technicians.find((t) => t.id === technicianId)?.name ?? null;
    const result = woClockIn(currentOrder.id, jobId, technicianId, technicianName);
    if (result.success) {
      const techLabel = result.entry?.technician_name || 'Technician';
      const jobTitle = jobMap[jobId]?.title || 'Job';
      toast({ title: 'Clocked In', description: `${techLabel} started ${jobTitle}` });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };
  const handleJobClockOut = (timeEntryId: string) => {
    const result = woClockOut(timeEntryId);
    if (result.success) {
      const techLabel = result.entry?.technician_name || 'Technician';
      const jobTitle = jobMap[result.entry?.job_line_id || '']?.title || 'Job';
      toast({ title: 'Clocked Out', description: `${techLabel} stopped ${jobTitle}` });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };
  const handleMarkJobWaitingParts = (job: WorkOrderJobLine) => {
    if (job.status === 'WAITING_PARTS') return;
    const updated = woSetJobStatus(job.id, 'WAITING_PARTS');
    if (updated) {
      toast({ title: 'Job status updated', description: `Job '${updated.title}' marked Waiting on Parts` });
    }
  };
  const activeCustomers = useMemo(
    () => customers.filter((c) => c.is_active && c.id !== 'walkin'),
    [customers]
  );
  const customerPickerItems = useMemo(
    () =>
      activeCustomers.map((c) => {
        const company = (c as any).company_name ?? '';
        const contact = (c as any).contact_name ?? '';
        const phone = (c as any).phone ? String((c as any).phone) : '';
        const email = (c as any).email || '';
        const street = (c as any).street_1 ?? (c as any).street ?? (c as any).address ?? '';
        const city = (c as any).city ?? '';
        const state = (c as any).state ?? '';
        const postal = (c as any).postal_code ?? '';

        const primaryParts = [company, contact, phone].filter(Boolean);
        const secondaryParts = [email, street, city, state, postal].filter(Boolean);

        const baseLabel = primaryParts.length > 0 ? primaryParts.join(' • ') : 'Unnamed customer';
        const label = secondaryParts.length > 0 ? `${baseLabel} — ${secondaryParts.join(', ')}` : baseLabel;

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
    const custId = selectedCustomerId || currentOrder?.customer_id;
    if (!custId) return [];
    return units.filter((u) => u.customer_id === custId && u.is_active);
  }, [selectedCustomerId, currentOrder?.customer_id, units]);
  const unitPickerItems = useMemo(
    () =>
      customerUnits.map((u) => {
        const label = u.unit_name || (u as any).display_name || (u as any).identifier || 'Unit';
        const searchText = [
          u.unit_name,
          (u as any).display_name,
          (u as any).identifier,
          u.vin,
          (u as any).serial_number,
          u.make,
          u.model,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return {
          id: String(u.id),
          label: u.vin ? `${label} – ${u.vin.slice(-6)}` : label,
          searchText,
          meta: {
            vin: u.vin ?? '',
            serial: (u as any).serial_number ?? '',
          },
        };
      }),
    [customerUnits]
  );
  const activeParts = parts.filter((p) => p.is_active);
  const partPickerItems = useMemo(
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
          meta: {
            quantity_on_hand: (part as any).quantity_on_hand ?? 0,
            vendor,
            category,
          },
        };
      }),
    [activeParts]
  );
  const browseableCustomers = useMemo(
    () =>
      customers.filter((c) => {
        if (browseCustomersActiveOnly && c.is_active === false) {
          return false;
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
  const activeTechnicians = technicians.filter((t) => t.is_active);
  const activeVendors = vendors.filter((v) => v.is_active);
  const activeCategories = categories.filter((c) => c.is_active);

  const isEstimate = currentOrder?.status === 'ESTIMATE';
  const showMobileActionBar = isMobile && !!currentOrder && !isInvoiced;
  const workOrderClaims = useMemo(
    () => (currentOrder ? getClaimsByWorkOrder(currentOrder.id) : []),
    [currentOrder, getClaimsByWorkOrder]
  );
  const poLinesByPo = useMemo(() => {
    return purchaseOrderLines.reduce((acc: Record<string, typeof purchaseOrderLines>, line) => {
      acc[line.purchase_order_id] = acc[line.purchase_order_id] || [];
      acc[line.purchase_order_id].push(line);
      return acc;
    }, {});
  }, [purchaseOrderLines]);
  const linkedPurchaseOrders = useMemo(() => {
    if (!currentOrder) return [];
    return purchaseOrders
      .filter((po) => po.work_order_id === currentOrder.id)
      .map((po) => ({
        ...po,
        derivedStatus: getPurchaseOrderDerivedStatus(po, poLinesByPo[po.id] || []),
      }));
  }, [currentOrder, poLinesByPo, purchaseOrders]);

  const chargeLines = useMemo(
    () => (currentOrder ? workOrderRepo.getWorkOrderChargeLines(currentOrder.id) : []),
    [currentOrder, workOrderRepo]
  );
  const fabData = currentOrder ? fabricationRepo.getByWorkOrder(currentOrder.id) : null;
  const fabJob = fabData?.job;
  const fabLines = useMemo(() => fabData?.lines ?? [], [fabData?.lines]);
  const fabChargeLine = chargeLines.find(
    (line) => line.source_ref_type === 'FAB_JOB' && line.source_ref_id === fabJob?.id
  );
  const fabLocked = isInvoiced;
  const fabSummary = useMemo(() => summarizeFabJob(fabLines), [fabLines]);
  const fabTotal = fabSummary.total_sell;
  const [showFabValidation, setShowFabValidation] = useState(false);
  useEffect(() => {
    setFabWarnings(fabJob?.warnings ?? []);
  }, [fabJob?.warnings]);
  const formattedFabWarnings = useMemo(() => {
    if (!showFabValidation) return [];
    const counters: Record<string, number> = {};
    const missingFromLines = fabLines
      .map((line) => {
        const info = getFabMissingInfo(line);
        const typeKey = line.operation_type;
        const typeLabel = typeKey === 'PRESS_BRAKE' ? 'Press Brake' : typeKey === 'WELD' ? 'Weld' : 'Fabrication';
        counters[typeKey] = (counters[typeKey] || 0) + 1;
        const lineNumber = counters[typeKey];
        if (info.missingFields.length === 0 || info.validOverridePath) return null;
        return {
          typeLabel,
          lineNumber,
          message: `needs: ${info.missingFields.join(', ')}`,
          key: `${typeKey}-${lineNumber}-${info.missingFields.join('-')}`,
        };
      })
      .filter(Boolean) as { typeLabel: string; lineNumber: number; message: string; key: string }[];

    if (missingFromLines.length > 0) return missingFromLines;

    const countersFallback: Record<string, number> = {};
    return fabWarnings.map((warning) => {
      const cleaned = warning.replace(/^Line\\s+[^:]+:\\s*/i, '').trim();
      const [rawType, ...rest] = cleaned.split(':');
      const typeKey = rawType?.trim().toUpperCase() || '';
      const typeLabel = typeKey === 'PRESS_BRAKE' ? 'Press Brake' : typeKey === 'WELD' ? 'Weld' : 'Fabrication';
      countersFallback[typeKey] = (countersFallback[typeKey] || 0) + 1;
      const lineNumber = countersFallback[typeKey];
      const bodyWithoutPrefix = rest.join(':').trim().replace(/^line\\s+\\d+\\s*/i, '');
      return {
        typeLabel,
        lineNumber,
        message: bodyWithoutPrefix || cleaned,
        key: `${typeKey}-${lineNumber}-${bodyWithoutPrefix}`,
      };
    });
  }, [fabLines, fabWarnings, showFabValidation]);
  const plasmaData = currentOrder ? plasmaRepo.getByWorkOrder(currentOrder.id) : null;
  const plasmaJob = plasmaData?.job;
  const plasmaLines = useMemo(() => plasmaData?.lines ?? [], [plasmaData?.lines]);
  const plasmaTotal = plasmaLines.reduce((sum, line) => sum + toNumeric(line.sell_price_total), 0);
  const plasmaChargeLine = chargeLines.find(
    (line) => line.source_ref_type === 'PLASMA_JOB' && line.source_ref_id === plasmaJob?.id
  );
  const plasmaTemplateOptions = useMemo(() => plasmaRepo.templates.list(), [plasmaRepo]);
  const plasmaLocked =
    isInvoiced || (plasmaJob ? plasmaJob.status !== 'DRAFT' && plasmaJob.status !== 'QUOTED' : false);
  const plasmaAttachments = plasmaJob ? plasmaRepo.attachments.list(plasmaJob.id) : [];
  const [dxfAssistOpen, setDxfAssistOpen] = useState(false);
  const [showPlasmaDetails, setShowPlasmaDetails] = useState(false);

  const fabHasData = Boolean(fabJob);
  const plasmaHasData = Boolean(plasmaJob);

  const profitability = useMemo(() => {
    const partsRevenue = partLines.reduce((sum, line) => sum + (line.is_warranty ? 0 : toNumeric(line.line_total)), 0);
    const partsCostEntries = partLines
      .map((line) => {
        const part = parts.find((p) => p.id === line.part_id);
        return part?.cost != null ? toNumeric(part.cost) * toNumeric(line.quantity) : null;
      })
      .filter((v) => v != null) as number[];
    const partsHasCost = partsCostEntries.length > 0;
    const partsCost = partsCostEntries.reduce((sum, value) => sum + value, 0);

    const laborRevenue = laborLines.reduce((sum, line) => sum + (line.is_warranty ? 0 : toNumeric(line.line_total)), 0);
    const laborHasCost = false;

    const otherCharges = chargeLines.filter(
      (line) => line.source_ref_type !== 'PLASMA_JOB' && line.source_ref_type !== 'FAB_JOB'
    );
    const feesRevenue = otherCharges.reduce((sum, line) => sum + toNumeric(line.total_price), 0);
    const feesHasCost = false;

    const plasmaCostEntries = plasmaLines
      .map((line) => {
        const costs = [line.material_cost, line.consumables_cost, line.labor_cost, line.overhead_cost].filter(
          (v) => v != null
        ) as (number | string)[];
        if (costs.length === 0) return null;
        return costs.reduce((sum, val) => sum + toNumeric(val), 0);
      })
      .filter((v) => v != null) as number[];
    const plasmaHasCost = plasmaCostEntries.length > 0;
    const plasmaCost = plasmaCostEntries.reduce((sum, val) => sum + val, 0);

    const fabHasCost = fabHasData && fabSummary.total_cost != null;
    const fabCost = fabHasCost ? fabSummary.total_cost : null;

    const categories = [
      { label: 'Parts', revenue: partsRevenue, hasCost: partsHasCost, cost: partsHasCost ? partsCost : null },
      { label: 'Labor', revenue: laborRevenue, hasCost: laborHasCost, cost: null },
      { label: 'Fees/Sublet', revenue: feesRevenue, hasCost: feesHasCost, cost: null },
      ...(plasmaHasData
        ? [
            {
              label: 'Plasma',
              revenue: plasmaTotal,
              hasCost: plasmaHasCost,
              cost: plasmaHasCost ? plasmaCost : null,
            },
          ]
        : []),
      ...(fabHasData
        ? [
            {
              label: 'Fabrication',
              revenue: fabTotal,
              hasCost: fabHasCost,
              cost: fabHasCost ? fabCost : null,
            },
          ]
        : []),
    ].map((cat) => ({
      ...cat,
      gp: cat.hasCost && cat.cost != null ? cat.revenue - cat.cost : null,
      gpPct: cat.hasCost && cat.cost != null && cat.revenue > 0 ? ((cat.revenue - cat.cost) / cat.revenue) * 100 : null,
    }));

    const overallRevenue = categories.reduce((sum, c) => sum + c.revenue, 0);
    const allCostsKnown = categories.every((c) => c.hasCost && c.cost != null);
    const overallCost = allCostsKnown
      ? categories.reduce((sum, c) => sum + (c.cost ?? 0), 0)
      : null;
    const overallGp = allCostsKnown && overallCost != null ? overallRevenue - overallCost : null;
    const overallGpPct =
      allCostsKnown && overallCost != null && overallRevenue > 0 ? (overallGp! / overallRevenue) * 100 : null;

    return {
      categories,
      overall: {
        revenue: overallRevenue,
        hasCost: allCostsKnown,
        cost: overallCost,
        gp: overallGp,
        gpPct: overallGpPct,
      },
    };
  }, [
    chargeLines,
    fabHasData,
    fabSummary.total_cost,
    fabTotal,
    laborLines,
    partLines,
    parts,
    plasmaHasData,
    plasmaLines,
    plasmaTotal,
  ]);

  // Lines
  const otherChargeLines = chargeLines.filter(
    (line) => line.source_ref_type !== 'PLASMA_JOB' && line.source_ref_type !== 'FAB_JOB'
  );
  const refundLines = allPartLines.filter((l) => l.is_core_refund_line);

  // Time tracking data
  const timeEntries = currentOrder ? getTimeEntriesByWorkOrder(currentOrder.id) : [];
  const totalMinutes = timeEntries.reduce((sum, te) => sum + te.total_minutes, 0);
  const totalHours = formatNumber(totalMinutes / 60);
  useEffect(() => {
    const orderId = currentOrder?.id;
    if (orderId && orderId !== prevOrderIdRef.current) {
      setActiveTab('overview');
    }
    if (!orderId && prevOrderIdRef.current) {
      setActiveTab('overview');
    }
    prevOrderIdRef.current = orderId;
  }, [currentOrder?.id]);

  useEffect(() => {
    didInitDefaultJobEditRef.current = false;
  }, [currentOrder?.id]);

  if (!isNew && !currentOrder) {
    return (
      <div className="page-container">
        <style>{PRINT_STYLES}</style>
        <PageHeader title="Work Order Not Available" backTo="/work-orders" />
        <p className="text-muted-foreground">Work Order not available in this tenant.</p>
      </div>
    );
  }

  const handleCreateOrder = () => {
    if (!selectedCustomerId) {
      toast({ title: 'Error', description: 'Please select a customer', variant: 'destructive' });
      return;
    }
    if (!selectedUnitId) {
      toast({ title: 'Error', description: 'Please select a unit', variant: 'destructive' });
      return;
    }
    const newOrder = createWorkOrder(selectedCustomerId, selectedUnitId);
    navigate(`/work-orders/${newOrder.id}`, { replace: true });
    setOrder(newOrder);
    toast({ title: 'Order Created', description: `Work Order ${newOrder.order_number} created` });
  };

  const handleAddPart = () => {
    if (!selectedPartId || !currentOrder) return;
    const part = repos.parts.parts.find((p) => p.id === selectedPartId);
    const qtyResult = normalizeQty(part, partQty);
    if (!qtyResult.ok) {
      toast({ title: 'Validation Error', description: qtyResult.error, variant: 'destructive' });
      return;
    }
    const result = woAddPartLine(currentOrder.id, selectedPartId, qtyResult.qty, partDialogJobLineId ?? null);
    if (result.success) {
      toast({ title: 'Part Added' });
      handlePartDialogOpenChange(false);
      setSelectedPartId('');
      setPartQty('1');
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const openPartDialog = (jobLineId: string | null) => {
    setPartDialogJobLineId(jobLineId);
    setAddPartDialogOpen(true);
  };

  const handlePartDialogOpenChange = (open: boolean) => {
    setAddPartDialogOpen(open);
    if (!open) {
      setPartDialogJobLineId(null);
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

  const resetQuickAddVendorForm = () => {
    setNewVendorName('');
    setNewVendorPhone('');
    setNewVendorEmail('');
  };

  const handleQuickAddVendor = () => {
    const vendorName = newVendorName.trim();
    if (!vendorName) {
      toast({
        title: 'Validation Error',
        description: 'Vendor name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const newVendor = repos.vendors.addVendor({
        vendor_name: vendorName,
        phone: newVendorPhone.trim() || null,
        email: newVendorEmail.trim() || null,
        notes: null,
      });
      setNewPartData((prev) => ({ ...prev, vendor_id: newVendor.id }));
      setQuickAddVendorOpen(false);
      resetQuickAddVendorForm();
      toast({ title: 'Vendor Added', description: `${newVendor.vendor_name} has been created` });
    } catch (error) {
      toast({
        title: 'Unable to add vendor',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const resetQuickAddCategoryForm = () => {
    setNewCategoryName('');
  };

  const handleQuickAddCategory = () => {
    const categoryName = newCategoryName.trim();
    if (!categoryName) {
      toast({
        title: 'Validation Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const category = addCategory({
        category_name: categoryName,
        description: null,
      });
      setNewPartData((prev) => ({ ...prev, category_id: category.id }));
      setQuickAddCategoryOpen(false);
      resetQuickAddCategoryForm();
      toast({ title: 'Category Added', description: `${category.category_name} has been created` });
    } catch (error) {
      toast({
        title: 'Unable to add category',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateQty = (lineId: string, newQty: number | string) => {
    const line = partLines.find((l) => l.id === lineId);
    if (!line) return;
    const part = repos.parts.parts.find((p) => p.id === line.part_id);
    const qtyResult = normalizeQty(part, newQty);
    if (!qtyResult.ok) {
      toast({ title: 'Validation Error', description: qtyResult.error, variant: 'destructive' });
      return;
    }
    if (qtyResult.qty <= 0) {
      handleRemovePartLine(lineId);
      return;
    }
    const result = woUpdatePartQty(lineId, qtyResult.qty);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleRemovePartLine = (lineId: string) => {
    const result = woRemovePartLine(lineId);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleAddLabor = () => {
    if (!laborDescription.trim() || !currentOrder) return;
    const hasValidTechnician = Boolean(
      laborTechnicianId && technicians.some((technician) => technician.id === laborTechnicianId)
    );
    if (!hasValidTechnician) {
      toast({
        title: 'Validation Error',
        description: 'Select a valid technician before adding labor.',
        variant: 'destructive',
      });
      return;
    }
    const hours = parseFloat(laborHours) || 1;
    const result = woAddLaborLine(
      currentOrder.id,
      laborDescription.trim(),
      hours,
      laborTechnicianId || undefined,
      laborDialogJobLineId ?? null
    );
    if (result.success) {
      toast({ title: 'Labor Added' });
      handleLaborDialogOpenChange(false);
      setLaborDescription('');
      setLaborHours('1');
      setLaborTechnicianId('');
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const openLaborDialog = (jobLineId: string | null) => {
    setLaborDialogJobLineId(jobLineId);
    setAddLaborDialogOpen(true);
  };

  const handleLaborDialogOpenChange = (open: boolean) => {
    setAddLaborDialogOpen(open);
    if (!open) {
      setLaborDialogJobLineId(null);
    }
  };

  const handleRemoveLaborLine = (lineId: string) => {
    const result = woRemoveLaborLine(lineId);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleClockIn = (technicianId: string) => {
    if (!currentOrder) return;
    const result = clockIn(technicianId, currentOrder.id);
    if (result.success) {
      const tech = technicians.find((t) => t.id === technicianId);
      toast({ title: 'Clocked In', description: `${tech?.name} is now working on this order` });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleClockOut = (technicianId: string) => {
    const result = clockOut(technicianId);
    if (result.success) {
      toast({ title: 'Clocked Out' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleStartWork = () => {
    if (!currentOrder) return;
    const result = woUpdateStatus(currentOrder.id, 'IN_PROGRESS');
    if (result.success) {
      toast({ title: 'Work Started', description: 'Work order is now in progress' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };
  const handleInvoice = async () => {
    if (!canCreateInvoices) {
      toast({
        title: 'Permission Denied',
        description: "You don't have permission to create invoices.",
        variant: 'destructive',
      });
      return;
    }
    if (!currentOrder) return;
    if (isCustomerOnHold) {
      toast({
        title: 'Credit Hold',
        description: 'Cannot invoice while customer is on credit hold.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { invoiceId } = await repos.invoices.createFromWorkOrder({ workOrderId: currentOrder.id });

      const invoiceResult = woInvoice(currentOrder.id);
      if (invoiceResult.success) {
        try {
          const invoiceForExport = await repos.invoices.getById({ invoiceId });
          const invoiceLinesForExport = await repos.invoices.listLines({ invoiceId });
          const exportResult = await autoExportOnFinalize(invoiceForExport, invoiceLinesForExport);
          if (exportResult.status === 'queued') {
            toast({ title: 'Export queued', description: 'Invoice export saved to accounting_exports.' });
          } else if (exportResult.status === 'duplicate') {
            toast({ title: 'Export already generated', description: 'Duplicate invoice export detected.' });
          } else if (exportResult.status === 'skipped') {
            toast({
              title: 'Export skipped',
              description: exportResult.reason ?? 'QuickBooks export trigger/config skipped this invoice.',
              variant: 'destructive',
            });
          } else if (exportResult.status === 'failed') {
            toast({
              title: 'Export failed',
              description: exportResult.error ?? 'Unable to queue QuickBooks export.',
              variant: 'destructive',
            });
          }
        } catch (exportErr: any) {
          toast({
            title: 'Export failed',
            description: exportErr?.message ?? 'Unable to queue QuickBooks export.',
            variant: 'destructive',
          });
        }

        toast({ title: 'Order Invoiced', description: 'Work order has been invoiced and locked' });
        setShowInvoiceDialog(false);
        navigate(`/invoices/${invoiceId}`);
      } else {
        toast({ title: 'Error', description: invoiceResult.error, variant: 'destructive' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: 'Error', description: message, variant: 'destructive' });
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

  const handleQuickAddUnit = () => {
    if (!newUnitName.trim() || !selectedCustomerId) return;
    const newUnit = addUnit({
      customer_id: selectedCustomerId,
      unit_name: newUnitName.trim(),
      vin: null,
      year: null,
      make: null,
      model: null,
      mileage: null,
      hours: null,
      notes: null,
    });
    setSelectedUnitId(newUnit.id);
    setQuickAddUnitOpen(false);
    setNewUnitName('');
    toast({ title: 'Unit Added' });
  };

  const handleEditNotes = () => {
    setNotesValue(currentOrder?.notes || '');
    setIsEditingNotes(true);
  };

  const handleSaveNotes = () => {
    if (!currentOrder) return;
    updateWorkOrderNotes(currentOrder.id, notesValue.trim() || null);
    setIsEditingNotes(false);
    toast({ title: 'Notes Updated' });
  };

  const handleAiApplyNote = (original: string, rewritten: string) => {
    setAiOriginalNote(original);
    setNotesValue(rewritten);
    setIsEditingNotes(true);
  };

  const handleAddPayment = async () => {
    if (!currentOrder) return;
    const amountValue = toNumeric(paymentAmount);
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

  function getFabMissingInfo(line: FabJobLine) {
    const missingFields: string[] = [];
    const validOverridePath =
      (!!line.override_machine_minutes && (line.machine_minutes ?? 0) > 0) ||
      (!!line.override_labor_cost && (line.labor_cost ?? 0) > 0) ||
      (!!line.override_consumables_cost && (line.consumables_cost ?? 0) > 0);
    if (!validOverridePath) {
      if (line.operation_type === 'PRESS_BRAKE') {
        if (line.bends_count == null) missingFields.push('bends count');
        if (line.bend_length == null) missingFields.push('bend length (in)');
      } else {
        if (line.weld_length == null) missingFields.push('weld length (in)');
        if (!line.weld_process) missingFields.push('weld process');
      }
    }
    return { missingFields, validOverridePath };
  }

  const confirmMarkCoreReturned = () => {
    if (!coreReturnLineId) return;
    const result = woMarkCoreReturned(coreReturnLineId);
    if (result.success) {
      toast({ title: 'Core Returned', description: 'Refund line has been created' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setShowCoreReturnDialog(false);
    setCoreReturnLineId(null);
  };

  const handleOpenFabricationTab = () => {
    guardLockedAction(() => {
      setActiveTab('fabrication');
    });
  };

  const handleOpenPlasmaTab = () => {
    guardLockedAction(() => {
      setActiveTab('plasma');
    });
  };

  const handleAddOverviewFabricationLine = () => {
    guardLockedAction(() => {
      if (currentOrder && !fabJob) {
        fabricationRepo.createForWorkOrder(currentOrder.id);
      }
      setActiveTab('fabrication');
    });
  };

  const handleAddOverviewPlasmaLine = () => {
    guardLockedAction(() => {
      if (currentOrder && !plasmaJob) {
        plasmaRepo.createForWorkOrder(currentOrder.id);
      }
      setActiveTab('plasma');
    });
  };

  const handleAddFabLine = () => {
    if (!currentOrder) return;
    guardLockedAction(() => {
      if (fabLocked) return;
      const job = fabricationRepo.createForWorkOrder(currentOrder.id);
      fabricationRepo.upsertLine(job.id, { operation_type: 'PRESS_BRAKE', qty: 1 });
    });
  };

  const handleFabNumberChange = (
    lineId: string,
    field: keyof Pick<
      FabJobLine,
      'qty' | 'thickness' | 'bends_count' | 'bend_length' | 'setup_minutes' | 'machine_minutes' | 'tonnage_estimate' | 'weld_length' | 'consumables_cost' | 'labor_cost'
    >,
    value: string
  ) => {
    if (!fabJob || fabLocked) return;
    const numeric = value === '' ? null : parseFloat(value);
    const safeValue = numeric != null && !Number.isNaN(numeric) ? numeric : null;
    fabricationRepo.upsertLine(fabJob.id, { id: lineId, [field]: safeValue } as Partial<FabJobLine>);
  };

  const handleFabTextChange = (
    lineId: string,
    field: keyof Pick<FabJobLine, 'material_type' | 'description' | 'notes' | 'tooling' | 'position'>,
    value: string
  ) => {
    if (!fabJob || fabLocked) return;
    fabricationRepo.upsertLine(fabJob.id, { id: lineId, [field]: value || null } as Partial<FabJobLine>);
  };

  const handleFabOperationChange = (lineId: string, operation: 'PRESS_BRAKE' | 'WELD') => {
    if (!fabJob || fabLocked) return;
    fabricationRepo.upsertLine(fabJob.id, { id: lineId, operation_type: operation });
  };

  const handleFabWeldProcessChange = (lineId: string, process: FabJobLine['weld_process']) => {
    if (!fabJob || fabLocked) return;
    fabricationRepo.upsertLine(fabJob.id, { id: lineId, weld_process: process ?? null });
  };

  const handleFabWeldTypeChange = (lineId: string, weldType: FabJobLine['weld_type']) => {
    if (!fabJob || fabLocked) return;
    fabricationRepo.upsertLine(fabJob.id, { id: lineId, weld_type: weldType ?? null });
  };

  const handleFabToggleOverride = (
    lineId: string,
    field: keyof Pick<FabJobLine, 'override_machine_minutes' | 'override_consumables_cost' | 'override_labor_cost'>,
    checked: boolean
  ) => {
    if (!fabJob || fabLocked) return;
    fabricationRepo.upsertLine(fabJob.id, { id: lineId, [field]: checked } as Partial<FabJobLine>);
  };

  const handleDeleteFabLine = (lineId: string) => {
    if (fabLocked) return;
    fabricationRepo.deleteLine(lineId);
  };

  const handleRecalculateFabJob = () => {
    if (!fabJob) return;
    setShowFabValidation(true);
    const result = fabricationRepo.recalculate(fabJob.id);
    if (!result.success) {
      toast({ title: 'Recalculate failed', description: result.error, variant: 'destructive' });
    } else {
      setFabWarnings(result.warnings ?? []);
      toast({ title: 'Fabrication pricing updated' });
    }
  };

  const handlePostFabJob = () => {
    if (!fabJob || fabLocked) return;
    setShowFabValidation(true);
    const recalcResult = fabricationRepo.recalculate(fabJob.id);
    if (recalcResult?.warnings) {
      setFabWarnings(recalcResult.warnings);
    }
    const refreshedFab = currentOrder ? fabricationRepo.getByWorkOrder(currentOrder.id) : fabData;
    const blockingLine = refreshedFab?.lines.find((line) => {
      const info = getFabMissingInfo(line);
      return info.missingFields.length > 0 && !info.validOverridePath;
    });
    if (blockingLine) {
      toast({ title: 'Missing inputs', description: 'Add required fabrication inputs before posting.', variant: 'destructive' });
      return;
    }
    const result = fabricationRepo.postToWorkOrder(fabJob.id);
    if (!result.success) {
      toast({ title: 'Post failed', description: result.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Fabrication posted to work order' });
  };

  const handleAddPlasmaLine = () => {
    if (!plasmaJob) return;
    if (isInvoiced) {
      notifyWorkOrderLocked();
      return;
    }
    if (plasmaLocked) return;
    plasmaRepo.upsertLine(plasmaJob.id, {
      qty: 1,
      material_type: '',
      thickness: null,
      cut_length: 0,
      pierce_count: 0,
      setup_minutes: 0,
      machine_minutes: 0,
    });
  };

  const handlePlasmaNumberChange = (
    lineId: string,
    field: keyof Pick<PlasmaJobLine, 'qty' | 'cut_length' | 'pierce_count' | 'thickness' | 'setup_minutes' | 'machine_minutes'>,
    value: string
  ) => {
    if (!plasmaJob || plasmaLocked) return;
    const numeric = value === '' ? 0 : parseFloat(value);
    const safeValue = Number.isNaN(numeric) ? 0 : numeric;
    plasmaRepo.upsertLine(plasmaJob.id, { id: lineId, [field]: safeValue } as Partial<PlasmaJobLine>);
  };

  const handlePlasmaTextChange = (lineId: string, value: string) => {
    if (!plasmaJob || plasmaLocked) return;
    plasmaRepo.upsertLine(plasmaJob.id, { id: lineId, material_type: value });
  };

  const handlePlasmaSellPriceChange = (lineId: string, value: string) => {
    if (!plasmaJob || plasmaLocked) return;
    const numeric = value === '' ? 0 : parseFloat(value);
    const safeValue = Number.isNaN(numeric) ? 0 : numeric;
    const existing = plasmaLines.find((l) => l.id === lineId);
    const overrides = { ...(existing?.overrides || {}), sell_price_each: safeValue };
    plasmaRepo.upsertLine(plasmaJob.id, { id: lineId, overrides });
  };

  const handleDeletePlasmaLine = (lineId: string) => {
    if (plasmaLocked) return;
    plasmaRepo.deleteLine(lineId);
  };

  const handleRecalculatePlasmaJob = () => {
    if (!plasmaJob) return;
    const result = plasmaRepo.recalc(plasmaJob.id);
    if (!result.success) {
      toast({ title: 'Recalculate failed', description: result.error, variant: 'destructive' });
    } else {
      setPlasmaWarnings(result.warnings ?? []);
      toast({ title: 'Plasma pricing updated' });
    }
  };

  const handlePostPlasmaJob = () => {
    if (!plasmaJob || plasmaLocked) return;
    const result = plasmaRepo.postToWorkOrder(plasmaJob.id);
    if (result.success) {
      toast({ title: 'Posted to Work Order', description: 'Charge line updated' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleAttachmentUpload = (file?: File) => {
    if (!file || !plasmaJob) return;
    const result = plasmaRepo.attachments.add(plasmaJob.id, file);
    if (!result.success) {
      toast({ title: 'Upload failed', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Attachment added' });
    }
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    if (!confirm('Remove this attachment?')) return;
    plasmaRepo.attachments.remove(attachmentId);
  };

  const handleAttachmentNoteChange = (attachmentId: string, notes: string) => {
    plasmaRepo.attachments.update(attachmentId, { notes });
  };

  const handleCreateClaimOpenChange = (open: boolean) => {
    if (open && isInvoiced) {
      notifyWorkOrderLocked();
      return;
    }
    setCreateClaimOpen(open);
  };

  const handleCreateWarrantyClaim = () => {
    if (!currentOrder) return;
    guardLockedAction(() => {
      const vendorId = selectedClaimVendor || vendors[0]?.id;
      if (!vendorId) return;
      const claim = createWarrantyClaim({ vendor_id: vendorId, work_order_id: currentOrder.id });
      if (claim) {
        setCreateClaimOpen(false);
        setSelectedClaimVendor('');
        navigate(`/warranty/${claim.id}`);
      }
    });
  };

  const customer = customers.find((c) => c.id === (currentOrder?.customer_id || selectedCustomerId));
  const isCustomerOnHold = Boolean(customer?.credit_hold);
  const unit = units.find((u) => u.id === (currentOrder?.unit_id || selectedUnitId));
  const priceLevel = customer?.price_level ?? 'RETAIL';
  const priceLevelLabel =
    customer?.price_level === 'WHOLESALE'
      ? 'Wholesale'
      : customer?.price_level === 'FLEET'
      ? 'Fleet'
      : 'Retail';
  const partsSubtotal = partLines.reduce((sum, line) => sum + toNumeric(line.line_total), 0);
  const laborSubtotal = laborLines.reduce((sum, line) => sum + toNumeric(line.line_total), 0);
  const otherCharges = otherChargeLines.reduce((sum, line) => sum + toNumeric(line.total_price), 0);
  const fabricationTotal = fabTotal;
  const overviewGrandTotal = partsSubtotal + laborSubtotal + fabricationTotal + plasmaTotal + otherCharges;
  useEffect(() => {
    if (sheetPrintMode && sheetPrintMode !== 'NONE') {
      document.body.setAttribute('data-print-mode', sheetPrintMode);
    } else {
      document.body.removeAttribute('data-print-mode');
    }
    return () => {
      document.body.removeAttribute('data-print-mode');
    };
  }, [sheetPrintMode]);

  // New order form
  if (isNew && !order) {
    return (
      <div className="page-container">
        <style>{PRINT_STYLES}</style>
        <PageHeader title="Work Order" subtitle="Create a new work order" backTo="/work-orders" />
        <div className="form-section max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Order Details</h2>
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-1">
                Customer *
              </Label>
              <div className="flex items-center gap-2">
                <SmartSearchSelect
                  className="flex-1 min-w-0"
                  value={selectedCustomerId || null}
                  onChange={(v) => {
                    const nextId = v ?? '';
                    setSelectedCustomerId(nextId);
                    // Always clear unit when customer changes or is cleared
                    setSelectedUnitId(null);
                    setIsDirty(true);
                  }}
                  items={customerPickerItems}
                  placeholder="Search customers by name, phone, email, or address..."
                  minChars={2}
                  limit={25}
                  isClearable
                />
                <Button
                  type="button"
                  variant="outline"
                  className="flex-shrink-0"
                  onClick={() => setIsBrowseCustomersOpen(true)}
                >
                  Browse customers
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0 text-xs"
                  onClick={() => {
                    setSelectedCustomerId('');
                    setSelectedUnitId(null);
                    setIsDirty(true);
                  }}
                  disabled={!selectedCustomerId}
                >
                  Clear
                </Button>
                <Button variant="outline" size="icon" onClick={() => setQuickAddCustomerOpen(true)} className="flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {(selectedCustomerId || currentOrder?.customer_id) && (
              <div>
                <Label className="flex items-center gap-1">
                  Unit *
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <SmartSearchSelect
                      className="w-full"
                      value={selectedUnitId || null}
                      onChange={(v) => setSelectedUnitId(v ?? '')}
                      items={unitPickerItems}
                      placeholder="Select or search a unit..."
                      minChars={0}
                      limit={25}
                      disabled={!!unitFromQuery || !(selectedCustomerId || currentOrder?.customer_id)}
                      isClearable
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuickAddUnitOpen(true)}
                    disabled={!selectedCustomerId || selectedCustomerId === 'walkin'}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <Button onClick={handleCreateOrder} className="w-full" disabled={!selectedCustomerId || !selectedUnitId}>
              <Save className="w-4 h-4 mr-2" />
              Create Order
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
            Viewing customers. Use the active filter and pagination to browse, then select one to attach to this work order.
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
                    <td className="px-3 py-2">{(c as any).phone ?? '-'}</td>
                    <td className="px-3 py-2">{(c as any).email ?? '-'}</td>
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

        <AddUnitDialog
          open={quickAddUnitOpen}
          onOpenChange={setQuickAddUnitOpen}
          customerId={selectedCustomerId || currentOrder?.customer_id || ''}
          customerName={
            customers.find((c) => c.id === (selectedCustomerId || currentOrder?.customer_id))?.company_name ||
            'Customer'
          }
          onUnitCreated={(unit) => {
            setSelectedUnitId(unit.id);
            setQuickAddUnitOpen(false);
          }}
        />
      </div>
    );
  }

  // Existing order view
  const statusLabel =
    currentOrder?.status === 'ESTIMATE'
      ? 'Estimate'
      : currentOrder?.status === 'INVOICED'
        ? 'Invoiced'
        : currentOrder?.status === 'IN_PROGRESS'
          ? 'In Progress'
          : 'Open';
  return (
    <div className="page-container">
      <style>{PRINT_STYLES}</style>
      <PageHeader
        title="Work Order"
        subtitle={
          currentOrder ? (
            <div className="flex items-center gap-2">
              <span>{statusLabel} - Order {currentOrder.order_number}</span>
            </div>
          ) : (
            'Manage job, labor, parts, and status'
          )
        }
        backTo="/work-orders"
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <ModuleHelpButton
              moduleKey="work_orders"
              context={{
                recordType: 'work_order',
                status: currentOrder?.status,
                hasCustomer: Boolean(currentOrder?.customer_id),
                hasLines: Boolean(partLines?.length || laborLines?.length),
                isEmpty: !currentOrder?.customer_id && !(partLines?.length || laborLines?.length),
              }}
            />
            {aiAssistEnabled && currentOrder && (
              <Button variant="outline" onClick={() => setAiAssistOpen(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                AI Assist
              </Button>
            )}
            {!isInvoiced ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSheetPrintMode('TECH');
                    requestAnimationFrame(() => {
                      window.print();
                      setSheetPrintMode('NONE');
                    });
                  }}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Tech Print
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
                {isSchedulable && (
                  <Button variant="default" onClick={handleSendToSchedule}>
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Send to Schedule
                  </Button>
                )}
                {isEstimate ? (
                  <Button
                    variant="default"
                    onClick={() => {
                      const result = workOrderRepo.woConvertToOpen(currentOrder.id);
                      if (!result.success) {
                        toast({ title: 'Error', description: result.error, variant: 'destructive' });
                      } else {
                        toast({ title: 'Converted', description: 'Estimate converted to work order' });
                      }
                    }}
                  >
                    Convert to Work Order
                  </Button>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => setShowInvoiceDialog(true)}
                      disabled={isCustomerOnHold || !canCreateInvoices}
                      title={isCustomerOnHold ? 'Customer is on credit hold' : undefined}
                    >
                      <FileCheck className="w-4 h-4 mr-2" />
                      Invoice
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSheetPrintMode('TECH');
                    requestAnimationFrame(() => {
                      window.print();
                      setSheetPrintMode('NONE');
                    });
                  }}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Tech Print
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
              </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* Order Info */}
        <div className="form-section">
          <h2 className="text-lg font-semibold mb-4">Order Information</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground flex items-center gap-1">
                Customer:
              </span>
              <p className="font-medium">{customer?.company_name || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Price Level:</span>
              <p className="font-medium">{customer ? priceLevelLabel : 'Retail'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Unit:</span>
              <p className="font-medium">{unit?.unit_name || '-'}</p>
              {unit?.vin && <p className="text-xs text-muted-foreground font-mono">{unit.vin}</p>}
            </div>
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
            <div className="pt-2 border-t border-border">
              <ProfitabilityPanel summary={profitability} formatCurrency={formatMoney} />
            </div>
            {fabJob && fabLines.length === 0 && (
              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-sm font-medium">Fabrication</p>
                <p className="text-xs text-muted-foreground">No fabrication lines yet. Add a line to start pricing fabrication.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenFabricationTab}
                  disabled={isInvoiced || fabLocked}
                >
                  Add Fabrication Line
                </Button>
                {isInvoiced && <p className="text-xs text-muted-foreground">{workOrderLockMessage}</p>}
              </div>
            )}
            {plasmaJob && plasmaLines.length === 0 && (
              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-sm font-medium">Plasma</p>
                <p className="text-xs text-muted-foreground">No plasma lines yet. Add a line to start pricing plasma.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenPlasmaTab}
                  disabled={isInvoiced || plasmaLocked}
                >
                  Add Plasma Line
                </Button>
                {isInvoiced && <p className="text-xs text-muted-foreground">{workOrderLockMessage}</p>}
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
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium">Blockers</p>
              {blockerChips.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">None</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-2">
                  {blockerChips.map((chip) => (
                    <Badge key={chip.label} variant={chip.variant ?? 'outline'} className="text-[11px] font-normal">
                      {chip.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {activeJobTimers.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-medium">Active Timers</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {activeJobTimers.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium"
                    >
                      <span>
                        {entry.technician_name || 'Technician'} · {jobMap[entry.job_line_id]?.title || 'Job'}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => handleJobClockOut(entry.id)}>
                        Clock Out
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <p className="text-sm font-medium">Work Order Rollups</p>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
                <span>Actual Hours: {formatNumber(workOrderActualHours)}h</span>
                <span>Labor Revenue: ${formatNumber(woProfitTotals.laborRevenue)}</span>
                <span>Parts Revenue: ${formatNumber(woProfitTotals.partsRevenue)}</span>
                <span>
                  Margin: ${formatNumber(woProfitTotals.margin)} ({formatNumber(woProfitTotals.marginPercent, 1)}%)
                </span>
              </div>
            </div>
          </div>
          
          {/* Notes Section */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm">Notes:</span>
              {!isInvoiced && !isEditingNotes && (
                <Button variant="ghost" size="sm" onClick={handleEditNotes}>
                  <Edit className="w-3 h-3" />
                </Button>
              )}
            </div>
            {isEditingNotes ? (
              <div className="space-y-2">
                <Textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} rows={3} placeholder="Add notes..." />
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

        {/* Parts & Labor */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="w-full">
          <div className="print:hidden overflow-x-auto">
            <TabsList className="mb-4 min-w-max inline-flex">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="parts">Parts ({partLines.length})</TabsTrigger>
              <TabsTrigger value="labor">Labor ({laborLines.length})</TabsTrigger>
              <TabsTrigger value="fabrication">Fabrication ({fabLines.length})</TabsTrigger>
              <TabsTrigger value="plasma">Plasma ({plasmaLines.length})</TabsTrigger>
              {timeEntries.length > 0 && <TabsTrigger value="time">Time ({timeEntries.length})</TabsTrigger>}
            </TabsList>
          </div>

            <TabsContent value="overview">
              <div className="flex justify-end mb-4 print:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentOrder?.id) {
                      navigate(`/print/work-orders/${currentOrder.id}`);
                    }
                  }}
                  className="print:hidden"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print Overview
                </Button>
              </div>
              <div id="wo-overview-print">
                <div className="grid gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="border rounded-lg p-4 bg-muted/50 sm:col-span-2 lg:col-span-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      Grand Total
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center text-muted-foreground hover:text-foreground">
                          <Info className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Sum of parts, labor, fabrication, plasma, and other charges</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-2xl font-bold">${formatNumber(overviewGrandTotal)}</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    Parts Subtotal
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center text-muted-foreground hover:text-foreground">
                          <Info className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{partLines.length} part lines, sum of line totals</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold">${formatNumber(partsSubtotal)}</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    Labor Subtotal
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center text-muted-foreground hover:text-foreground">
                          <Info className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {laborLines.length} labor lines{laborLines.length ? ` · ${totalHours} hrs tracked` : ''}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold">${formatNumber(laborSubtotal)}</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    Fabrication Total
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center text-muted-foreground hover:text-foreground">
                          <Info className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {fabLines.length} fabrication lines · derived from fabrication sell totals (recalc updates)
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold">${formatNumber(fabricationTotal)}</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    Plasma Total
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center text-muted-foreground hover:text-foreground">
                          <Info className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {plasmaLines.length} plasma lines · derived from plasma sell totals (recalc updates)
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold">${formatNumber(plasmaTotal)}</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    Other Charges
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center text-muted-foreground hover:text-foreground">
                          <Info className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{otherChargeLines.length} other charge lines included</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-lg font-semibold">${formatNumber(otherCharges)}</div>
                </div>
              </div>

                <div className="space-y-6">
                  <div className="border rounded-lg">
                  <div className="px-4 py-3 border-b">
                    <h4 className="font-medium">Parts</h4>
                  </div>
                  <div className="table-container p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part #</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partLines.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No parts</TableCell>
                          </TableRow>
                        ) : (
                          partLines.map((line) => {
                            const part = parts.find((p) => p.id === line.part_id);
                            const { basis } = part ? getPartCostBasis(part) : { basis: null };
                            return (
                              <TableRow key={line.id}>
                                <TableCell className="font-mono">{part?.part_number || '-'}</TableCell>
                                <TableCell>{part?.description || line.description || '-'}</TableCell>
                                <TableCell className="text-right">{formatQtyWithUom(line.quantity, part)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex flex-col items-end gap-1">
                                    <span>${formatNumber(line.unit_price)}</span>
                                    {basis !== null && line.unit_price < basis && (
                                      <span className="text-xs text-destructive">
                                        Warning: below cost (basis ${formatNumber(basis)})
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">${formatNumber(line.line_total)}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="border rounded-lg">
                  <div className="px-4 py-3 border-b">
                    <h4 className="font-medium">Labor</h4>
                  </div>
                  <div className="table-container p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead>Technician</TableHead>
                          <TableHead className="text-right">Hours</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {laborLines.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No labor</TableCell>
                          </TableRow>
                        ) : (
                          laborLines.map((line) => {
                            const tech = technicians.find((t) => t.id === line.technician_id);
                            return (
                              <TableRow key={line.id}>
                                <TableCell>{line.description}</TableCell>
                                <TableCell>{tech?.name || '-'}</TableCell>
                                <TableCell className="text-right">{line.hours}</TableCell>
                                <TableCell className="text-right">${formatNumber(line.rate)}</TableCell>
                                <TableCell className="text-right font-medium">${formatNumber(line.line_total)}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="border rounded-lg">
                  <div className="px-4 py-3 border-b">
                    <h4 className="font-medium">Fabrication</h4>
                  </div>
                  <div className="table-container p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Operation</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Machine (min)</TableHead>
                          <TableHead className="text-right">Sell Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fabLines.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                              <div className="space-y-3">
                                <div className="text-sm">{fabJob ? 'Job created — add your first line to begin pricing.' : 'No fabrication job yet.'}</div>
                                <div className="text-xs text-muted-foreground">Add a fabrication line to begin pricing.</div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleAddOverviewFabricationLine}
                                  disabled={isInvoiced || fabLocked}
                                >
                                  Add Fabrication Line
                                </Button>
                                {isInvoiced && <div className="text-xs text-muted-foreground">{workOrderLockMessage}</div>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          fabLines.map((line) => (
                            <TableRow key={line.id}>
                              <TableCell>{line.operation_type === 'PRESS_BRAKE' ? 'Press Brake' : 'Weld'}</TableCell>
                              <TableCell>{line.description || '-'}</TableCell>
                              <TableCell className="text-right">{line.qty}</TableCell>
                              <TableCell className="text-right">{line.machine_minutes ?? 0}</TableCell>
                              <TableCell className="text-right font-medium">${formatNumber(line.sell_price_total)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="border rounded-lg">
                  <div className="px-4 py-3 border-b">
                    <h4 className="font-medium">Plasma</h4>
                  </div>
                  <div className="table-container p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Thickness</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Machine (min)</TableHead>
                          <TableHead className="text-right">Sell Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plasmaLines.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                              <div className="space-y-3">
                                <div className="text-sm">{plasmaJob ? 'Job created — add your first line to begin pricing.' : 'No plasma job yet.'}</div>
                                <div className="text-xs text-muted-foreground">Add a plasma line to begin pricing.</div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleAddOverviewPlasmaLine}
                                  disabled={isInvoiced || plasmaLocked}
                                >
                                  Add Plasma Line
                                </Button>
                                {isInvoiced && <div className="text-xs text-muted-foreground">{workOrderLockMessage}</div>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          plasmaLines.map((line) => (
                            <TableRow key={line.id}>
                              <TableCell>{line.material_type || '-'}</TableCell>
                              <TableCell className="text-right">{line.thickness ?? '-'}</TableCell>
                              <TableCell className="text-right">{line.qty}</TableCell>
                              <TableCell className="text-right">{line.machine_minutes ?? 0}</TableCell>
                              <TableCell className="text-right font-medium">${formatNumber(line.sell_price_total)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="border rounded-lg">
                  <div className="px-4 py-3 border-b">
                    <h4 className="font-medium">Other Charges</h4>
                  </div>
                  <div className="table-container p-4">
                    <Table>
                      <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {otherChargeLines.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No other charges</TableCell>
                          </TableRow>
                        ) : (
                          otherChargeLines.map((line) => (
                                  <TableRow key={line.id}>
                                    <TableCell>{line.description}</TableCell>
                                    <TableCell className="text-right">{line.qty}</TableCell>
                                    <TableCell className="text-right">${formatNumber(line.unit_price)}</TableCell>
                                    <TableCell className="text-right font-medium">${formatNumber(line.total_price)}</TableCell>
                                  </TableRow>
                                ))
                            )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
            </TabsContent>

            <TabsContent value="jobs">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="New job title"
                    value={newJobTitle}
                    onChange={(event) => setNewJobTitle(event.target.value)}
                    disabled={addJobDisabled}
                    className="flex-1 min-w-[200px]"
                  />
                  <Button size="sm" onClick={handleAddJob} disabled={addJobDisabled || !newJobTitle.trim()}>
                    Add Job
                  </Button>
                </div>
                {isInvoiced && <p className="text-xs text-muted-foreground">{workOrderLockMessage}</p>}
                {jobLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No jobs created yet.</p>
                ) : (
                  <div className="space-y-4">
                    {jobLinesForDisplay.map((job) => {
                      const draft = jobDrafts[job.id];
                      const isEditing = jobEditingMode[job.id] ?? false;
                      const isSaving = jobSaving[job.id] ?? false;
                      const jobSummary = jobProfitSummaries[job.id] ?? DEFAULT_JOB_PROFIT_SUMMARY;
                      const ccc = jobCccDrafts[job.id] ?? { complaint: '', cause: '', correction: '' };
                      const readiness =
                        jobReadinessById[job.id] ?? {
                          job_line_id: job.id,
                          partsRequiredCount: 0,
                          partsMissingCount: 0,
                          partsRiskCount: 0,
                          readiness: 'OK' as const,
                        };
                      const readinessBadgeLabel =
                        readiness.readiness === 'MISSING'
                          ? 'Parts Missing'
                          : readiness.readiness === 'RISK'
                          ? 'Parts Risk'
                          : 'Parts Ready';
                      const readinessBadgeVariant =
                        readiness.readiness === 'MISSING'
                          ? 'destructive'
                          : readiness.readiness === 'RISK'
                          ? 'secondary'
                          : 'outline';
                      const estimatedHours = jobSummary.jobLaborLines.reduce((sum, line) => sum + line.hours, 0);
                      const partsQty = jobSummary.jobPartLines.reduce((sum, line) => sum + line.quantity, 0);
                      const activeTimer = activeJobTimers.find((entry) => entry.job_line_id === job.id);
                      // Tech dropdown: empty by default, only show selection if explicitly chosen
                      const selectedTechnicianId = jobTechnicianSelection[job.id] || '';
                      const hasValidSaveTechnician = Boolean(
                        selectedTechnicianId &&
                        technicians.some((technician) => technician.id === selectedTechnicianId)
                      );
                      const hasSaveTitle = Boolean((draft?.title ?? job.title ?? '').trim());
                      const saveJobDisabled = isInvoiced || isSaving || !hasSaveTitle || !hasValidSaveTechnician;
                      // Clock In gating: disabled if no tech selected
                      const clockInDisabled = !selectedTechnicianId || activeTechnicians.length === 0;
                      const clockInHelperText = !selectedTechnicianId 
                        ? 'Select a technician to enable Clock In' 
                        : null;
                      return (
                        <Card
                          key={job.id}
                          className="border"
                          onMouseDown={() => setSelectedJobId(job.id)}
                          onClick={() => setSelectedJobId(job.id)}
                        >
                          <CardContent className="p-4 pt-4 space-y-3">
                            <div className="flex flex-wrap gap-2 items-center">
                              {isEditing ? (
                                <>
                                  <Input
                                    value={draft?.title ?? job.title}
                                    onChange={(event) => handleJobDraftChange(job.id, 'title', event.target.value)}
                                    placeholder="Job Title"
                                    className="flex-1 min-w-[180px] h-10"
                                    disabled={isInvoiced || isSaving}
                                  />
                                  <Select
                                    value={(draft?.status ?? job.status) as WorkOrderJobStatus}
                                    onValueChange={(value) =>
                                      handleJobDraftChange(job.id, 'status', value as WorkOrderJobStatus)
                                    }
                                    disabled={isInvoiced || isSaving}
                                  >
                                    <SelectTrigger className="h-10 w-40">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {JOB_STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleSaveJob(job.id);
                                    }}
                                    disabled={saveJobDisabled}
                                  >
                                    <Save className="w-4 h-4 mr-1" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCancelEditJob(job.id);
                                    }}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <div className="flex-1 min-w-[180px]">
                                    <span className="font-medium">{job.title}</span>
                                    <Badge variant="outline" className="ml-2 text-[10px]">
                                      {JOB_STATUS_OPTIONS.find((o) => o.value === job.status)?.label || job.status}
                                    </Badge>
                                  </div>
                                  {!isInvoiced && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleEditJob(job.id);
                                        }}
                                      >
                                        <Edit className="w-4 h-4 mr-1" />
                                        Edit
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="text-destructive hover:text-destructive"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openDeleteJobDialog(job);
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="grid gap-2 md:grid-cols-3">
                              <Textarea
                                value={ccc.complaint}
                                onChange={(event) =>
                                  handleJobCccChange(job.id, 'complaint', event.target.value)
                                }
                                placeholder="Complaint"
                                className="h-24"
                                disabled={isInvoiced || !isEditing}
                              />
                              <Textarea
                                value={ccc.cause}
                                onChange={(event) => handleJobCccChange(job.id, 'cause', event.target.value)}
                                placeholder="Cause"
                                className="h-24"
                                disabled={isInvoiced || !isEditing}
                              />
                              <Textarea
                                value={ccc.correction}
                                onChange={(event) =>
                                  handleJobCccChange(job.id, 'correction', event.target.value)
                                }
                                placeholder="Correction"
                                className="h-24"
                                disabled={isInvoiced || !isEditing}
                              />
                            </div>
                            {!isEditing && (
                              <div className="border rounded-md p-3 bg-muted/30 space-y-2">
                                <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Job Name:</span>{' '}
                                    <span className="font-medium">{job.title}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Status:</span>{' '}
                                    <span className="font-medium">
                                      {JOB_STATUS_OPTIONS.find((o) => o.value === job.status)?.label || job.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-3">
                              {activeTechnicians.length > 0 ? (
                                <Select
                                  value={selectedTechnicianId}
                                  onValueChange={(value) =>
                                    setJobTechnicianSelection((prev) => ({ ...prev, [job.id]: value }))
                                  }
                                  disabled={isInvoiced}
                                >
                                  <SelectTrigger className="h-9 min-w-[170px]">
                                    <SelectValue placeholder="Select tech…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {activeTechnicians.map((tech) => (
                                      <SelectItem key={tech.id} value={tech.id}>
                                        {tech.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-muted-foreground">No active technicians</span>
                              )}
                              {activeTimer ? (
                                <Button size="sm" variant="destructive" onClick={() => handleJobClockOut(activeTimer.id)}>
                                  <Square className="w-3 h-3 mr-1" />
                                  Clock Out
                                </Button>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => handleJobClockIn(job.id)}
                                    disabled={clockInDisabled}
                                  >
                                    <Clock className="w-3 h-3 mr-1" />
                                    Clock In
                                  </Button>
                                  {clockInHelperText && (
                                    <span className="text-[10px] text-muted-foreground">{clockInHelperText}</span>
                                  )}
                                </div>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                Actual: {formatNumber(jobSummary.jobActualHours)}h
                                {estimatedHours > 0 ? ` · Est: ${formatNumber(estimatedHours)}h` : ''}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                              <div className="flex flex-wrap items-center gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant={readinessBadgeVariant} className="uppercase tracking-wide text-[11px]">
                                      {readinessBadgeLabel}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="flex flex-col gap-1 text-xs">
                                      <span>Required: {readiness.partsRequiredCount}</span>
                                      <span>Missing: {readiness.partsMissingCount}</span>
                                      <span>Risk: {readiness.partsRiskCount}</span>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                <span className="text-[11px]">Lines: {readiness.partsRequiredCount}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span>{partsQty} parts</span>
                                <span>${formatNumber(jobSummary.partsRevenue)}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span>Labor Revenue: ${formatNumber(jobSummary.laborRevenue)}</span>
                              <span>Labor Cost{jobSummary.hasLaborCost ? '' : ' (est)'}: ${formatNumber(jobSummary.laborCost)}</span>
                              <span>Parts Cost: ${formatNumber(jobSummary.partsCost)}</span>
                              <span>
                                Margin: ${formatNumber(jobSummary.margin)} ({formatNumber(jobSummary.marginPercent, 1)}%)
                              </span>
                            </div>
                            <div className="space-y-2">
                              {readiness.readiness === 'MISSING' && job.status !== 'WAITING_PARTS' && (
                                <Alert variant="destructive" className="border-destructive/70 bg-destructive/10 text-destructive">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm">Parts are missing. Mark job as Waiting on Parts?</p>
                                    <Button size="sm" variant="outline" onClick={() => handleMarkJobWaitingParts(job)}>
                                      Set WAITING_PARTS
                                    </Button>
                                  </div>
                                </Alert>
                              )}
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">Parts</h4>
                                {!isInvoiced && (
                                  <Button size="sm" onClick={() => openPartDialog(job.id)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Part
                                  </Button>
                                )}
                              </div>
                              {jobSummary.jobPartLines.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No parts added to this job yet.</p>
                              ) : (
                                <div className="table-container">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Part #</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {jobSummary.jobPartLines.map((line) => {
                                        const part = parts.find((p) => p.id === line.part_id);
                                        return (
                                          <TableRow key={line.id}>
                                            <TableCell className="font-mono">{part?.part_number || '-'}</TableCell>
                                            <TableCell>{part?.description || line.description || '-'}</TableCell>
                                            <TableCell className="text-right">{formatQtyWithUom(line.quantity, part)}</TableCell>
                                            <TableCell className="text-right font-medium">
                                              {line.is_warranty ? (
                                                <span className="text-muted-foreground">$0.00</span>
                                              ) : (
                                                `$${formatNumber(line.line_total)}`
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">Labor</h4>
                                {!isInvoiced && (
                                  <Button size="sm" onClick={() => openLaborDialog(job.id)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Labor
                                  </Button>
                                )}
                              </div>
                              {jobSummary.jobLaborLines.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No labor recorded for this job yet.</p>
                              ) : (
                                <div className="table-container">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Technician</TableHead>
                                        <TableHead className="text-right">Hours</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {jobSummary.jobLaborLines.map((line) => {
                                        const tech = technicians.find((t) => t.id === line.technician_id);
                                        return (
                                          <TableRow key={line.id}>
                                            <TableCell>{line.description}</TableCell>
                                            <TableCell>{tech?.name || '-'}</TableCell>
                                            <TableCell className="text-right">{line.hours}</TableCell>
                                            <TableCell className="text-right font-medium">
                                              {line.is_warranty ? (
                                                <span className="text-muted-foreground">$0.00</span>
                                              ) : (
                                                `$${formatNumber(line.line_total)}`
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="activity">
              <div className="space-y-3">
                {activityEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  activityEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{event.message}</p>
                        <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                      </div>
                      {event.job_line_id && jobMap[event.job_line_id] && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 uppercase tracking-wide">
                          {jobMap[event.job_line_id].title}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="parts">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Parts</h3>
                {!isInvoiced && (
                  <div className="flex items-center gap-1">
                    <Button size="sm" onClick={() => openPartDialog(null)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Part
                    </Button>
                  </div>
                )}
              </div>
              {isMobile && partLines.length === 0 ? (
                <div className="rounded-lg border bg-card text-muted-foreground p-4 text-center">No parts added yet</div>
              ) : (
              <ResponsiveDataList
                items={partLines}
                renderMobileCard={(line) => {
                  const part = parts.find((p) => p.id === line.part_id);
                  const isEditingPrice = editingPriceLineId === line.id;
                  return (
                    <div
                      className={`border rounded-lg p-3 space-y-3 ${
                        line.is_warranty ? 'bg-accent/30 border-accent/60' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="font-semibold font-mono text-sm whitespace-nowrap truncate">{part?.part_number || '-'}</div>
                          <div className="text-sm text-muted-foreground break-words">{part?.description || '-'}</div>
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
                                Core ${formatNumber(line.core_charge)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {!isInvoiced && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePartLine(line.id)}
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
                          {isInvoiced ? (
                            <div className="font-medium">{formatQtyWithUom(line.quantity, part)}</div>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              step={part?.uom === 'EA' ? '1' : '0.01'}
                              value={line.quantity}
                              onChange={(e) => handleUpdateQty(line.id, e.target.value)}
                              className="w-full"
                            />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Price</div>
                          {isInvoiced ? (
                            <div className="font-medium">${formatNumber(line.unit_price)}</div>
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
                                  const result = woUpdateLineUnitPrice(line.id, parsed);
                                  if (!result.success) {
                                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                                    return;
                                  }
                                  setEditingPriceLineId(null);
                                  setPriceDraft('');
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
                                  const suggested = part ? calcPartPriceForLevel(part, settings, priceLevel) : null;
                                  if (suggested != null) {
                                    setPriceDraft(formatNumber(suggested));
                                  }
                                }}
                              >
                                Reset
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">${formatNumber(line.unit_price)}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingPriceLineId(line.id);
                                  setPriceDraft(formatNumber(line.unit_price));
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">Warranty</span>
                          {!isInvoiced ? (
                            <Checkbox checked={line.is_warranty} onCheckedChange={() => woTogglePartWarranty(line.id)} />
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
                            {line.is_warranty ? <span className="text-muted-foreground">$0.00</span> : `$${formatNumber(line.line_total)}`}
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
                          {!isInvoiced && <TableHead className="w-10"></TableHead>}
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
                            return (
                              <TableRow key={line.id} className={line.is_warranty ? 'bg-accent/30' : ''}>
                                <TableCell className="font-mono">{part?.part_number || '-'}</TableCell>
                                <TableCell>{part?.description || '-'}</TableCell>
                                <TableCell className="text-center">
                                  {!isInvoiced ? (
                                    <Checkbox checked={line.is_warranty} onCheckedChange={() => woTogglePartWarranty(line.id)} />
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
                                  {isInvoiced ? (
                                    <span>{formatQtyWithUom(line.quantity, part)}</span>
                                  ) : (
                                    <Input 
                                      type="number" 
                                      min="0" 
                                      step={part?.uom === 'EA' ? '1' : '0.01'}
                                      value={line.quantity} 
                                      onChange={(e) => handleUpdateQty(line.id, e.target.value)} 
                                      className="w-16 text-right" 
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isInvoiced ? (
                                    `$${formatNumber(line.unit_price)}`
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
                                          const result = woUpdateLineUnitPrice(line.id, parsed);
                                          if (!result.success) {
                                            toast({ title: 'Error', description: result.error, variant: 'destructive' });
                                            return;
                                          }
                                          setEditingPriceLineId(null);
                                          setPriceDraft('');
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
                                          const suggested = part ? calcPartPriceForLevel(part, settings, priceLevel) : null;
                                          if (suggested != null) {
                                            setPriceDraft(formatNumber(suggested));
                                          }
                                        }}
                                      >
                                        Reset
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2">
                                      <span>${formatNumber(line.unit_price)}</span>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingPriceLineId(line.id);
                                          setPriceDraft(formatNumber(line.unit_price));
                                        }}
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {line.is_warranty ? <span className="text-muted-foreground">$0.00</span> : `$${formatNumber(line.line_total)}`}
                                </TableCell>
                                {!isInvoiced && (
                                  <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemovePartLine(line.id)} className="text-destructive hover:text-destructive">
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
            </TabsContent>

            <TabsContent value="labor">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Labor (Rate: ${laborRate}/hr)</h3>
                {!isInvoiced && (
                  <div className="flex items-center gap-1">
                    <Button size="sm" onClick={() => openLaborDialog(null)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Labor
                    </Button>
                  </div>
                )}
              </div>
              {isMobile && laborLines.length === 0 ? (
                <div className="rounded-lg border bg-card text-muted-foreground p-4 text-center">No labor added yet</div>
              ) : (
              <ResponsiveDataList
                items={laborLines}
                renderMobileCard={(line) => {
                  const tech = technicians.find((t) => t.id === line.technician_id);
                  const expanded = expandedLaborNotes[line.id];
                  const laborNotes = (line as any).notes ?? line.description ?? '';
                  const hasLongNotes = laborNotes.length > 120;
                  return (
                    <div
                      className={`border rounded-lg p-3 space-y-3 ${
                        line.is_warranty ? 'bg-accent/30 border-accent/60' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="font-semibold break-words">{line.description || 'Labor'}</div>
                          <div className="text-sm text-muted-foreground">
                            {tech?.name ? `Tech: ${tech.name}` : 'No technician'}
                          </div>
                          <div className="text-sm text-muted-foreground leading-snug">
                            <span className={`${expanded ? '' : 'line-clamp-2'}`}>{laborNotes || '—'}</span>
                            {hasLongNotes && (
                              <button
                                type="button"
                                className="text-xs text-primary ml-1"
                                onClick={() =>
                                  setExpandedLaborNotes((prev) => ({ ...prev, [line.id]: !prev[line.id] }))
                                }
                              >
                                {expanded ? 'Less' : 'More'}
                              </button>
                            )}
                          </div>
                        </div>
                        {!isInvoiced && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLaborLine(line.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Hours</div>
                          <div className="font-medium">{line.hours}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Rate</div>
                          <div className="font-medium">${formatNumber(line.rate)}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">Warranty</span>
                          {!isInvoiced ? (
                            <Checkbox checked={line.is_warranty} onCheckedChange={() => woToggleLaborWarranty(line.id)} />
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
                            {line.is_warranty ? <span className="text-muted-foreground">$0.00</span> : `$${formatNumber(line.line_total)}`}
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
                          <TableHead>Description</TableHead>
                          <TableHead>Technician</TableHead>
                          <TableHead className="text-center">Warranty</TableHead>
                          <TableHead className="text-right">Hours</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          {!isInvoiced && <TableHead className="w-10"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No labor added yet</TableCell>
                          </TableRow>
                        ) : (
                          items.map((line) => {
                            const tech = technicians.find((t) => t.id === line.technician_id);
                            return (
                              <TableRow key={line.id} className={line.is_warranty ? 'bg-accent/30' : ''}>
                                <TableCell>{line.description}</TableCell>
                                <TableCell>{tech?.name || '-'}</TableCell>
                                <TableCell className="text-center">
                                  {!isInvoiced ? (
                                    <Checkbox checked={line.is_warranty} onCheckedChange={() => woToggleLaborWarranty(line.id)} />
                            ) : line.is_warranty ? (
                                    <Badge variant="secondary"><Shield className="w-3 h-3" /></Badge>
                                  ) : null}
                                </TableCell>
                                <TableCell className="text-right">{line.hours}</TableCell>
                                <TableCell className="text-right">${formatNumber(line.rate)}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {line.is_warranty ? <span className="text-muted-foreground">$0.00</span> : `$${formatNumber(line.line_total)}`}
                                </TableCell>
                                {!isInvoiced && (
                                  <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveLaborLine(line.id)} className="text-destructive hover:text-destructive">
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
            </TabsContent>

            <TabsContent value="fabrication">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium">Fabrication</h3>
                  {fabLocked && (
                    <Badge variant="outline" title="Editing disabled because the work order is invoiced">
                      Locked
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleRecalculateFabJob} disabled={!fabJob || fabLocked}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Recalculate
                  </Button>
                  <Button size="sm" onClick={handlePostFabJob} disabled={!fabJob || fabLines.length === 0 || fabLocked}>
                    <FileCheck className="w-4 h-4 mr-2" />
                    Post to Work Order
                  </Button>
                </div>
              </div>
              {fabLocked && (
                <div className="mb-3 text-sm text-muted-foreground">
                  Fabrication is locked because the work order is invoiced.
                </div>
              )}
              {formattedFabWarnings.length > 0 && (
                <Alert className="mb-3 border border-border">
                  <AlertTitle>Needs inputs to calculate</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-5 space-y-1">
                      {formattedFabWarnings.map((w) => (
                        <li key={w.key}>
                          {w.typeLabel}
                          {w.lineNumber ? ` line ${w.lineNumber}` : ''} — {w.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-3">
                {!fabJob || fabLines.length === 0 ? (
                  <div className="border rounded-lg p-6 text-center text-muted-foreground">No fabrication lines yet</div>
                ) : (
                  fabLines.map((line) => {
                    const missingInfo = getFabMissingInfo(line);
                    return (
                    <div key={line.id} className="border rounded-lg p-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-[180px]">
                          <Label>Operation</Label>
                          <Select
                            value={line.operation_type}
                            onValueChange={(val) => handleFabOperationChange(line.id, val as 'PRESS_BRAKE' | 'WELD')}
                            disabled={fabLocked}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PRESS_BRAKE">Press Brake</SelectItem>
                              <SelectItem value="WELD">Welding</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-[120px]">
                          <Label>Qty</Label>
                          <Input
                            type="number"
                            min="0"
                            value={line.qty ?? 0}
                            disabled={fabLocked}
                            onChange={(e) => handleFabNumberChange(line.id, 'qty', e.target.value)}
                          />
                        </div>
                        <div className="min-w-[180px] flex-1">
                          <Label>Material</Label>
                          <Input
                            value={line.material_type ?? ''}
                            disabled={fabLocked}
                            onChange={(e) => handleFabTextChange(line.id, 'material_type', e.target.value)}
                            placeholder="e.g. A36 Steel"
                          />
                        </div>
                        <div className="min-w-[160px]">
                          <Label>Thickness</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={line.thickness ?? ''}
                            disabled={fabLocked}
                            onChange={(e) => handleFabNumberChange(line.id, 'thickness', e.target.value)}
                          />
                        </div>
                        <div className="min-w-[220px] flex-1">
                          <Label>Description</Label>
                          <Input
                            value={line.description ?? ''}
                            disabled={fabLocked}
                            onChange={(e) => handleFabTextChange(line.id, 'description', e.target.value)}
                            placeholder="Panel bend, frame weld, etc."
                          />
                        </div>
                      </div>

                      {line.operation_type === 'PRESS_BRAKE' ? (
                        <div className="grid md:grid-cols-3 gap-3">
                          <div>
                            <Label>Bends</Label>
                            <Input
                              type="number"
                              min="0"
                              value={line.bends_count ?? ''}
                              disabled={fabLocked}
                              onChange={(e) => handleFabNumberChange(line.id, 'bends_count', e.target.value)}
                            />
                            {showFabValidation && missingInfo.missingFields.includes('bends count') && (
                              <p className="text-xs text-muted-foreground mt-1">Required to calculate pricing.</p>
                            )}
                          </div>
                          <div>
                            <Label>Bend Length (in)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.bend_length ?? ''}
                              disabled={fabLocked}
                              onChange={(e) => handleFabNumberChange(line.id, 'bend_length', e.target.value)}
                            />
                            {showFabValidation && missingInfo.missingFields.includes('bend length (in)') && (
                              <p className="text-xs text-muted-foreground mt-1">Required to calculate pricing.</p>
                            )}
                          </div>
                          <div>
                            <Label>Tooling</Label>
                            <Input
                              value={line.tooling ?? ''}
                              disabled={fabLocked}
                              onChange={(e) => handleFabTextChange(line.id, 'tooling', e.target.value)}
                              placeholder="Tooling notes"
                            />
                          </div>
                          <div>
                            <Label>Tonnage Estimate</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={line.tonnage_estimate ?? ''}
                              disabled={fabLocked}
                              onChange={(e) => handleFabNumberChange(line.id, 'tonnage_estimate', e.target.value)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid md:grid-cols-3 gap-3">
                          <div>
                            <Label>Process</Label>
                            <Select
                              value={line.weld_process ?? undefined}
                              onValueChange={(val) => val !== '__NONE__' && handleFabWeldProcessChange(line.id, val as FabJobLine['weld_process'])}
                              disabled={fabLocked}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select process" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__NONE__" disabled>
                                  Select process
                                </SelectItem>
                                <SelectItem value="MIG">MIG</SelectItem>
                                <SelectItem value="TIG">TIG</SelectItem>
                                <SelectItem value="STICK">Stick</SelectItem>
                                <SelectItem value="FLUX">Flux Core</SelectItem>
                              </SelectContent>
                            </Select>
                            {showFabValidation && missingInfo.missingFields.includes('weld process') && (
                              <p className="text-xs text-muted-foreground mt-1">Required to calculate pricing.</p>
                            )}
                          </div>
                          <div>
                            <Label>Weld Length (in)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.weld_length ?? ''}
                              disabled={fabLocked}
                              onChange={(e) => handleFabNumberChange(line.id, 'weld_length', e.target.value)}
                            />
                            {showFabValidation && missingInfo.missingFields.includes('weld length (in)') && (
                              <p className="text-xs text-muted-foreground mt-1">Required to calculate pricing.</p>
                            )}
                          </div>
                          <div>
                            <Label>Weld Type</Label>
                            <Select
                              value={line.weld_type ?? undefined}
                              onValueChange={(val) => val !== '__NONE__' && handleFabWeldTypeChange(line.id, val as FabJobLine['weld_type'])}
                              disabled={fabLocked}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__NONE__" disabled>
                                  Select type
                                </SelectItem>
                                <SelectItem value="FILLET">Fillet</SelectItem>
                                <SelectItem value="BUTT">Butt</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Position</Label>
                            <Input
                              value={line.position ?? ''}
                              disabled={fabLocked}
                              onChange={(e) => handleFabTextChange(line.id, 'position', e.target.value)}
                              placeholder="Flat, overhead, etc."
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Setup Minutes</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={line.setup_minutes ?? ''}
                            disabled={fabLocked}
                            onChange={(e) => handleFabNumberChange(line.id, 'setup_minutes', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Checkbox
                              checked={line.override_machine_minutes ?? false}
                              onCheckedChange={(checked) => handleFabToggleOverride(line.id, 'override_machine_minutes', checked === true)}
                              disabled={fabLocked}
                            />
                            Override Machine Minutes
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={line.machine_minutes ?? ''}
                            disabled={fabLocked || !line.override_machine_minutes}
                            onChange={(e) => handleFabNumberChange(line.id, 'machine_minutes', e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            {!line.override_machine_minutes && line.derived_machine_minutes != null
                              ? `Derived: ${formatNumber(line.derived_machine_minutes)} min`
                              : 'Manual entry when override is enabled'}
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-3">
                        <div>
                          <Label className="flex items-center gap-2">
                            <Checkbox
                              checked={line.override_consumables_cost ?? false}
                              onCheckedChange={(checked) => handleFabToggleOverride(line.id, 'override_consumables_cost', checked === true)}
                              disabled={fabLocked}
                            />
                            Override Consumables
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.consumables_cost ?? 0}
                            disabled={fabLocked || !line.override_consumables_cost}
                            onChange={(e) => handleFabNumberChange(line.id, 'consumables_cost', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="flex items-center gap-2">
                            <Checkbox
                              checked={line.override_labor_cost ?? false}
                              onCheckedChange={(checked) => handleFabToggleOverride(line.id, 'override_labor_cost', checked === true)}
                              disabled={fabLocked}
                            />
                            Override Labor
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.labor_cost ?? 0}
                            disabled={fabLocked || !line.override_labor_cost}
                            onChange={(e) => handleFabNumberChange(line.id, 'labor_cost', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Notes</Label>
                          <Input
                            value={line.notes ?? ''}
                            disabled={fabLocked}
                            onChange={(e) => handleFabTextChange(line.id, 'notes', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                          Setup {line.setup_minutes ?? 0} min · Machine {line.machine_minutes ?? 0} min
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-right">
                            <div className="font-medium">Unit: ${formatNumber(line.sell_price_each)}</div>
                            <div className="text-muted-foreground text-xs">Line Total: ${formatNumber(line.sell_price_total)}</div>
                          </div>
                          {!fabLocked && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteFabLine(line.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="space-y-1">
                  <Button variant="outline" size="sm" onClick={handleAddFabLine} disabled={isInvoiced || fabLocked}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Line
                  </Button>
                  {isInvoiced && <p className="text-xs text-muted-foreground">{workOrderLockMessage}</p>}
                </div>
                <div className="text-sm text-right space-y-1">
                  <div className="font-medium">Fabrication Total: ${formatNumber(fabTotal)}</div>
                  <div className="text-xs text-muted-foreground">
                    Qty {fabSummary.total_qty} · Setup {formatNumber(fabSummary.total_setup_minutes)} min · Machine {formatNumber(fabSummary.total_machine_minutes)} min · Cost ${formatNumber(fabSummary.total_cost)}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="plasma">
              {/* Summary Header */}
              <div className="mb-4 p-3 bg-muted/40 border rounded-lg">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <Badge variant={plasmaChargeLine ? 'default' : plasmaLocked ? 'secondary' : 'outline'}>
                      {plasmaChargeLine ? 'Posted' : plasmaLocked ? 'Locked' : plasmaJob?.status ?? 'DRAFT'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lines:</span>{' '}
                    <span className="font-medium">{plasmaLines.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cut Length:</span>{' '}
                    <span className="font-medium">
                      {formatNumber(plasmaLines.reduce((s, l) => s + toNumeric(l.cut_length) * toNumeric(l.qty), 0))} in
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pieces:</span>{' '}
                    <span className="font-medium">{plasmaLines.reduce((s, l) => s + (l.qty ?? 0), 0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>{' '}
                    <span className="font-semibold">${formatNumber(plasmaTotal)}</span>
                  </div>
                  {plasmaChargeLine && (
                    <div className="text-xs text-muted-foreground">
                      Posted on {plasmaJob?.posted_at ? new Date(plasmaJob.posted_at).toLocaleDateString() : '-'}
                    </div>
                  )}
                </div>
              </div>

              {/* Workflow Hint */}
              <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span className={plasmaLines.length === 0 ? 'font-semibold text-foreground' : ''}>1. Add lines</span>
                <span>→</span>
                <span className={plasmaLines.length > 0 && !plasmaJob?.dxf_estimated_total_cut_length ? 'font-semibold text-foreground' : ''}>
                  2. Upload DXF (optional)
                </span>
                <span>→</span>
                <span className={plasmaLines.length > 0 && !plasmaChargeLine ? 'font-semibold text-foreground' : ''}>3. Review</span>
                <span>→</span>
                <span className={plasmaChargeLine ? 'font-semibold text-foreground' : ''}>4. Post</span>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium">Plasma</h3>
                  {plasmaLocked && (
                    <Badge variant="outline" title="Editing disabled for posted or invoiced orders">
                      Locked
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex flex-col items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRecalculatePlasmaJob}
                      disabled={!plasmaJob || plasmaLocked}
                      title="Rebuilds pricing from the current line inputs. Use after changing thickness, cut length, or minutes."
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Recalculate
                    </Button>
                    {(!plasmaJob || plasmaLocked) && (
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {plasmaLocked ? 'Locked' : 'No plasma job'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <Button
                      size="sm"
                      onClick={handlePostPlasmaJob}
                      disabled={!plasmaJob || plasmaLines.length === 0 || plasmaLocked}
                      title="Locks the plasma job so pricing can't drift after approval."
                    >
                      <FileCheck className="w-4 h-4 mr-2" />
                      Post to Work Order
                    </Button>
                    {(!plasmaJob || plasmaLines.length === 0 || plasmaLocked) && (
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {plasmaLocked ? 'Locked' : plasmaLines.length === 0 ? 'Add lines first' : 'No plasma job'}
                      </span>
                    )}
                  </div>
                  {plasmaJob && (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/plasma/${plasmaJob.id}/print`)}>
                      Print Cut Sheet
                    </Button>
                  )}
                  {plasmaTemplateOptions.length > 0 && plasmaJob && (
                    <Select
                      onValueChange={(val) => {
                        if (val === '__NONE__') return;
                        const result = plasmaRepo.templates.applyToJob(val, plasmaJob.id);
                        if (!result.success) {
                          toast({ title: 'Template error', description: result.error, variant: 'destructive' });
                        } else {
                          toast({ title: 'Template applied' });
                        }
                      }}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Add from Template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__" disabled>
                          Select template
                        </SelectItem>
                        {plasmaTemplateOptions.map((tpl) => (
                          <SelectItem key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {currentOrder && (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/work-orders/${currentOrder.id}`)}>
                      View Work Order
                    </Button>
                  )}
                </div>
              </div>
              {plasmaWarnings.length > 0 && (
                <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="font-medium">Warnings</span>
                  </div>
                  {plasmaWarnings.map((w) => (
                    <div key={w}>{w}</div>
                  ))}
                </div>
              )}

              {/* DXF Assist Callout - highlighted when no cut length exists */}
              {plasmaJob && plasmaLines.length > 0 && plasmaLines.every((l) => !l.cut_length) && !dxfAssistOpen && (
                <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-primary">No cut lengths entered</h4>
                      <p className="text-sm text-muted-foreground">
                        Use DXF Assist to estimate cut lengths, pierces, and machine time from your drawing.
                      </p>
                    </div>
                    <Button variant="default" size="sm" onClick={() => setDxfAssistOpen(true)}>
                      Open DXF Assist
                    </Button>
                  </div>
                </div>
              )}
              {plasmaJob && (dxfAssistOpen || plasmaLines.some((l) => l.cut_length)) && (
                <div className="mb-4 border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">DXF Assist</h4>
                      <p className="text-sm text-muted-foreground">
                        Optional estimates for cut length, pierces, and machine time.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setDxfAssistOpen((v) => !v)}>
                      {dxfAssistOpen ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  {dxfAssistOpen && (
                    <div className="mt-3 grid md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <Label>Total Cut Length (in)</Label>
                        <Input
                          type="number"
                          value={plasmaJob.dxf_estimated_total_cut_length ?? ''}
                          onChange={(e) =>
                            plasmaRepo.updateJob(plasmaJob.id, {
                              dxf_estimated_total_cut_length: e.target.value ? parseFloat(e.target.value) : null,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Total Pierces</Label>
                        <Input
                          type="number"
                          value={plasmaJob.dxf_estimated_total_pierces ?? ''}
                          onChange={(e) =>
                            plasmaRepo.updateJob(plasmaJob.id, {
                              dxf_estimated_total_pierces: e.target.value ? parseFloat(e.target.value) : null,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Machine Minutes</Label>
                        <Input
                          type="number"
                          value={plasmaJob.dxf_estimated_machine_minutes ?? ''}
                          onChange={(e) =>
                            plasmaRepo.updateJob(plasmaJob.id, {
                              dxf_estimated_machine_minutes: e.target.value ? parseFloat(e.target.value) : null,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>DXF Notes</Label>
                        <Input
                          value={plasmaJob.dxf_notes ?? ''}
                          onChange={(e) =>
                            plasmaRepo.updateJob(plasmaJob.id, {
                              dxf_notes: e.target.value || null,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Table Column Toggle */}
              <div className="flex items-center justify-end mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPlasmaDetails((v) => !v)}
                  className="text-xs"
                >
                  {showPlasmaDetails ? 'Hide details' : 'Show details'}
                </Button>
              </div>

              <div className="table-container">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          Thickness
                        </span>
                      </TableHead>
                      <TableHead className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          Qty
                        </span>
                      </TableHead>
                      <TableHead className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          Cut Length
                        </span>
                      </TableHead>
                      <TableHead className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          Pierces
                        </span>
                      </TableHead>
                      {showPlasmaDetails && (
                        <>
                          <TableHead className="text-right">
                            <span className="flex items-center justify-end gap-1">
                              Setup (min)
                            </span>
                          </TableHead>
                          <TableHead className="text-right">
                            <span className="flex items-center justify-end gap-1">
                              Machine (min)
                            </span>
                          </TableHead>
                          <TableHead className="text-right">Derived?</TableHead>
                          <TableHead className="text-right">
                            <span className="flex items-center justify-end gap-1">
                              Unit Sell
                            </span>
                          </TableHead>
                        </>
                      )}
                      <TableHead className="text-right">Total</TableHead>
                      {!isInvoiced && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!plasmaJob || plasmaLines.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={showPlasmaDetails ? (isInvoiced ? 10 : 11) : (isInvoiced ? 6 : 7)}
                          className="text-center py-8"
                        >
                          <div className="text-muted-foreground mb-3">No plasma lines yet</div>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleAddPlasmaLine}
                            disabled={isInvoiced || plasmaLocked}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add First Line
                          </Button>
                          {isInvoiced && <p className="mt-2 text-xs text-muted-foreground">{workOrderLockMessage}</p>}
                        </TableCell>
                      </TableRow>
                    ) : (
                      plasmaLines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <Input
                              value={line.material_type ?? ''}
                              disabled={plasmaLocked}
                              onChange={(e) => handlePlasmaTextChange(line.id, e.target.value)}
                              placeholder="Material"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={line.thickness ?? ''}
                              disabled={plasmaLocked}
                              onChange={(e) => handlePlasmaNumberChange(line.id, 'thickness', e.target.value)}
                              className="text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={line.qty}
                              disabled={plasmaLocked}
                              onChange={(e) => handlePlasmaNumberChange(line.id, 'qty', e.target.value)}
                              className="text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.cut_length ?? ''}
                              disabled={plasmaLocked}
                              onChange={(e) => handlePlasmaNumberChange(line.id, 'cut_length', e.target.value)}
                              className="text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={line.pierce_count ?? ''}
                              disabled={plasmaLocked}
                              onChange={(e) => handlePlasmaNumberChange(line.id, 'pierce_count', e.target.value)}
                              className="text-right"
                            />
                          </TableCell>
                          {showPlasmaDetails && (
                            <>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={line.setup_minutes ?? ''}
                                  disabled={plasmaLocked}
                                  onChange={(e) => handlePlasmaNumberChange(line.id, 'setup_minutes', e.target.value)}
                                  className="text-right"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={line.machine_minutes ?? ''}
                                  disabled={plasmaLocked}
                                  onChange={(e) => handlePlasmaNumberChange(line.id, 'machine_minutes', e.target.value)}
                                  className="text-right"
                                />
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {line.override_machine_minutes ? (
                                  <Badge variant="outline">Override</Badge>
                                ) : line.derived_machine_minutes != null ? (
                                  <Badge variant="secondary">Derived</Badge>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.sell_price_each ?? 0}
                                  disabled={isInvoiced}
                                  onChange={(e) => handlePlasmaSellPriceChange(line.id, e.target.value)}
                                  className="text-right"
                                />
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-right font-medium">${formatNumber(line.sell_price_total)}</TableCell>
                          {!plasmaLocked && (
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    handleRecalculatePlasmaJob();
                                  }}
                                >
                                  Quick-Fill
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeletePlasmaLine(line.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {plasmaLines.length > 0 && (
                  <div className="space-y-1">
                    <Button variant="outline" size="sm" onClick={handleAddPlasmaLine} disabled={isInvoiced || plasmaLocked}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Line
                    </Button>
                    {isInvoiced && <p className="text-xs text-muted-foreground">{workOrderLockMessage}</p>}
                  </div>
                )}
                  <div className="text-sm text-right space-y-1">
                    <div className="font-medium flex items-center justify-end gap-1">
                      <span>Plasma Total: ${formatNumber(plasmaTotal)}</span>
                    </div>
                    {plasmaChargeLine && (
                      <div className="text-muted-foreground">
                        Posted as "{plasmaChargeLine.description}" (${formatNumber(plasmaChargeLine.total_price)})
                      </div>
                    )}
                    {plasmaJob && (
                      <div className="text-xs text-muted-foreground">
                        From Lines: Cut {formatNumber(plasmaLines.reduce((s, l) => s + toNumeric(l.cut_length) * toNumeric(l.qty), 0))} in, Pierces{' '}
                        {plasmaLines.reduce((s, l) => s + (l.pierce_count ?? 0) * (l.qty ?? 0), 0)}{' '}
                        {plasmaLines.some((l) => l.machine_minutes) && (
                          <>· Machine {formatNumber(plasmaLines.reduce((s, l) => s + toNumeric(l.machine_minutes) * toNumeric(l.qty), 0))} min</>
                        )}
                        {plasmaJob.dxf_estimated_total_cut_length != null && (
                          <>
                            {' '}
                            | DXF: Cut {plasmaJob.dxf_estimated_total_cut_length} in, Pierces {plasmaJob.dxf_estimated_total_pierces ?? '-'} · Machine{' '}
                            {plasmaJob.dxf_estimated_machine_minutes ?? '-'} min
                          </>
                        )}
                      </div>
                    )}
                  </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Attachments</h4>
                    <p className="text-sm text-muted-foreground">
                      DXF parsing/nesting not enabled yet — attachments are for reference.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      accept=".dxf,.pdf,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={(e) => handleAttachmentUpload(e.target.files?.[0])}
                      disabled={plasmaLocked}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={plasmaLocked}
                    >
                      Upload
                    </Button>
                  </div>
                </div>
                <div className="table-container">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Filename</TableHead>
                        <TableHead>Kind</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Added</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plasmaAttachments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                            No attachments yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        plasmaAttachments.map((att) => (
                          <TableRow key={att.id}>
                            <TableCell className="font-medium">{att.filename}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{att.kind}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {formatNumber(att.size_bytes / 1024 / 1024)} MB
                            </TableCell>
                            <TableCell>
                              <Input
                                defaultValue={att.notes ?? ''}
                                onBlur={(e) => handleAttachmentNoteChange(att.id, e.target.value)}
                                disabled={plasmaLocked}
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {new Date(att.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {!plasmaLocked && (
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveAttachment(att.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {timeEntries.length > 0 && (
              <TabsContent value="time">
                <h3 className="font-medium mb-4">Time Entries</h3>
                <div className="table-container">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Technician</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead className="text-right">Minutes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeEntries.map((entry) => {
                        const tech = technicians.find((t) => t.id === entry.technician_id);
                        return (
                          <TableRow key={entry.id}>
                            <TableCell>{tech?.name || '-'}</TableCell>
                            <TableCell>{new Date(entry.clock_in).toLocaleString()}</TableCell>
                            <TableCell>{entry.clock_out ? new Date(entry.clock_out).toLocaleString() : <Badge>Active</Badge>}</TableCell>
                            <TableCell className="text-right">{entry.total_minutes}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            )}
          </Tabs>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parts Subtotal:</span>
                <span>${formatNumber(currentOrder?.parts_subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Labor Subtotal:</span>
                <span>${formatNumber(currentOrder?.labor_subtotal)}</span>
              </div>
              {(currentOrder?.charge_subtotal ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Charges:</span>
                  <span>${formatNumber(currentOrder?.charge_subtotal)}</span>
                </div>
              )}
              {(currentOrder?.core_charges_total ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Core Charges:</span>
                  <span>${formatNumber(currentOrder?.core_charges_total)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>${formatNumber(currentOrder?.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({currentOrder?.tax_rate}%):</span>
                <span>${formatNumber(currentOrder?.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t border-border pt-2">
                <span>Total:</span>
                <span>${formatNumber(currentOrder?.total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="border rounded-lg p-4 bg-muted/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <p className="font-semibold">
                    ${formatNumber(payments.summary.totalPaid)} paid of ${formatNumber(orderTotal)}
                  </p>
                </div>
                <Badge variant="outline" className={paymentStatusClass}>
                  {payments.summary.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Paid</span>
                  <span className="font-medium">${formatNumber(payments.summary.totalPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance Due</span>
                  <span className="font-medium">${formatNumber(payments.summary.balanceDue)}</span>
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
                        ${formatNumber(payment.amount)} · {payment.method}
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

      {currentOrder && (
        <div className="form-section mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Warranty Claims</h2>
            <Dialog open={createClaimOpen} onOpenChange={handleCreateClaimOpenChange}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={isInvoiced}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Warranty Claim
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Warranty Claim</DialogTitle>
                  <DialogDescription>Select a vendor to start a claim.</DialogDescription>
                </DialogHeader>
                <Select value={selectedClaimVendor} onValueChange={setSelectedClaimVendor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.vendor_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateClaimOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateWarrantyClaim}
                    disabled={isInvoiced || (!selectedClaimVendor && vendors.length === 0)}
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {isInvoiced && <p className="mb-2 text-xs text-muted-foreground">{workOrderLockMessage}</p>}
          {workOrderClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground">No warranty claims linked to this work order.</p>
          ) : (
            <div className="space-y-2">
              {workOrderClaims.map((claim) => (
                <div key={claim.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{claim.claim_number || claim.id}</span>
                    <StatusBadge status={claim.status} />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/warranty/${claim.id}`)}>
                    Open
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div id="wo-tech-print" className="hidden">
        <div className="space-y-4 p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xl font-semibold">{settings.shop_name}</div>
              <div className="text-sm text-muted-foreground">Work Order {currentOrder?.order_number}</div>
              <div className="text-sm text-muted-foreground">Status: {currentOrder?.status}</div>
            </div>
            <div className="text-sm text-muted-foreground text-right">
              <div>{new Date().toLocaleDateString()}</div>
              {customer && <div>{customer.company_name}</div>}
              {unit && (
                <div>
                  {unit.year} {unit.make} {unit.model} {unit.vin ? `(${unit.vin})` : ''}
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <h4 className="font-medium mb-2">Parts</h4>
            <div className="space-y-2">
              {partLines.length === 0 ? (
                <div className="text-sm text-muted-foreground">No parts</div>
              ) : (
                partLines.map((line) => {
                  const part = parts.find((p) => p.id === line.part_id);
                  return (
                    <div key={line.id} className="flex items-center gap-3 text-sm">
                      <input type="checkbox" className="h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{part?.part_number || line.description || 'Part'}</div>
                        <div className="text-muted-foreground">
                          Qty {line.quantity} {part?.bin_location ? `· Bin ${part.bin_location}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <h4 className="font-medium mb-2">Labor</h4>
            <div className="space-y-2">
              {laborLines.length === 0 ? (
                <div className="text-sm text-muted-foreground">No labor</div>
              ) : (
                laborLines.map((line) => (
                  <div key={line.id} className="flex items-center gap-3 text-sm">
                    <input type="checkbox" className="h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">{line.description}</div>
                      <div className="text-muted-foreground">Hours: {line.hours}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <h4 className="font-medium mb-2">Fabrication</h4>
            <div className="space-y-2">
              {fabLines.length === 0 ? (
                <div className="text-sm text-muted-foreground">No fabrication lines</div>
              ) : (
                fabLines.map((line) => (
                  <div key={line.id} className="flex items-start gap-3 text-sm">
                    <input type="checkbox" className="h-4 w-4 mt-1" />
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">
                        {line.operation_type === 'PRESS_BRAKE' ? 'Press Brake' : 'Weld'} · {line.description || 'Line'}
                      </div>
                      {line.operation_type === 'PRESS_BRAKE' ? (
                        <div className="text-muted-foreground">
                          Bends: {line.bends_count ?? '-'} · Bend Length: {line.bend_length ?? '-'} in · Setup: {line.setup_minutes ?? 0} min · Machine:{' '}
                          {line.machine_minutes ?? 0} min
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          Process: {line.weld_process || '-'} · Length: {line.weld_length ?? '-'} in · Setup: {line.setup_minutes ?? 0} min · Machine:{' '}
                          {line.machine_minutes ?? 0} min
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <h4 className="font-medium mb-2">Plasma</h4>
            <div className="space-y-2">
              {plasmaLines.length === 0 ? (
                <div className="text-sm text-muted-foreground">No plasma lines</div>
              ) : (
                plasmaLines.map((line) => (
                  <div key={line.id} className="flex items-center gap-3 text-sm">
                    <input type="checkbox" className="h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">{line.material_type || 'Plasma Line'}</div>
                      <div className="text-muted-foreground">
                        Qty {line.qty} · Thickness {line.thickness ?? '-'} · Machine {line.machine_minutes ?? 0} min
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <h4 className="font-medium mb-2">Notes</h4>
            <div className="h-24 border rounded-md" />
          </div>

          <div className="border rounded-lg p-3">
            <h4 className="font-medium mb-2">Sign-off</h4>
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <div className="text-muted-foreground">Technician</div>
                <div className="border-b border-dashed h-8" />
              </div>
              <div>
                <div className="text-muted-foreground">Date</div>
                <div className="border-b border-dashed h-8" />
              </div>
              <div>
                <div className="text-muted-foreground">Signature</div>
                <div className="border-b border-dashed h-8" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {aiAssistEnabled && currentOrder && (
        <Dialog open={aiAssistOpen} onOpenChange={setAiAssistOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>AI Assist (Preview)</DialogTitle>
              <DialogDescription>This is a demo. No external AI calls.</DialogDescription>
            </DialogHeader>
            <AIAssistPanel
              context={{
                type: 'workOrder',
                order: currentOrder,
                customer,
                unit,
                partLines,
                laborLines,
                chargeLines,
              }}
              parts={parts}
              notesValue={notesValue}
              originalStoredNote={aiOriginalNote}
              onApplyNote={(original, rewritten) => handleAiApplyNote(original, rewritten)}
              onSelectPart={(partId) => {
                setSelectedPartId(partId);
                setAddPartDialogOpen(true);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Print Invoice */}
      {/* Print Invoice */}
      {currentOrder && (
        <>
          {printMode === 'invoice' && (
            <PrintWorkOrder order={currentOrder} partLines={partLines} laborLines={laborLines} customer={customer} unit={unit} parts={parts} shopName={settings.shop_name} />
          )}
          {printMode === 'picklist' && (
            <PrintWorkOrderPickList order={currentOrder} partLines={partLines} laborLines={laborLines} customer={customer} unit={unit} parts={parts} shopName={settings.shop_name} />
          )}
        </>
      )}

      {showMobileActionBar && (
        <div className="no-print">
          <MobileActionBar
            primary={
              <div className="flex w-full gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowInvoiceDialog(true)}
                  disabled={isCustomerOnHold || !canCreateInvoices}
                  className="flex-1"
                >
                  <FileCheck className="w-4 h-4 mr-2" />
                  Invoice
                </Button>
                <Button size="sm" onClick={() => openPartDialog(null)} className="flex-1">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Part
                </Button>
              </div>
            }
            secondary={
              <Button size="sm" variant="outline" onClick={() => openLaborDialog(null)} className="flex-1">
                <Plus className="w-4 h-4 mr-2" />
                Add Labor
              </Button>
            }
          />
          <MobileActionBarSpacer />
        </div>
      )}

      {/* Add Part Dialog */}
      <AdaptiveDialog
        open={addPartDialogOpen}
        onOpenChange={handlePartDialogOpenChange}
        title="Add Part"
        contentClassName="w-full max-w-3xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handlePartDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPart}>Save</Button>
          </div>
        }
      >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Part *</Label>
              <div className="flex items-center gap-2">
                <SmartSearchSelect
                  className="flex-1 min-w-0"
                  value={selectedPartId || null}
                  onChange={(v) => setSelectedPartId(v ?? '')}
                  items={partPickerItems}
                  placeholder="Search parts by # or description..."
                  minChars={2}
                  limit={25}
                  renderItem={(item) => (
                    <div className="flex flex-col">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.meta?.vendor && `${item.meta.vendor} · `}
                        {item.meta?.category && `${item.meta.category} · `}
                        QOH: {String(item.meta?.quantity_on_hand ?? 0)}
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
                  Demo suggestions only. Selecting just fills the picker and never auto-adds a line.
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
              <Label className="flex items-center gap-1">
                Quantity
              </Label>
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
                  id="wo-browse-in-stock"
                />
                <Label htmlFor="wo-browse-in-stock" className="text-sm">
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

      {/* Quick Add Part */}
      <QuickAddDialog
        open={newPartDialogOpen}
        onOpenChange={setNewPartDialogOpen}
        title="Quick Add Part"
        onSave={handleQuickAddPart}
        onCancel={() => setNewPartDialogOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <Label>Part Number *</Label>
            <Input
              value={newPartData.part_number}
              onChange={(e) => setNewPartData({ ...newPartData, part_number: e.target.value })}
              placeholder="e.g., BRK-001"
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
              <div className="mb-2 flex items-center justify-between">
                <Label>Vendor *</Label>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => setQuickAddVendorOpen(true)}
                  aria-label="Quick add vendor"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
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
              <div className="mb-2 flex items-center justify-between">
                <Label>Category *</Label>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => setQuickAddCategoryOpen(true)}
                  aria-label="Quick add category"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
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
                value={newPartData.cost}
                onChange={(e) => setNewPartData({ ...newPartData, cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Selling Price</Label>
              <Input
                type="number"
                value={newPartData.selling_price}
                onChange={(e) => setNewPartData({ ...newPartData, selling_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </QuickAddDialog>

      <QuickAddDialog
        open={quickAddVendorOpen}
        onOpenChange={(open) => {
          setQuickAddVendorOpen(open);
          if (!open) resetQuickAddVendorForm();
        }}
        title="Quick Add Vendor"
        onSave={handleQuickAddVendor}
        onCancel={() => {
          setQuickAddVendorOpen(false);
          resetQuickAddVendorForm();
        }}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="quick_add_vendor_name">Vendor Name *</Label>
            <Input
              id="quick_add_vendor_name"
              value={newVendorName}
              onChange={(e) => setNewVendorName(e.target.value)}
              placeholder="Enter vendor name"
            />
          </div>
          <div>
            <Label htmlFor="quick_add_vendor_phone">Phone</Label>
            <Input
              id="quick_add_vendor_phone"
              value={newVendorPhone}
              onChange={(e) => setNewVendorPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="quick_add_vendor_email">Email</Label>
            <Input
              id="quick_add_vendor_email"
              type="email"
              value={newVendorEmail}
              onChange={(e) => setNewVendorEmail(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
      </QuickAddDialog>

      <QuickAddDialog
        open={quickAddCategoryOpen}
        onOpenChange={(open) => {
          setQuickAddCategoryOpen(open);
          if (!open) resetQuickAddCategoryForm();
        }}
        title="Quick Add Category"
        onSave={handleQuickAddCategory}
        onCancel={() => {
          setQuickAddCategoryOpen(false);
          resetQuickAddCategoryForm();
        }}
      >
        <div>
          <Label htmlFor="quick_add_category_name">Category Name *</Label>
          <Input
            id="quick_add_category_name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Enter category name"
          />
        </div>
      </QuickAddDialog>

      {/* Add Labor Dialog */}
      <AdaptiveDialog
        open={addLaborDialogOpen}
        onOpenChange={handleLaborDialogOpenChange}
        title="Add Labor"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleLaborDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddLabor}
              disabled={!laborTechnicianId || !technicians.some((technician) => technician.id === laborTechnicianId)}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Description *</Label>
            <Textarea value={laborDescription} onChange={(e) => setLaborDescription(e.target.value)} placeholder="Describe the work performed" rows={2} />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              Technician
            </Label>
            <Select value={laborTechnicianId} onValueChange={setLaborTechnicianId}>
              <SelectTrigger><SelectValue placeholder="Select technician (optional)" /></SelectTrigger>
              <SelectContent>
                {activeTechnicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="flex items-center gap-1">
              Hours
            </Label>
            <Input type="number" min="0.25" step="0.25" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} />
          </div>
        </div>
      </AdaptiveDialog>

      {/* Invoice Confirmation Dialog */}
      <AlertDialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invoice this Work Order?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently lock the order. Active time entries will be clocked out.</AlertDialogDescription>
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

      {/* Delete Job Confirmation Dialog */}
      <AlertDialog open={deleteJobDialog.open} onOpenChange={(open) => {
        if (!open) {
          setDeleteJobDialog({ open: false, jobId: null, jobTitle: '' });
          setDeleteJobConfirmText('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job: {deleteJobDialog.jobTitle}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this job from the work order. This action cannot be undone.
              <br /><br />
              <strong>Note:</strong> Jobs with time entries, parts, or labor lines cannot be deleted. Remove those items first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-sm text-muted-foreground">Type DELETE to confirm:</Label>
            <Input 
              value={deleteJobConfirmText} 
              onChange={(e) => setDeleteJobConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteJobDialog.jobId && handleDeleteJob(deleteJobDialog.jobId)}
              disabled={deleteJobConfirmText !== 'DELETE'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
