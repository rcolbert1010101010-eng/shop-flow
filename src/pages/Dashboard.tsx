import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useShopStore } from '@/stores/shopStore';
import { DashboardKpiCard } from '@/components/dashboard/DashboardKpiCard';
import { DashboardKanban } from '@/components/dashboard/DashboardKanban';
import type { DashboardKanbanColumn } from '@/components/dashboard/DashboardKanban';
import { DashboardAlertsRail } from '@/components/dashboard/DashboardAlertsRail';
import type { DashboardAlertGroup } from '@/components/dashboard/DashboardAlertsRail';
import { useQueryClient } from '@tanstack/react-query';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Wrench, ShoppingCart, AlertTriangle, DollarSign, Shield, ClipboardList, Clock3, Search, LayoutDashboard, RotateCw, Command as CommandIcon } from 'lucide-react';
import type { ScheduleItem, WorkOrder, Customer, Unit, Part } from '@/types';
import { inventoryInsights } from '@/services/aiAssist/aiAssistPreview';

const VIEW_STORAGE_KEY = 'dashboard-view';

type FocusKey = 'blocked' | 'waitingApproval' | 'waitingParts' | 'unassigned';

type FocusActionEntry = {
  key: FocusKey;
  label: string;
  count: number;
  route: string;
  description: string;
};

const SLA_THRESHOLDS = {
  waitingApprovalHours: 24,
  waitingPartsHours: 48,
  inProgressDays: 7,
};

type DashboardViewConfig = {
  id: string;
  label: string;
  description: string;
  focusPriority: FocusKey[];
  alertOrder: string[];
  sections: {
    showFocus: boolean;
    showAlertsRail: boolean;
    showTechSnapshot: boolean;
  };
};

const DASHBOARD_VIEWS: DashboardViewConfig[] = [
  {
    id: 'manager',
    label: 'Manager',
    description: 'Blockers & approvals',
    focusPriority: ['blocked', 'waitingApproval', 'waitingParts', 'unassigned'],
    alertOrder: ['waitingParts', 'waitingApproval', 'negativeInventory', 'openPurchaseOrders'],
    sections: { showFocus: true, showAlertsRail: true, showTechSnapshot: true },
  },
  {
    id: 'service-writer',
    label: 'Service Writer',
    description: 'Pipeline & approvals',
    focusPriority: ['waitingApproval', 'blocked', 'waitingParts', 'unassigned'],
    alertOrder: ['waitingApproval', 'waitingParts', 'negativeInventory', 'openPurchaseOrders'],
    sections: { showFocus: true, showAlertsRail: true, showTechSnapshot: false },
  },
  {
    id: 'parts',
    label: 'Parts',
    description: 'Inventory + shortages',
    focusPriority: ['waitingParts', 'blocked', 'waitingApproval', 'unassigned'],
    alertOrder: ['negativeInventory', 'waitingParts', 'waitingApproval', 'openPurchaseOrders'],
    sections: { showFocus: true, showAlertsRail: true, showTechSnapshot: false },
  },
];

const DEFAULT_VIEW_ID = DASHBOARD_VIEWS[0]?.id ?? 'manager';

const formatAgeLabel = (ageMs: number) => {
  if (ageMs < 0) return '0m';
  const minutes = Math.floor(ageMs / (1000 * 60));
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const aiAssistEnabled = (import.meta as any).env?.VITE_AI_ASSIST_PREVIEW === 'true';
  const {
    workOrders,
    salesOrders,
    purchaseOrders,
    parts,
    workOrderPartLines,
    workOrderLaborLines,
    settings,
    scheduleItems,
    technicians,
    timeEntries,
    customers,
    units,
  } = useShopStore();

  const [commandQuery, setCommandQuery] = useState('');
  const [isHydrating, setIsHydrating] = useState(true);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const [selectedViewId, setSelectedViewId] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_VIEW_ID;
    }
    return window.localStorage.getItem(VIEW_STORAGE_KEY) ?? DEFAULT_VIEW_ID;
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const isMac = useMemo(
    () =>
      typeof window !== 'undefined' &&
      /Mac|iPod|iPhone|iPad/i.test(window.navigator?.platform || window.navigator?.userAgent || ''),
    []
  );
  const quickShortcutLabel = isMac ? '⌘ + K' : 'Ctrl + K';
  const quickButtonLabel = isMac ? 'Quick (⌘ + K)' : 'Quick (Ctrl + K)';
  type GlobalSearchResults = {
    customers: { id: string; label: string; detail?: string; route: string }[];
    units: { id: string; label: string; detail?: string; route: string }[];
    workOrders: { id: string; label: string; detail?: string; route: string }[];
    parts: { id: string; label: string; detail?: string; route: string }[];
  };
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<GlobalSearchResults | null>(null);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsHydrating(false), 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, selectedViewId);
  }, [selectedViewId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const activeView = useMemo(
    () => DASHBOARD_VIEWS.find((view) => view.id === selectedViewId) ?? DASHBOARD_VIEWS[0],
    [selectedViewId]
  );
  const aiInsights = useMemo(
    () => (aiAssistEnabled ? inventoryInsights({ parts, workOrders, salesOrders }) : []),
    [aiAssistEnabled, parts, workOrders, salesOrders]
  );

  const secondsSinceUpdate = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setIsHydrating(true);
    const refreshTimer = setTimeout(() => setIsHydrating(false), 250);
    queryClient
      .invalidateQueries({ queryKey: ['dashboard'] })
      .finally(() => {
        clearTimeout(refreshTimer);
        setIsRefreshing(false);
        setIsHydrating(false);
        setLastUpdatedAt(Date.now());
      });
  };

  const openWorkOrders = useMemo(
    () => workOrders.filter((wo) => wo.status !== 'INVOICED'),
    [workOrders]
  );

  useEffect(() => {
    setLastUpdatedAt(Date.now());
  }, [openWorkOrders.length, salesOrders.length, purchaseOrders.length, parts.length]);

  const partsMap = useMemo(() => new Map(parts.map((part) => [part.id, part])), [parts]);
  const customersMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const unitsMap = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

  const scheduleMap = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    scheduleItems.forEach((item) => {
      if (!item.source_ref_id) return;
      const bucket = map.get(item.source_ref_id) ?? [];
      bucket.push(item);
      map.set(item.source_ref_id, bucket);
    });
    return map;
  }, [scheduleItems]);

  const unscheduledWorkOrders = useMemo(
    () => openWorkOrders.filter((wo) => (scheduleMap.get(wo.id) ?? []).length === 0),
    [openWorkOrders, scheduleMap]
  );

  const hasPartsShortage = useCallback(
    (workOrder: WorkOrder) =>
      Boolean(
        workOrder.part_lines?.some((line) => {
          const part = partsMap.get(line.part_id);
          return part && part.quantity_on_hand < line.quantity;
        })
      ),
    [partsMap]
  );

  const waitingPartsWorkOrders = useMemo(
    () => openWorkOrders.filter((wo) => hasPartsShortage(wo)),
    [openWorkOrders, hasPartsShortage]
  );

  const waitingApprovalWorkOrders = useMemo(
    () => openWorkOrders.filter((wo) => wo.status === 'ESTIMATE'),
    [openWorkOrders]
  );

  const blockedCount = waitingPartsWorkOrders.length + waitingApprovalWorkOrders.length;

  const todayFocusActions = useMemo(() => {
    const focusEntries: Record<FocusKey, FocusActionEntry> = {
      blocked: {
        key: 'blocked',
        label: 'Blocked Work Orders',
        count: blockedCount,
        route: '/work-orders?filter=blocked',
        description: 'Waiting for parts or approvals',
      },
      waitingApproval: {
        key: 'waitingApproval',
        label: 'Approvals Needed',
        count: waitingApprovalWorkOrders.length,
        route: '/work-orders?filter=waiting-approval',
        description: 'Estimates pending sign off',
      },
      waitingParts: {
        key: 'waitingParts',
        label: 'Waiting on Parts',
        count: waitingPartsWorkOrders.length,
        route: '/work-orders?filter=waiting-parts',
        description: 'Parts shortages blocking progress',
      },
      unassigned: {
        key: 'unassigned',
        label: 'Unscheduled Work Orders',
        count: unscheduledWorkOrders.length,
        route: '/work-orders?filter=unscheduled',
        description: 'No technician scheduled yet',
      },
    };

    return activeView.focusPriority
      .map((key) => focusEntries[key])
      .filter(Boolean)
      .slice(0, 3);
  }, [
    activeView.focusPriority,
    blockedCount,
    waitingApprovalWorkOrders.length,
    waitingPartsWorkOrders.length,
    unscheduledWorkOrders.length,
  ]);

  const todayString = new Date().toDateString();
  const dailyRevenue = useMemo(() => {
    const invoices = [
      ...workOrders.filter((o) => o.invoiced_at && new Date(o.invoiced_at).toDateString() === todayString),
      ...salesOrders.filter((o) => o.invoiced_at && new Date(o.invoiced_at).toDateString() === todayString),
    ];
    return invoices.reduce((sum, order) => sum + (order.total ?? 0), 0);
  }, [workOrders, salesOrders, todayString]);

  const warrantyPartsCost = useMemo(() => {
    return workOrderPartLines.reduce((sum, line) => {
      if (!line.is_warranty) return sum;
      const part = partsMap.get(line.part_id);
      return sum + (part?.cost ?? 0) * line.quantity;
    }, 0);
  }, [workOrderPartLines, partsMap]);

  const warrantyLaborCost = useMemo(
    () => workOrderLaborLines.reduce((sum, line) => (line.is_warranty ? sum + line.line_total : sum), 0),
    [workOrderLaborLines]
  );

  const warrantyExposure = warrantyPartsCost + warrantyLaborCost;
  const warrantyFeatureEnabled = Boolean((settings as any)?.features?.warrantyDashboard);
  const showWarrantyCard = warrantyFeatureEnabled || warrantyExposure > 0;

  const negativeInventoryParts = useMemo(
    () => parts.filter((part) => part.quantity_on_hand < 0 && part.is_active),
    [parts]
  );

  const openPurchaseOrders = useMemo(
    () => purchaseOrders.filter((po) => po.status === 'OPEN'),
    [purchaseOrders]
  );

  const permissions = {
    workOrder: true,
    salesOrder: true,
    receiveInventory: true,
    cycleCount: true,
  };

  const quickActions = [
    { label: 'New Work Order', icon: Wrench, route: '/work-orders/new', permission: 'workOrder' },
    { label: 'New Sales Order', icon: ShoppingCart, route: '/sales-orders/new', permission: 'salesOrder' },
    { label: 'Receive Inventory', icon: ClipboardList, route: '/receive-inventory', permission: 'receiveInventory' },
    { label: 'Quick Cycle Count', icon: Clock3, route: '/cycle-counts/new', permission: 'cycleCount' },
  ];

  const commandPaletteActions = useMemo(
    () => [
      { label: 'New Work Order', action: () => navigate('/work-orders/new') },
      { label: 'New Sales Order', action: () => navigate('/sales-orders/new') },
      { label: 'Receive Inventory', action: () => navigate('/receive-inventory') },
      { label: 'Quick Cycle Count', action: () => navigate('/cycle-counts/new') },
      {
        label: 'Search',
        action: () => searchInputRef.current?.focus(),
      },
    ],
    [navigate]
  );
  const filteredCommands = useMemo(
    () =>
      commandPaletteActions.filter((item) =>
        item.label.toLowerCase().includes(commandQuery.toLowerCase())
      ),
    [commandPaletteActions, commandQuery]
  );

  const handleGlobalSearchSubmit = useCallback(() => {
    const query = globalSearchQuery.trim();
    if (!query) {
      setGlobalSearchResults(null);
      return;
    }
    setIsGlobalSearching(true);
    const q = query.toLowerCase();

    const customersResults = (customers as Customer[]).filter((c) => {
      const name = c.company_name ?? '';
      const contact = `${(c as any).first_name ?? ''} ${(c as any).last_name ?? ''}`;
      const phone = (c as any).phone ?? '';
      const email = (c as any).email ?? '';
      return (
        name.toLowerCase().includes(q) ||
        contact.toLowerCase().includes(q) ||
        phone.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q)
      );
    }).map((c) => ({
      id: c.id,
      label: c.company_name ?? 'Customer',
      detail: (c as any).phone ?? (c as any).email ?? undefined,
      route: `/customers/${c.id}`,
    }));

    const unitsResults = (units as Unit[]).filter((u) => {
      const iden = u.unit_name ?? '';
      const vin = (u as any).vin ?? '';
      const plate = (u as any).license_plate ?? '';
      const desc = (u as any).description ?? '';
      return (
        iden.toLowerCase().includes(q) ||
        vin.toLowerCase().includes(q) ||
        plate.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q)
      );
    }).map((u) => ({
      id: u.id,
      label: u.unit_name ?? 'Unit',
      detail: (u as any).vin ?? (u as any).license_plate ?? undefined,
      route: `/units/${u.id}`,
    }));

    const workOrdersResults = (openWorkOrders as WorkOrder[]).filter((wo) => {
      const number = wo.order_number ?? '';
      const customerName = customersMap.get(wo.customer_id)?.company_name ?? '';
      const unitName = unitsMap.get(wo.unit_id)?.unit_name ?? '';
      return (
        number.toLowerCase().includes(q) ||
        customerName.toLowerCase().includes(q) ||
        unitName.toLowerCase().includes(q)
      );
    }).map((wo) => ({
      id: wo.id,
      label: wo.order_number || wo.id,
      detail: customersMap.get(wo.customer_id)?.company_name ?? 'Customer',
      route: `/work-orders/${wo.id}`,
    }));

    const partsResults = (parts as Part[]).filter((p) => {
      const num = (p as any).part_number ?? '';
      const desc = p.description ?? '';
      return num.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
    }).map((p) => ({
      id: p.id,
      label: (p as any).part_number ?? p.name ?? 'Part',
      detail: p.description,
      route: '/inventory', // no direct part detail route noted
    }));

    setGlobalSearchResults({
      customers: customersResults,
      units: unitsResults,
      workOrders: workOrdersResults,
      parts: partsResults,
    });
    setIsGlobalSearching(false);
  }, [customers, customersMap, globalSearchQuery, navigate, openWorkOrders, parts, units, unitsMap]);

  const managerKpiCards = useMemo(() => {
    const overdueCount = openWorkOrders.filter((wo) => {
      const due = (wo as { due_at?: string | null }).due_at;
      return due && new Date(due) < new Date();
    }).length;

    return [
      {
        title: 'Today Revenue',
        value: `$${dailyRevenue.toFixed(2)}`,
        description: 'Invoiced today',
        icon: DollarSign,
        tone: 'success' as const,
        onClick: () => navigate('/work-orders?filter=today'),
      },
      {
        title: 'Open WOs',
        value: openWorkOrders.length,
        description: 'Excludes invoiced',
        icon: Wrench,
        tone: 'primary' as const,
        onClick: () => navigate('/work-orders?status=open'),
      },
      {
        title: 'Overdue',
        value: overdueCount,
        description: 'Past due dates',
        icon: AlertTriangle,
        tone: overdueCount > 0 ? 'warning' as const : 'default' as const,
        onClick: () => navigate('/work-orders?filter=overdue'),
      },
      {
        title: 'Efficiency',
        value: '—',
        description: 'Coming soon',
        icon: Shield,
        tone: 'default' as const,
        onClick: () => {},
      },
    ];
  }, [dailyRevenue, navigate, openWorkOrders]);

  const defaultKpiCards = useMemo(() => {
    const inProgressCount = openWorkOrders.filter((wo) => wo.status === 'IN_PROGRESS').length;
    const waitingCount = openWorkOrders.filter((wo) => wo.status === 'OPEN').length;
    const newCount = openWorkOrders.filter((wo) => wo.status === 'ESTIMATE').length;

    const cards = [
      {
        title: 'Open Work Orders',
        value: openWorkOrders.length,
        meta: [
          `In Progress ${inProgressCount}`,
          `Waiting ${waitingCount}`,
          `New ${newCount}`,
        ],
        description: 'Excludes invoiced orders',
        icon: Wrench,
        tone: 'primary' as const,
        onClick: () => navigate('/work-orders?status=open'),
      },
      {
        title: 'Blocked Work Orders',
        value: blockedCount,
        meta: [
          `Waiting Parts ${waitingPartsWorkOrders.length}`,
          `Waiting Approval ${waitingApprovalWorkOrders.length}`,
        ],
        icon: AlertTriangle,
        tone: blockedCount > 0 ? 'warning' as const : 'default' as const,
        onClick: () => navigate('/work-orders?filter=blocked'),
      },
      {
        title: 'Today Revenue',
        value: `$${dailyRevenue.toFixed(2)}`,
        description: 'Invoiced today',
        icon: DollarSign,
        tone: 'success' as const,
        onClick: () => navigate('/work-orders?filter=today'),
      },
      {
        title: 'Negative Inventory',
        value: negativeInventoryParts.length,
        description: 'Parts tracking below zero',
        icon: ClipboardList,
        tone: negativeInventoryParts.length > 0 ? 'warning' as const : 'default' as const,
        onClick: () => navigate('/inventory?filter=negative'),
      },
    ];

    if (showWarrantyCard) {
      cards.splice(3, 0, {
        title: 'Warranty Exposure',
        value: warrantyExposure > 0 ? `$${warrantyExposure.toFixed(2)}` : '—',
        description: 'Includes warranty labor + parts',
        icon: Shield,
        tone: warrantyExposure > 0 ? 'warning' as const : 'default' as const,
        onClick: () => navigate('/work-orders?filter=warranty'),
      });
    }

    return cards;
  }, [
    openWorkOrders,
    blockedCount,
    waitingPartsWorkOrders.length,
    waitingApprovalWorkOrders.length,
    dailyRevenue,
    negativeInventoryParts.length,
    warrantyExposure,
    showWarrantyCard,
    navigate,
  ]);

  const kpiCards = activeView.id === 'manager' ? managerKpiCards : defaultKpiCards;

  const determineColumnId = useCallback(
    (
      workOrder: WorkOrder,
      ageDays: number,
      blockedByParts: boolean,
      hasScheduleItem: boolean,
      blockedBySchedule: boolean
    ) => {
      const isNew = workOrder.status === 'ESTIMATE' && ageDays <= 2;
      const isWaitingApproval = workOrder.status === 'ESTIMATE' && !isNew;
      const needsQa =
        (scheduleMap.get(workOrder.id) ?? []).some((item) => item.status === 'QA') ||
        Boolean(workOrder.notes?.toLowerCase().includes('qa'));
      const readyForInvoice = workOrder.status === 'IN_PROGRESS' && !blockedByParts && !blockedBySchedule;

      if (isNew) return 'new';
      if (isWaitingApproval) return 'waitingApproval';
      if (blockedByParts || blockedBySchedule) return 'waitingParts';
      if (hasScheduleItem) return 'scheduled';
      if (readyForInvoice) return 'readyToInvoice';
      if (needsQa) return 'qa';
      if (workOrder.status === 'IN_PROGRESS') return 'inProgress';
      return 'scheduled';
    },
    [scheduleMap]
  );

  const pipelineColumns = useMemo(() => {
    const schema: DashboardKanbanColumn[] = [
      { id: 'new', label: 'New', items: [] },
      { id: 'waitingApproval', label: 'Waiting Approval', items: [] },
      { id: 'waitingParts', label: 'Waiting Parts', items: [] },
      { id: 'scheduled', label: 'Scheduled', items: [] },
      { id: 'inProgress', label: 'In Progress', items: [] },
      { id: 'qa', label: 'QA', items: [] },
      { id: 'readyToInvoice', label: 'Ready to Invoice', items: [] },
    ];

    const map = new Map(schema.map((column) => [column.id, column]));

    openWorkOrders.forEach((workOrder) => {
      const createdAt = new Date(workOrder.created_at);
      const ageMs = Math.max(0, now - createdAt.getTime());
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      const ageHours = ageMs / (1000 * 60 * 60);
      const ageLabel = formatAgeLabel(ageMs);
      const schedule = scheduleMap.get(workOrder.id) ?? [];
      const hasScheduleItem = schedule.length > 0;
      const blockedBySchedule = schedule.some((item) => item.status === 'WAITING_PARTS' || item.status === 'WAITING_APPROVAL');
      const blockedByParts = hasPartsShortage(workOrder);
      const columnId = determineColumnId(workOrder, ageDays, blockedByParts, hasScheduleItem, blockedBySchedule);
      const column = map.get(columnId);
      if (!column) return;

      const customerName = customersMap.get(workOrder.customer_id)?.company_name ?? 'Unknown customer';
      const unitName = unitsMap.get(workOrder.unit_id)?.unit_name;
      const reasons = [] as string[];
      if (workOrder.status === 'ESTIMATE') reasons.push('Needs approval');
      if (blockedByParts) reasons.push('Awaiting parts');
      if (blockedBySchedule) reasons.push('Blocked by schedule');
      if (hasScheduleItem) reasons.push('Scheduled');

      const badgePayload = reasons.slice(0, 2).map((label) => ({ label, variant: 'outline' as const }));
      let slaBadge;
      if (columnId === 'waitingApproval' && ageHours > SLA_THRESHOLDS.waitingApprovalHours) {
        slaBadge = { label: 'At Risk', variant: 'secondary' as const };
      } else if (columnId === 'waitingParts' && ageHours > SLA_THRESHOLDS.waitingPartsHours) {
        slaBadge = { label: 'Late', variant: 'destructive' as const };
      } else if (columnId === 'inProgress' && ageDays > SLA_THRESHOLDS.inProgressDays) {
        slaBadge = { label: 'At Risk', variant: 'secondary' as const };
      }

      column.items.push({
        id: workOrder.id,
        title: workOrder.order_number || workOrder.id,
        subtitle: `${customerName}${unitName ? ` · ${unitName}` : ''}`,
        meta: `${Math.max(ageDays, 0)}d ago · ${workOrder.status}`,
        badges: badgePayload,
        ageLabel,
        slaBadge,
        onClick: () => navigate(`/work-orders/${workOrder.id}`),
      });
    });

    return schema;
  }, [
    openWorkOrders,
    customersMap,
    unitsMap,
    scheduleMap,
    navigate,
    hasPartsShortage,
    determineColumnId,
    now,
  ]);

  const pipelineEmptyState = (
    <div className="rounded-lg border border-muted/50 bg-muted/50 p-5 text-sm text-muted-foreground">
      No open work orders. Create one to populate the pipeline.
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => navigate('/work-orders/new')}>Create Work Order</Button>
        <Button variant="outline" onClick={() => navigate('/sales-orders/new')}>
          Create Sales Order
        </Button>
      </div>
    </div>
  );

  const alertGroups = useMemo(() => {
    const groups: (DashboardAlertGroup & { id: string })[] = [
      {
        id: 'waitingParts',
        title: 'Waiting on Parts',
        count: waitingPartsWorkOrders.length,
        description: 'Work orders blocked by shortages',
        items: waitingPartsWorkOrders.slice(0, 3).map((wo) => ({
          label: `${wo.order_number || wo.id}`,
          detail: customersMap.get(wo.customer_id)?.company_name ?? 'Customer unknown',
        })),
        viewLabel: 'View work orders',
        onView: () => navigate('/work-orders?filter=waiting-parts'),
      },
      {
        id: 'waitingApproval',
        title: 'Waiting on Approval',
        count: waitingApprovalWorkOrders.length,
        description: 'Estimates awaiting sign-off',
        items: waitingApprovalWorkOrders.slice(0, 3).map((wo) => ({
          label: `${wo.order_number || wo.id}`,
          detail: customersMap.get(wo.customer_id)?.company_name ?? 'Customer unknown',
        })),
        viewLabel: 'Review approvals',
        onView: () => navigate('/work-orders?filter=waiting-approval'),
      },
      {
        id: 'negativeInventory',
        title: 'Negative QOH Parts',
        count: negativeInventoryParts.length,
        description: 'Parts below zero stock',
        items: negativeInventoryParts.slice(0, 3).map((part) => ({
          label: part.part_number,
          detail: `${part.quantity_on_hand} on hand`,
        })),
        viewLabel: 'View inventory',
        onView: () => navigate('/inventory?filter=negative'),
      },
    ];

    if (openPurchaseOrders.length > 0) {
      groups.push({
        id: 'openPurchaseOrders',
        title: 'Open Purchase Orders',
        count: openPurchaseOrders.length,
        description: 'Receiving and approvals pending',
        items: openPurchaseOrders.slice(0, 3).map((po) => ({
          label: po.po_number || po.id,
          detail: po.vendor?.vendor_name ?? 'Vendor unknown',
        })),
        viewLabel: 'View purchase orders',
        onView: () => navigate('/purchase-orders?status=open'),
      });
    }

    const order = activeView.alertOrder ?? [];
    const filtered =
      activeView.id === 'parts'
        ? groups.filter((g) => ['waitingParts', 'negativeInventory', 'openPurchaseOrders'].includes(g.id))
        : activeView.id === 'technician'
          ? groups.filter((g) => ['waitingParts', 'waitingApproval'].includes(g.id))
          : groups;

    return filtered.sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      const valueA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
      const valueB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
      return valueA - valueB;
    });
  }, [
    activeView.alertOrder,
    waitingPartsWorkOrders,
    waitingApprovalWorkOrders,
    negativeInventoryParts,
    openPurchaseOrders,
    navigate,
    customersMap,
  ]);

  const techSnapshot = useMemo(() => {
    if (technicians.length === 0) return null;
    const clockedInCount = new Set(
      timeEntries.filter((entry) => !entry.clock_out).map((entry) => entry.technician_id)
    ).size;
    return {
      total: technicians.length,
      clockedIn: clockedInCount,
    };
  }, [technicians, timeEntries]);

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Command Center"
        subtitle={settings?.shop_name}
        description={
          <span className="text-xs text-muted-foreground">
            Updated {secondsSinceUpdate}s ago · {new Date(lastUpdatedAt).toLocaleTimeString()}
          </span>
        }
        actions={
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="font-semibold">Custom View</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {activeView.label}
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {DASHBOARD_VIEWS.map((view) => (
                    <DropdownMenuItem
                      key={view.id}
                      onSelect={() => setSelectedViewId(view.id)}
                      className="flex flex-col gap-0.5"
                    >
                      <span className="font-medium">{view.label}</span>
                      <span className="text-xs text-muted-foreground">{view.description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1"
              >
                <RotateCw className="w-4 h-4" />
                Refresh
              </Button>
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(action.route)}
                  disabled={!permissions[action.permission as keyof typeof permissions]}
                  className="flex items-center gap-1"
                >
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
              <Input
                value={globalSearchQuery}
                onChange={(event) => {
                  setGlobalSearchQuery(event.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGlobalSearchSubmit();
                }}
                placeholder="Global search"
                className="min-w-[220px]"
                aria-label="Global search"
                ref={searchInputRef}
              />
              <Button size="sm" variant="outline" onClick={handleGlobalSearchSubmit}>
                <Search className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="flex items-center gap-1"
              >
                <CommandIcon className="w-4 h-4" />
                <span className="text-[11px]">{quickButtonLabel}</span>
              </Button>
              </div>
              {globalSearchQuery && globalSearchResults && (
                <Card className="max-h-80 overflow-auto border border-muted/70">
                  {isGlobalSearching ? (
                    <div className="p-3 text-sm text-muted-foreground">Searching…</div>
                  ) : (
                    <div className="divide-y divide-border/70 text-sm">
                      {(['customers', 'units', 'workOrders', 'parts'] as const).map((section) => {
                        const sectionLabel =
                          section === 'customers'
                            ? 'Customers'
                            : section === 'units'
                              ? 'Units'
                              : section === 'workOrders'
                                ? 'Work Orders'
                                : 'Parts';
                        const items = globalSearchResults[section];
                        return (
                          <div key={section} className="p-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">{sectionLabel}</p>
                            {items.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No {sectionLabel.toLowerCase()} found.</p>
                            ) : (
                              <div className="space-y-1">
                                {items.map((item) => (
                                  <Button
                                    key={item.id}
                                    variant="ghost"
                                    className="w-full justify-start px-2 py-1.5"
                                    onClick={() => navigate(item.route)}
                                  >
                                    <div className="flex flex-col items-start">
                                      <span className="font-medium text-sm">{item.label}</span>
                                      {item.detail && (
                                        <span className="text-xs text-muted-foreground">{item.detail}</span>
                                      )}
                                    </div>
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {globalSearchResults.customers.length === 0 &&
                        globalSearchResults.units.length === 0 &&
                        globalSearchResults.workOrders.length === 0 &&
                        globalSearchResults.parts.length === 0 && (
                          <div className="p-3 text-sm text-muted-foreground">
                            No results found for “{globalSearchQuery}”.
                          </div>
                        )}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        }
      />

      {activeView.sections.showFocus && (
        <Card className="border border-muted/70">
          <CardHeader className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">
                {activeView.id === 'service-writer' ? 'My Work Queue' : "Today's Focus"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{activeView.description}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              Priority
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayFocusActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No prioritized work right now.</p>
            ) : activeView.id === 'service-writer' ? (
              <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Card className="flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base font-semibold">Approvals Needed</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {waitingApprovalWorkOrders.length}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">Estimates pending sign off</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      Review and approve estimates to keep work moving.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/work-orders?filter=waiting-approval')}
                    >
                      View
                    </Button>
                  </CardContent>
                </Card>

                <Card className="flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base font-semibold">Blocked Work Orders</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {blockedCount}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">Work stalled for action</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      Clear blockers to keep the schedule flowing.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/work-orders?filter=blocked')}
                    >
                      View
                    </Button>
                  </CardContent>
                </Card>

                <Card className="flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base font-semibold">Waiting on Parts</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {waitingPartsWorkOrders.length}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">Parts shortages blocking progress</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      Follow up on orders to reduce downtime.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/work-orders?filter=waiting-parts')}
                    >
                      View
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : activeView.id === 'manager' || activeView.id === 'parts' ? (
              <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {todayFocusActions.slice(0, 3).map((action) => (
                  <Card key={action.key} className="flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base font-semibold">{action.label}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {action.count}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">{action.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        {activeView.id === 'parts' && action.key === 'waitingParts'
                          ? 'Check parts shortages blocking work.'
                          : activeView.id === 'parts' && action.key === 'blocked'
                            ? 'Clear blockers to keep orders moving.'
                            : activeView.id === 'parts' && action.key === 'waitingApproval'
                              ? 'Follow up on approvals tied to parts.'
                              : action.description}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(action.route)}>
                        View
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              todayFocusActions.map((action) => (
                <div key={action.key} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border/70 p-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-lg font-semibold">{action.count}</span>
                    <Button size="sm" variant="outline" onClick={() => navigate(action.route)}>
                      View
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {isHydrating ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpiCards.map((card) => (
            <DashboardKpiCard
              key={card.title}
              title={card.title}
              value={card.value}
              meta={card.meta}
              description={card.description}
              icon={card.icon}
              tone={card.tone}
              onClick={card.onClick}
            />
          ))}
        </div>
      )}

      {aiAssistEnabled && (
        <Card className="border border-muted/70">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold">AI Insights (Preview)</CardTitle>
            <p className="text-xs text-muted-foreground">This is a demo. No external AI calls.</p>
          </CardHeader>
          <CardContent>
            {aiInsights.length === 0 ? (
              <p className="text-sm text-muted-foreground">Connect data feeds to enable insights.</p>
            ) : (
              <ul className="space-y-2 list-disc list-inside text-sm">
                {aiInsights.map((insight, idx) => (
                  <li key={idx}>{insight}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between space-x-2">
          <div>
            <CardTitle className="text-base font-semibold">Work Order Pipeline</CardTitle>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Open only</p>
          </div>
          <Badge variant="outline" className="text-xs">
            Kanban view
          </Badge>
        </CardHeader>
        <CardContent>
          <DashboardKanban columns={pipelineColumns} loading={isHydrating} emptyState={pipelineEmptyState} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {activeView.sections.showAlertsRail && (
          <Card className="border border-muted/70">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <DashboardAlertsRail groups={alertGroups} loading={isHydrating} />
            </CardContent>
          </Card>
        )}
        {activeView.sections.showTechSnapshot && (
          <>
            {techSnapshot ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Technician Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Total technicians</p>
                    <p className="text-2xl font-semibold">{techSnapshot.total}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Clocked in now</p>
                    <p className="text-xl font-medium">{techSnapshot.clockedIn}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Technician Snapshot</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Technician/time data will show once time entries or staff profiles are available.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
      <Dialog open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Command Palette</DialogTitle>
            <DialogDescription>{isMac ? '⌘K' : 'Ctrl+K'} opens quick actions.</DialogDescription>
          </DialogHeader>
          <Command>
            <CommandInput
              placeholder="Search or trigger an action"
              autoFocus
              value={commandQuery}
              onValueChange={setCommandQuery}
            />
            <CommandList>
              <CommandEmpty>Type to search quick actions.</CommandEmpty>
              <CommandGroup>
                {filteredCommands.map((item) => (
                  <CommandItem
                    key={item.label}
                    onSelect={() => {
                      item.action();
                      setIsCommandPaletteOpen(false);
                    }}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
