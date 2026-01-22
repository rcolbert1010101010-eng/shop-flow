import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QuickAddDialog } from '@/components/ui/quick-add-dialog';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useRepos } from '@/repos';
import { useToast } from '@/hooks/use-toast';
import type { LucideIcon } from 'lucide-react';
import { Save, X, Trash2, Edit, Wrench, ShoppingCart, Clock3, Timer, CalendarPlus } from 'lucide-react';
import { PMSection } from '@/components/pm/PMSection';
import { UnitImagesSection } from '@/components/units/UnitImagesSection';
import { useShopStore } from '@/stores/shopStore';
import { SmartSearchSelect } from '@/components/common/SmartSearchSelect';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileActionBar, MobileActionBarSpacer } from '@/components/common/MobileActionBar';
import type { UnitType } from '@/integrations/supabase/units';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};
const BROWSE_CUSTOMERS_PAGE_SIZE = 25;

export default function UnitForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const repos = useRepos();
  const {
    units,
    addUnit,
    updateUnit,
    deactivateUnit,
    listUnitTypes,
    createUnitType,
    ensureUnitTypesSeeded,
  } = repos.units;
  const { customers } = repos.customers;
  const { workOrders, createWorkOrder } = repos.workOrders;
  const { salesOrders, createSalesOrder } = repos.salesOrders;
  const schedulingRepo = repos.scheduling;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const pmSchedules = useShopStore((s) => s.pmSchedules);
  const pmHistory = useShopStore((s) => s.pmHistory);
  const unknownValue = '—';

  const isNew = id === 'new';
  const unit = !isNew ? units.find((u) => u.id === id) : null;
  const unitTypeId = (unit as { unit_type_id?: string | null } | null)?.unit_type_id ?? '';
  const preselectedCustomer = searchParams.get('customer');

  const [editing, setEditing] = useState(isNew);
  const [formData, setFormData] = useState({
    customer_id: unit?.customer_id || preselectedCustomer || '',
    unit_type_id: unitTypeId,
    unit_name: unit?.unit_name || '',
    vin: unit?.vin || '',
    year: unit?.year?.toString() || '',
    make: unit?.make || '',
    model: unit?.model || '',
    mileage: unit?.mileage?.toString() || '',
    hours: unit?.hours?.toString() || '',
    notes: unit?.notes || '',
  });
  const [isBrowseCustomersOpen, setIsBrowseCustomersOpen] = useState(false);
  const [browseCustomersActiveOnly, setBrowseCustomersActiveOnly] = useState(true);
  const [browseCustomersPage, setBrowseCustomersPage] = useState(0);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [unitTypeDialogOpen, setUnitTypeDialogOpen] = useState(false);
  const [newUnitTypeName, setNewUnitTypeName] = useState('');

  const activeCustomers = useMemo(
    () => customers.filter((c) => c.is_active && c.id !== 'walkin'),
    [customers]
  );
  const customerPickerItems = useMemo(
    () =>
      activeCustomers.map((c) => {
        const company = (c as any).company_name ?? '';
        const contact = (c as any).contact_name ?? '';
        const phone = (c as any).phone ?? '';
        const email = (c as any).email ?? '';
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
  const browseableCustomers = useMemo(
    () =>
      customers.filter((c) => {
        if (browseCustomersActiveOnly && c.is_active === false) return false;
        if ((c as any).is_walk_in) return false;
        return true;
      }),
    [customers, browseCustomersActiveOnly]
  );
  const totalBrowseCustomerPages = Math.max(1, Math.ceil(browseableCustomers.length / BROWSE_CUSTOMERS_PAGE_SIZE));
  const safeBrowseCustomersPage = Math.min(browseCustomersPage, totalBrowseCustomerPages - 1);
  const browseCustomersStart = safeBrowseCustomersPage * BROWSE_CUSTOMERS_PAGE_SIZE;
  const browseCustomersEnd = browseCustomersStart + BROWSE_CUSTOMERS_PAGE_SIZE;
  const pagedBrowseCustomers = browseableCustomers.slice(browseCustomersStart, browseCustomersEnd);
  const pmSchedulesForUnit = useMemo(
    () => (unit ? pmSchedules?.filter((s) => s.unit_id === unit.id && s.is_active !== false) || [] : []),
    [pmSchedules, unit]
  );
  useEffect(() => {
    setBrowseCustomersPage(0);
  }, [browseCustomersActiveOnly]);
  const pmHistoryForUnit = useMemo(
    () => (unit ? pmHistory?.filter((h) => h.unit_id === unit.id) || [] : []),
    [pmHistory, unit]
  );
  const getDefaultUnitTypeId = (types: UnitType[]) => {
    const activeTypes = types.filter((type) => type.is_active !== false);
    if (activeTypes.length === 0) return '';
    const truckMatch = activeTypes.find((type) => type.name.trim().toLowerCase() === 'truck');
    return truckMatch?.id ?? activeTypes[0].id;
  };
  useEffect(() => {
    let isActive = true;
    const loadTypes = async () => {
      try {
        await ensureUnitTypesSeeded();
        const list = await listUnitTypes({ includeInactive: true });
        if (isActive) {
          setUnitTypes(list);
          const defaultId = getDefaultUnitTypeId(list);
          if (defaultId) {
            setFormData((prev) =>
              prev.unit_type_id
                ? prev
                : {
                    ...prev,
                    unit_type_id: defaultId,
                  }
            );
          }
        }
      } catch (error: any) {
        if (isActive) {
          toast({
            title: 'Unable to load unit types',
            description: error?.message ?? 'Please try again',
            variant: 'destructive',
          });
        }
      }
    };
    void loadTypes();
    return () => {
      isActive = false;
    };
  }, [ensureUnitTypesSeeded, listUnitTypes, toast]);

  const unitTypesForTenant = useMemo(() => unitTypes, [unitTypes]);
  const selectableUnitTypes = useMemo(() => {
    const active = unitTypesForTenant.filter((type) => type.is_active !== false);
    const selected = unitTypesForTenant.find((type) => type.id === formData.unit_type_id);
    if (selected && selected.is_active === false) {
      return [selected, ...active.filter((type) => type.id !== selected.id)];
    }
    return active;
  }, [formData.unit_type_id, unitTypesForTenant]);
  const unitTypeLabel = useMemo(() => {
    if (!unitTypeId) return unknownValue;
    return unitTypesForTenant.find((type) => type.id === unitTypeId)?.name || unknownValue;
  }, [unitTypeId, unitTypesForTenant, unknownValue]);

  const pmStatusCounts = useMemo(() => {
    const counts = { overdue: 0, dueSoon: 0, ok: 0, notConfigured: 0 };
    if (!unit) return counts;

    pmSchedulesForUnit.forEach((schedule) => {
      const { interval_type, interval_value, last_completed_date, last_completed_meter } = schedule;

      if (interval_type === 'DAYS') {
        if (!last_completed_date) {
          counts.notConfigured++;
          return;
        }
        const lastDate = new Date(last_completed_date);
        const nextDue = lastDate.getTime() + interval_value * 24 * 60 * 60 * 1000;
        const daysRemaining = Math.floor((nextDue - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysRemaining < 0) counts.overdue++;
        else if (daysRemaining <= 14) counts.dueSoon++;
        else counts.ok++;
        return;
      }

      const unitMeter =
        interval_type === 'MILES'
          ? unit.mileage != null
            ? Number(unit.mileage)
            : null
          : unit.hours != null
          ? Number(unit.hours)
          : null;
      if (unitMeter == null || last_completed_meter == null) {
        counts.notConfigured++;
        return;
      }
      const remaining = last_completed_meter + interval_value - unitMeter;
      if (remaining < 0) counts.overdue++;
      else if (remaining <= 500) counts.dueSoon++;
      else counts.ok++;
    });

    return counts;
  }, [pmSchedulesForUnit, unit]);

  const overduePmCount = pmSchedulesForUnit.length === 0 ? null : pmStatusCounts.overdue;
  const dueSoonPmCount = pmSchedulesForUnit.length === 0 ? 0 : pmStatusCounts.dueSoon;

  const isDuplicateUnitTypeName = (name: string, excludeId?: string) =>
    unitTypesForTenant.some(
      (type) =>
        type.id !== excludeId && type.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const handleCreateUnitType = async () => {
    const trimmedName = newUnitTypeName.trim();
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
      const created = await createUnitType(trimmedName);
      const updatedList = await listUnitTypes({ includeInactive: true });
      setUnitTypes(updatedList);
      setFormData((prev) => ({ ...prev, unit_type_id: created.id }));
      setNewUnitTypeName('');
      setUnitTypeDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Unable to add unit type',
        description: error?.message ?? 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleSave = () => {
    const trimmedName = formData.unit_name.trim();
    const trimmedVin = formData.vin.trim();

    if (!formData.customer_id) {
      toast({
        title: 'Validation Error',
        description: 'Customer is required',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.unit_type_id) {
      toast({
        title: 'Validation Error',
        description: 'Unit type is required',
        variant: 'destructive',
      });
      return;
    }

    if (!trimmedName) {
      toast({
        title: 'Validation Error',
        description: 'Unit name is required',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate VIN
    if (trimmedVin) {
      const vinExists = units.some(
        (u) => u.id !== id && u.vin?.toLowerCase() === trimmedVin.toLowerCase()
      );
      if (vinExists) {
        toast({
          title: 'Validation Error',
          description: 'A unit with this VIN already exists',
          variant: 'destructive',
        });
        return;
      }
    }

    // Check for duplicate unit name per customer
    const nameExists = units.some(
      (u) =>
        u.id !== id &&
        u.customer_id === formData.customer_id &&
        u.unit_name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (nameExists) {
      toast({
        title: 'Validation Error',
        description: 'This customer already has a unit with this name',
        variant: 'destructive',
      });
      return;
    }

    const unitData = {
      customer_id: formData.customer_id,
      unit_type_id: formData.unit_type_id,
      unit_name: trimmedName,
      vin: trimmedVin || null,
      year: formData.year ? parseInt(formData.year) : null,
      make: formData.make.trim() || null,
      model: formData.model.trim() || null,
      mileage: formData.mileage ? parseInt(formData.mileage) : null,
      hours: formData.hours ? parseInt(formData.hours) : null,
      notes: formData.notes.trim() || null,
    };

    if (isNew) {
      const newUnit = addUnit(unitData as typeof unitData & { unit_type_id: string });
      toast({
        title: 'Unit Created',
        description: `${formData.unit_name} has been added`,
      });
      navigate(`/units/${newUnit.id}`);
    } else {
      updateUnit(id!, unitData as typeof unitData & { unit_type_id: string });
      toast({
        title: 'Unit Updated',
        description: 'Changes have been saved',
      });
      setEditing(false);
    }
  };

  const handleDeactivate = () => {
    deactivateUnit(id!);
    toast({
      title: 'Unit Deactivated',
      description: 'Unit has been deactivated',
    });
    navigate('/units');
  };

  const resetForm = () => {
    if (!unit) return;
    const fallbackUnitTypeId = getDefaultUnitTypeId(unitTypesForTenant);
    setFormData({
      customer_id: unit.customer_id || '',
      unit_type_id: unitTypeId || fallbackUnitTypeId,
      unit_name: unit.unit_name || '',
      vin: unit.vin || '',
      year: unit.year?.toString() || '',
      make: unit.make || '',
      model: unit.model || '',
      mileage: unit.mileage?.toString() || '',
      hours: unit.hours?.toString() || '',
      notes: unit.notes || '',
    });
  };

  const handleCancelEdit = () => {
    resetForm();
    setEditing(false);
  };

  const handleCreateWorkOrderPrimary = () => {
    if (!unit) return;
    const created = createWorkOrder(unit.customer_id, unit.id);
    navigate(`/work-orders/${created.id}`);
  };

  const handleCreateAndScheduleWorkOrder = () => {
    if (!unit) return;
    const created = createWorkOrder(unit.customer_id, unit.id);
    navigate(`/work-orders/${created.id}?openScheduling=1`);
  };

  const handleCreateSalesOrder = () => {
    if (!unit) return;
    const created = createSalesOrder(unit.customer_id, unit.id);
    navigate(`/sales-orders/${created.id}`);
  };

  const openWoStatuses = useMemo(
    () => new Set(['OPEN', 'IN_PROGRESS', 'SCHEDULED', 'ESTIMATE', 'HOLD']),
    []
  );
  const openSoStatuses = useMemo(
    () => new Set(['OPEN', 'APPROVED', 'ESTIMATE', 'QUOTE', 'PARTIAL']),
    []
  );

  const relatedWorkOrders = useMemo(() => {
    if (!unit) return [];
    const list = workOrders ?? [];
    return list
      .filter((wo) => wo.unit_id === unit.id)
      .sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0).getTime() -
          new Date(a.updated_at || a.created_at || 0).getTime()
      );
  }, [unit, workOrders]);

  const relatedSalesOrders = useMemo(() => {
    if (!unit) return [];
    const list = salesOrders ?? [];
    return list
      .filter((so) => so.unit_id === unit.id)
      .sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0).getTime() -
          new Date(a.updated_at || a.created_at || 0).getTime()
      );
  }, [unit, salesOrders]);

  const activitySummary = useMemo(() => {
    if (!unit) return null;
    const openWOs = relatedWorkOrders.filter((wo) => openWoStatuses.has(wo.status as string)).length;
    const openSOs = relatedSalesOrders.filter((so) => openSoStatuses.has(so.status as string)).length;
    const lastDates: string[] = [];
    relatedWorkOrders.forEach((wo) => {
      if (wo.updated_at || wo.created_at) lastDates.push((wo.updated_at || wo.created_at) as string);
    });
    relatedSalesOrders.forEach((so) => {
      if (so.updated_at || so.created_at) lastDates.push((so.updated_at || so.created_at) as string);
    });
    const lastActivity = lastDates.length
      ? lastDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;
    return { openWOs, openSOs, lastActivity };
  }, [relatedWorkOrders, relatedSalesOrders, unit, openWoStatuses, openSoStatuses]);

  const openRelatedWOs = useMemo(
    () => relatedWorkOrders.filter((wo) => openWoStatuses.has(wo.status as string)),
    [relatedWorkOrders, openWoStatuses]
  );
  const hotWorkOrder = useMemo(() => {
    if (openRelatedWOs.length === 0) return null;
    return [...openRelatedWOs].sort((a, b) => {
      const aPriority = typeof (a as { priority?: number }).priority === 'number' ? (a as any).priority : 0;
      const bPriority = typeof (b as { priority?: number }).priority === 'number' ? (b as any).priority : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
      const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
      return bDate - aDate;
    })[0];
  }, [openRelatedWOs]);

  const lastServiceDate = useMemo(() => {
    const closedStatuses = new Set(['COMPLETED', 'CLOSED', 'INVOICED']);
    const dates: string[] = [];
    relatedWorkOrders.forEach((wo) => {
      if (closedStatuses.has(wo.status as string) && (wo.updated_at || wo.created_at)) {
        dates.push((wo.updated_at || wo.created_at) as string);
      }
    });
    relatedSalesOrders.forEach((so) => {
      if (closedStatuses.has(so.status as string) && (so.updated_at || so.created_at)) {
        dates.push((so.updated_at || so.created_at) as string);
      }
    });
    if (dates.length === 0 && activitySummary?.lastActivity) return activitySummary.lastActivity;
    return dates.length
      ? dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;
  }, [activitySummary?.lastActivity, relatedSalesOrders, relatedWorkOrders]);

  const daysSinceLastService = useMemo(() => {
    if (!lastServiceDate) return null;
    const diff = Date.now() - new Date(lastServiceDate).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }, [lastServiceDate]);

  const formattedYmm = useMemo(() => {
    if (!unit) return '';
    const parts = [unit.year, unit.make, unit.model].filter(Boolean);
    return parts.join(' • ');
  }, [unit]);

  const formattedMileage = useMemo(() => {
    if (!unit || unit.mileage == null) return '';
    return `${Number(unit.mileage).toLocaleString()} mi`;
  }, [unit]);

  const formattedHours = useMemo(() => {
    if (!unit || unit.hours == null) return '';
    return `${Number(unit.hours).toLocaleString()} hrs`;
  }, [unit]);

  const unitHealth = useMemo(() => {
    if (!unit) return null;
    const hasOverdue = (overduePmCount ?? 0) > 0;
    const hasOpenWork = (activitySummary?.openWOs ?? 0) > 0 || !!hotWorkOrder;
    const hasDueSoon = dueSoonPmCount > 0;
    const hasOpenSales = (activitySummary?.openSOs ?? 0) > 0;

    if (hasOverdue || hasOpenWork) {
      return { label: 'At Risk', tone: 'destructive' as const };
    }
    if (hasDueSoon || hasOpenSales) {
      return { label: 'Attention', tone: 'warning' as const };
    }
    return { label: 'Healthy', tone: 'success' as const };
  }, [activitySummary?.openSOs, activitySummary?.openWOs, dueSoonPmCount, hotWorkOrder, overduePmCount, unit]);

  const customerName = useMemo(
    () =>
      unit
        ? customers.find((c) => c.id === unit.customer_id)?.company_name || unknownValue
        : unknownValue,
    [customers, unit]
  );

  const statCards: {
    title: string;
    value: string | number;
    icon: LucideIcon;
    variant?: 'default' | 'warning' | 'success' | 'accent';
    valueClassName?: string;
  }[] =
    !unit || !activitySummary
      ? []
      : [
          {
            title: 'Open Work Orders',
            value: activitySummary.openWOs,
            icon: Wrench,
            variant: activitySummary.openWOs > 0 ? 'warning' : 'default',
          },
          {
            title: 'Open Sales Orders',
            value: activitySummary.openSOs,
            icon: ShoppingCart,
            variant: activitySummary.openSOs > 0 ? 'accent' : 'default',
          },
          {
            title: 'Last Activity',
            value: activitySummary.lastActivity
              ? new Date(activitySummary.lastActivity).toLocaleString()
              : unknownValue,
            icon: Clock3,
            variant: 'default',
            valueClassName: 'text-2xl',
          },
          {
            title: 'Days Since Last Service',
            value: daysSinceLastService != null ? daysSinceLastService : unknownValue,
            icon: Timer,
            variant: daysSinceLastService != null && daysSinceLastService > 45 ? 'warning' : 'default',
          },
        ];

  const [openWorkOrdersOnly, setOpenWorkOrdersOnly] = useState(true);
  const [openSalesOrdersOnly, setOpenSalesOrdersOnly] = useState(true);

  const filteredWorkOrders = useMemo(
    () =>
      openWorkOrdersOnly
        ? relatedWorkOrders.filter((wo) => openWoStatuses.has(wo.status as string))
        : relatedWorkOrders,
    [openWorkOrdersOnly, relatedWorkOrders, openWoStatuses]
  );

  const filteredSalesOrders = useMemo(
    () =>
      openSalesOrdersOnly
        ? relatedSalesOrders.filter((so) => openSoStatuses.has(so.status as string))
        : relatedSalesOrders,
    [openSalesOrdersOnly, relatedSalesOrders, openSoStatuses]
  );

  const timelineEvents = useMemo(() => {
    const events: {
      id: string;
      type: 'WO' | 'SO' | 'PM';
      title: string;
      subtitle?: string;
      timestamp: string;
      onClick?: () => void;
    }[] = [];

    relatedWorkOrders.forEach((wo) => {
      const ts = (wo.updated_at || wo.created_at) as string | undefined;
      if (!ts) return;
      events.push({
        id: wo.id,
        type: 'WO',
        title: `Work Order ${wo.order_number || wo.id} ${wo.status}`,
        subtitle: unit?.unit_name,
        timestamp: ts,
        onClick: () => navigate(`/work-orders/${wo.id}`),
      });
    });

    relatedSalesOrders.forEach((so) => {
      const ts = (so.updated_at || so.created_at) as string | undefined;
      if (!ts) return;
      events.push({
        id: so.id,
        type: 'SO',
        title: `Sales Order ${so.order_number || so.id} ${so.status}`,
        subtitle: unit?.unit_name,
        timestamp: ts,
        onClick: () => navigate(`/sales-orders/${so.id}`),
      });
    });

    // PM history if available
    pmHistoryForUnit.forEach((h) => {
      const ts = (h as any).completed_at || (h as any).completed_date || h.created_at;
      if (!ts) return;
      const scheduleName = (h as any).schedule_name;
      events.push({
        id: h.id,
        type: 'PM',
        title: `PM Completed${scheduleName ? `: ${scheduleName}` : ''}`,
        subtitle: unit?.unit_name,
        timestamp: ts,
      });
    });

    return events
      .filter((e) => e.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);
  }, [navigate, pmHistoryForUnit, relatedSalesOrders, relatedWorkOrders, unit]);

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-3 flex-wrap">
            <span>{isNew ? 'New Unit' : unit?.unit_name || 'Unit'}</span>
            {!isNew && unitHealth && (
              <Badge
                variant={
                  unitHealth.tone === 'destructive'
                    ? 'destructive'
                    : unitHealth.tone === 'success'
                    ? 'secondary'
                    : 'outline'
                }
                className={
                  unitHealth.tone === 'warning'
                    ? 'border-amber-500 text-amber-700 bg-amber-50'
                    : unitHealth.tone === 'success'
                    ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                    : undefined
                }
              >
                {unitHealth.label}
              </Badge>
            )}
          </div>
        }
        subtitle={isNew ? 'Add a new unit' : unit?.is_active ? 'Active Unit' : 'Inactive Unit'}
        backTo="/units"
        description={
          !isNew && unit ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {unit.vin && (
                <span className="flex items-center gap-1 truncate max-w-xs">
                  <span className="font-medium">VIN</span>
                  <span className="font-mono truncate">{unit.vin}</span>
                </span>
              )}
              {formattedYmm && <span className="truncate">{formattedYmm}</span>}
              {formattedMileage && <span>{formattedMileage}</span>}
              {formattedHours && <span>{formattedHours}</span>}
            </div>
          ) : undefined
        }
        actions={
          editing ? (
            <>
              {!isNew && (
                <Button variant="outline" onClick={handleCancelEdit}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                {isNew ? 'Create Unit' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setEditing(true);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              {unit?.is_active && (
                <Button variant="destructive" onClick={handleDeactivate}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Deactivate
                </Button>
              )}
            </>
          )
        }
      />

      {!isNew && unit && activitySummary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <StatCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                variant={card.variant}
                valueClassName={card.valueClassName}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleCreateWorkOrderPrimary} className="shadow-sm">
              <Wrench className="w-4 h-4 mr-2" />
              Create Work Order
            </Button>
            <Button variant="outline" onClick={handleCreateAndScheduleWorkOrder}>
              <CalendarPlus className="w-4 h-4 mr-2" />
              Create & Schedule Work Order
            </Button>
            <Button variant="outline" onClick={handleCreateSalesOrder}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Create Sales Order
            </Button>
          </div>

          {hotWorkOrder && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="text-foreground">Hot Work Order</span>
              <Button
                variant="link"
                className="px-0 h-auto text-base font-semibold"
                onClick={() => navigate(`/work-orders/${hotWorkOrder.id}`)}
              >
                {hotWorkOrder.order_number || hotWorkOrder.id}
              </Button>
              <StatusBadge status={hotWorkOrder.status} />
            </div>
          )}
        </>
      )}

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Unit Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {editing ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Customer *</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <SmartSearchSelect
                      className="flex-1 min-w-0 w-full sm:w-auto"
                      value={formData.customer_id || null}
                      onChange={(id) => {
                        const next = id ?? '';
                        setFormData({ ...formData, customer_id: next });
                      }}
                      items={customerPickerItems}
                      placeholder="Search customers by name, phone, email, or address..."
                      minChars={2}
                      limit={25}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-shrink-0 w-full sm:w-auto"
                      onClick={() => setIsBrowseCustomersOpen(true)}
                    >
                      Browse customers
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_name">Unit Name *</Label>
                  <Input
                    id="unit_name"
                    value={formData.unit_name}
                    onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
                    placeholder="e.g., Truck #101"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="unit_type_id">Unit Type *</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={formData.unit_type_id}
                      onValueChange={(value) => setFormData({ ...formData, unit_type_id: value })}
                    >
                      <SelectTrigger id="unit_type_id">
                        <SelectValue placeholder="Select unit type" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableUnitTypes.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            No unit types available
                          </SelectItem>
                        ) : (
                          selectableUnitTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                              {type.is_active === false ? ' (Inactive)' : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-shrink-0"
                      onClick={() => setUnitTypeDialogOpen(true)}
                    >
                      Quick Add
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vin">VIN</Label>
                  <Input
                    id="vin"
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                    placeholder="Vehicle Identification Number"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    placeholder="e.g., Peterbilt"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g., 389"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mileage">Mileage</Label>
                  <Input
                    id="mileage"
                    type="number"
                    value={formData.mileage}
                    onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                    placeholder="Enter mileage"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours">Engine Hours</Label>
                  <Input
                    id="hours"
                    type="number"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    placeholder="Enter hours"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes about this unit"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</p>
                  <p className="text-base font-semibold">{customerName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit Name</p>
                  <p className="text-base font-semibold">{unit?.unit_name || unknownValue}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit Type</p>
                  <p className="text-base font-semibold">{unitTypeLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">VIN</p>
                  <p className="font-mono text-sm text-muted-foreground">{unit?.vin || unknownValue}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Year</p>
                  <p className="font-medium">{unit?.year ?? unknownValue}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Make</p>
                  <p className="font-medium">{unit?.make || unknownValue}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Model</p>
                  <p className="font-medium">{unit?.model || unknownValue}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mileage</p>
                  <p className="font-medium">{formattedMileage || unknownValue}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Engine Hours</p>
                  <p className="font-medium">{formattedHours || unknownValue}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</p>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {unit?.notes || 'No notes added.'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PM Section - only show for existing units */}
      {!isNew && unit && (
        <>
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="px-4 pb-4 pt-4 sm:px-6">
                <PMSection unit={unit} />
              </div>
            </CardContent>
          </Card>

          {/* Unit Images Section */}
          <UnitImagesSection unitId={unit.id} />

          <div className="space-y-4">
            {timelineEvents.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {timelineEvents.slice(0, 15).map((event) => {
                    const content = (
                      <div className="flex w-full items-start gap-3">
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary/70" />
                        <div className="flex-1">
                          <p className="font-medium leading-tight">{event.title}</p>
                          {event.subtitle && (
                            <p className="text-xs text-muted-foreground leading-tight">{event.subtitle}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                    );

                    if (event.onClick) {
                      return (
                        <button
                          key={`${event.type}-${event.id}-${event.timestamp}`}
                          onClick={() => event.onClick?.()}
                          className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted/70 transition"
                        >
                          {content}
                        </button>
                      );
                    }

                    return (
                      <div
                        key={`${event.type}-${event.id}-${event.timestamp}`}
                        className="flex w-full items-center gap-3 rounded-lg border px-3 py-2"
                      >
                        {content}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold">Related Work Orders</CardTitle>
                <div className="w-full sm:w-48">
                  <Select
                    value={openWorkOrdersOnly ? 'open' : 'all'}
                    onValueChange={(val) => setOpenWorkOrdersOnly(val === 'open')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter work orders" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open only</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="h-10">
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkOrders.length === 0 ? (
                      <TableRow className="h-16">
                        <TableCell colSpan={4}>
                          <div className="flex flex-col items-center gap-3 py-3 text-sm text-muted-foreground">
                            <span>
                              {openWorkOrdersOnly ? 'No open work orders for this unit.' : 'No work orders for this unit.'}
                            </span>
                            <div className="flex flex-wrap justify-center gap-2">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreateWorkOrderPrimary();
                                }}
                              >
                                Create Work Order
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreateSalesOrder();
                                }}
                              >
                                Create Sales Order
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredWorkOrders.map((wo) => (
                        <TableRow
                          key={wo.id}
                          className="cursor-pointer hover:bg-muted/50 h-12"
                          onClick={() => navigate(`/work-orders/${wo.id}`)}
                        >
                          <TableCell>
                            <StatusBadge status={wo.status} />
                          </TableCell>
                          <TableCell>
                            {wo.updated_at
                              ? new Date(wo.updated_at).toLocaleDateString()
                              : wo.created_at
                              ? new Date(wo.created_at).toLocaleDateString()
                              : unknownValue}
                          </TableCell>
                          <TableCell className="text-right">
                            {typeof wo.total === 'number' ? `$${toNumber(wo.total).toFixed(2)}` : unknownValue}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/work-orders/${wo.id}`);
                                }}
                              >
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const scheduleResult = schedulingRepo?.ensureScheduleItemForWorkOrder
                                    ? schedulingRepo.ensureScheduleItemForWorkOrder(wo.id)
                                    : null;
                                  if (!scheduleResult?.item) {
                                    toast({
                                      title: 'Unable to schedule',
                                      description:
                                        scheduleResult?.reason ||
                                        'Could not create or find a schedule item for this work order.',
                                      variant: 'destructive',
                                    });
                                    return;
                                  }
                                  navigate(
                                    `/scheduling?focusScheduleItemId=${scheduleResult.item.id}&open=1`
                                  );
                                }}
                              >
                                Schedule
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold">Related Sales Orders</CardTitle>
                <div className="w-full sm:w-48">
                  <Select
                    value={openSalesOrdersOnly ? 'open' : 'all'}
                    onValueChange={(val) => setOpenSalesOrdersOnly(val === 'open')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter sales orders" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open only</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="h-10">
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSalesOrders.length === 0 ? (
                      <TableRow className="h-16">
                        <TableCell colSpan={4}>
                          <div className="flex flex-col items-center gap-3 py-3 text-sm text-muted-foreground">
                            <span>
                              {openSalesOrdersOnly ? 'No open sales orders for this unit.' : 'No sales orders for this unit.'}
                            </span>
                            <div className="flex flex-wrap justify-center gap-2">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreateSalesOrder();
                                }}
                              >
                                Create Sales Order
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreateWorkOrderPrimary();
                                }}
                              >
                                Create Work Order
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSalesOrders.map((so) => (
                        <TableRow
                          key={so.id}
                          className="cursor-pointer hover:bg-muted/50 h-12"
                          onClick={() => navigate(`/sales-orders/${so.id}`)}
                        >
                          <TableCell>
                            <StatusBadge status={so.status} />
                          </TableCell>
                          <TableCell>
                            {so.updated_at
                              ? new Date(so.updated_at).toLocaleDateString()
                              : so.created_at
                              ? new Date(so.created_at).toLocaleDateString()
                              : unknownValue}
                          </TableCell>
                          <TableCell className="text-right">
                            {typeof so.total === 'number' ? `$${toNumber(so.total).toFixed(2)}` : unknownValue}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/sales-orders/${so.id}`);
                              }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

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

      <QuickAddDialog
        open={unitTypeDialogOpen}
        onOpenChange={setUnitTypeDialogOpen}
        title="Quick Add Unit Type"
        onSave={handleCreateUnitType}
        onCancel={() => setUnitTypeDialogOpen(false)}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="unit_type_quick_add">Unit Type Name *</Label>
            <Input
              id="unit_type_quick_add"
              value={newUnitTypeName}
              onChange={(e) => setNewUnitTypeName(e.target.value)}
              placeholder="e.g., Truck"
            />
          </div>
        </div>
      </QuickAddDialog>

      <Dialog open={isBrowseCustomersOpen} onOpenChange={setIsBrowseCustomersOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>Browse customers</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground mb-3">
            Viewing customers. Use the active filter and pagination to browse, then select one to attach to this unit.
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
                          setFormData({ ...formData, customer_id: idStr });
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
