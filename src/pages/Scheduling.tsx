import { useMemo, useState, useEffect, useCallback } from 'react';
import { CalendarDays, Clock, User, AlertTriangle, Plus, ChevronLeft, ChevronRight, ClipboardList, Wrench } from 'lucide-react';
import { useRepos } from '@/repos';
import type { ScheduleItem, ScheduleItemStatus, ScheduleBlockType } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { HelpTooltip } from '@/components/help/HelpTooltip';
import { cn } from '@/lib/utils';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

const DAILY_CAPACITY_MINUTES = 480;
const DEFAULT_SHOP_START = '08:00';
const DEFAULT_SHOP_END = '17:00';
const SNAP_MINUTES = 15;
const MAX_BARS_PER_CELL = 3;
const UTIL_WARN = 70;
const UTIL_ALERT = 90;

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};
const formatNumber = (value: number | string | null | undefined, digits = 1) => toNumber(value).toFixed(digits);

type FormState = {
  itemType: 'WORK_ORDER' | 'BLOCK';
  blockType: ScheduleBlockType;
  blockTitle: string;
  workOrderId: string;
  technicianId: string;
  start: string;
  durationHours: number;
  status: ScheduleItemStatus;
  partsReady: boolean;
  priority: number;
  promised: string;
  notes: string;
};

const statusStyles: Record<ScheduleItemStatus, string> = {
  ON_TRACK: 'border bg-muted text-muted-foreground',
  AT_RISK: 'border bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100',
  LATE: 'border bg-destructive/10 text-destructive',
  IN_PROGRESS: 'border bg-accent text-accent-foreground',
  WAITING_APPROVAL: 'border bg-muted text-muted-foreground',
  WAITING_PARTS: 'border bg-muted text-muted-foreground',
  QA: 'border bg-muted text-muted-foreground',
};

const statusLabels: Record<ScheduleItemStatus, string> = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  LATE: 'Late',
  IN_PROGRESS: 'In Progress',
  WAITING_APPROVAL: 'Waiting Approval',
  WAITING_PARTS: 'Waiting Parts',
  QA: 'QA',
};

const toLocalInput = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
};

const getWeekStart = (date: Date) => {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diff);
  return start;
};

const formatShortDate = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const sameDay = (a: string, day: Date) => {
  const d = new Date(a);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
};

const formatTimeRange = (item: ScheduleItem) => {
  const start = new Date(item.start_at);
  const end = new Date(start.getTime() + item.duration_minutes * 60000);
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString([], opts)} – ${end.toLocaleTimeString([], opts)}`;
};

const parseTimeString = (value: string) => {
  const [h, m] = value.split(':');
  const hours = Number(h) || 0;
  const minutes = Number(m) || 0;
  return { hours, minutes };
};

const snapMinutes = (mins: number) => Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES;

const minutesToTime = (baseDay: Date, mins: number) => {
  const start = new Date(baseDay);
  return new Date(start.getTime() + mins * 60000);
};

const formatHourLabel = (hour: number, minutes = 0) => {
  const suffix = hour >= 12 ? 'p' : 'a';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const minutePart = minutes ? `:${String(minutes).padStart(2, '0')}` : '';
  return `${hour12}${minutePart}${suffix}`;
};

const defaultFormState = (): FormState => {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  return {
    itemType: 'WORK_ORDER',
    blockType: 'BREAK',
    blockTitle: '',
    workOrderId: '',
    technicianId: '',
    start: toLocalInput(nextHour),
    durationHours: 2,
    status: 'ON_TRACK',
    partsReady: false,
    priority: 3,
    promised: '',
    notes: '',
  };
};

export default function Scheduling() {
  const navigate = useNavigate();
  const repos = useRepos();
  const schedulingRepo = repos.scheduling;
  const { workOrders } = repos.workOrders;
  const { customers } = repos.customers;
  const { units } = repos.units;
  const { technicians } = repos.technicians;
  const { settings } = repos.settings;
  const { toast } = useToast();

  const scheduleItems = schedulingRepo.list();
  const location = useLocation();
  const [focusedScheduleItemId, setFocusedScheduleItemId] = useState<string | null>(null);
  const [highlightedScheduleItemId, setHighlightedScheduleItemId] = useState<string | null>(null);

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'DAY' | 'WEEK'>('DAY');
  const [dayLayout, setDayLayout] = useState<'LANES' | 'GANTT'>('LANES');
  const [technicianFilter, setTechnicianFilter] = useState<'ALL' | 'UNASSIGNED' | string>('ALL');
  const [weekLayout, setWeekLayout] = useState<'LANES' | 'CALENDAR' | 'GANTT'>('LANES');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [ganttHover, setGanttHover] = useState<{ key: string; minutes: number } | null>(null);

  const { hours: startHour, minutes: startMinute } = parseTimeString((settings as any)?.shop_hours_start ?? DEFAULT_SHOP_START);
  const { hours: endHour, minutes: endMinute } = parseTimeString((settings as any)?.shop_hours_end ?? DEFAULT_SHOP_END);
  const dayStartTotalMinutes = startHour * 60 + startMinute;
  const dayEndTotalMinutes = endHour * 60 + endMinute;
  const dayMinutes = Math.max(60, dayEndTotalMinutes - dayStartTotalMinutes);

  const getUtilizationTone = (percent: number) => {
    if (percent > UTIL_ALERT) return 'text-destructive';
    if (percent >= UTIL_WARN) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  const renderUtilizationBar = (percent: number) => {
    const tone =
      percent > UTIL_ALERT ? 'bg-destructive' : percent >= UTIL_WARN ? 'bg-amber-500' : 'bg-primary';
    return (
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', tone)}
          style={{ width: `${Math.min(percent, 150)}%` }}
        />
      </div>
    );
  };

  const startDate = useMemo(() => {
    const base = new Date(currentDate);
    base.setHours(0, 0, 0, 0);
    return base;
  }, [currentDate]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, idx) => {
    const base = viewMode === 'WEEK' ? getWeekStart(startDate) : startDate;
    const date = new Date(base);
    date.setDate(base.getDate() + idx);
    return date;
  }), [startDate, viewMode]);

  const workOrderMap = useMemo(() => new Map(workOrders.map((wo) => [wo.id, wo])), [workOrders]);
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const technicianMap = useMemo(() => new Map(technicians.map((t) => [t.id, t])), [technicians]);

  const getWorkOrderLabel = (id: string) => {
    const wo = workOrderMap.get(id);
    if (!wo) return `Work Order ${id}`;
    const customer = wo.customer_id ? customerMap.get(wo.customer_id) : null;
    const unit = wo.unit_id ? unitMap.get(wo.unit_id) : null;
    const unitLabel = unit?.unit_name || [unit?.year, unit?.make, unit?.model].filter(Boolean).join(' ');
    return `${wo.order_number} • ${customer?.company_name ?? 'Customer'} ${unitLabel ? `• ${unitLabel}` : ''}`.trim();
  };

  const getTechnicianLabel = (id: string | null) => {
    if (!id) return 'Unassigned';
    return technicianMap.get(id)?.name ?? 'Unknown tech';
  };

  const getBlockLabel = (item: ScheduleItem) => {
    const base =
      item.block_type === 'BREAK'
        ? 'Break'
        : item.block_type === 'PTO'
          ? 'PTO'
          : item.block_type === 'MEETING'
            ? 'Meeting'
            : item.block_type === 'FABRICATION'
              ? 'Fabrication'
              : 'Block';
    const title = item.block_title?.trim();
    return title ? `${base}: ${title}` : base;
  };

  const getItemLabel = (item: ScheduleItem) =>
    item.source_ref_type === 'BLOCK' ? getBlockLabel(item) : getWorkOrderLabel(item.source_ref_id);

  const formatConflict = (conflict: ScheduleItem) => {
    const techName = getTechnicianLabel(conflict.technician_id);
    const woLabel = getItemLabel(conflict);
    const dateLabel = formatShortDate(new Date(conflict.start_at));
    return {
      title: `Overlap for ${techName}`,
      details: `${woLabel} • ${dateLabel} • ${formatTimeRange(conflict)}`,
    };
  };

  const conflictDetailsMap = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    scheduleItems.forEach((item) => {
      map.set(item.id, schedulingRepo.detectConflicts(item));
    });
    return map;
  }, [scheduleItems, schedulingRepo]);

  const weekItems = useMemo(
    () =>
      (viewMode === 'WEEK' ? weekDays : [startDate]).map((day) =>
        scheduleItems
          .filter((item) => sameDay(item.start_at, day))
          .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      ),
    [scheduleItems, startDate, viewMode, weekDays]
  );

  const currentWeekLabel = `${formatShortDate(getWeekStart(startDate))} – ${formatShortDate(
    new Date(new Date(getWeekStart(startDate)).setDate(getWeekStart(startDate).getDate() + 6))
  )}`;
  const currentDayLabel = `${startDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`;
  const weekDayRange = useMemo(() => {
    const base = getWeekStart(startDate);
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(base);
      d.setDate(base.getDate() + idx);
      return d;
    });
  }, [startDate]);

  const techWeekLoads = useMemo(() => {
    const map = new Map<string, number[]>();
    const base = getWeekStart(startDate);
    const baseMidnight = new Date(base);
    baseMidnight.setHours(0, 0, 0, 0);
    scheduleItems.forEach((item) => {
      const start = new Date(item.start_at);
      const startMidnight = new Date(start);
      startMidnight.setHours(0, 0, 0, 0);
      const diffDays = Math.round((startMidnight.getTime() - baseMidnight.getTime()) / 86400000);
      if (diffDays < 0 || diffDays > 6) return;
      const key = item.technician_id ?? 'unassigned';
      const arr = map.get(key) ?? Array(7).fill(0);
      arr[diffDays] += item.duration_minutes;
      map.set(key, arr);
    });
    return map;
  }, [scheduleItems, startDate]);

  const ganttSortComparator = (a: ScheduleItem, b: ScheduleItem) => {
    const conflictsA = conflictDetailsMap.get(a.id)?.length ?? 0;
    const conflictsB = conflictDetailsMap.get(b.id)?.length ?? 0;
    if (conflictsA !== conflictsB) return conflictsB - conflictsA; // more conflicts first
    if (a.source_ref_type !== b.source_ref_type) {
      return a.source_ref_type === 'WORK_ORDER' ? -1 : 1;
    }
    const priorityA = a.priority ?? 3;
    const priorityB = b.priority ?? 3;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
  };

  const ganttTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = 120;
    let current = dayStartTotalMinutes;
    const end = dayEndTotalMinutes;
    while (current <= end) {
      ticks.push(current);
      current += step;
    }
    if (ticks[ticks.length - 1] !== end) {
      ticks.push(end);
    }
    return ticks;
  }, [dayStartTotalMinutes, dayEndTotalMinutes]);

  const getLoadTierClass = (percent: number) => {
    if (percent === 0) return 'bg-muted';
    if (percent < 50) return 'bg-accent/40';
    if (percent < 100) return 'bg-accent';
    return 'bg-destructive';
  };

  const prefillStartForDate = (techId?: string | null) => {
    const start = new Date(startDate);
    start.setHours(startHour, startMinute, 0, 0);
    return {
      start: toLocalInput(start),
      technicianId: techId ?? '',
    };
  };

  const renderGanttRuler = () => (
    <div className="pointer-events-none absolute inset-0 z-0">
      {ganttTicks.map((totalMinutes, idx) => {
        const left = ((totalMinutes - dayStartTotalMinutes) / dayMinutes) * 100;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const isFirst = idx === 0;
        const isLast = idx === ganttTicks.length - 1;
        return (
          <div key={`tick-${totalMinutes}`} className="absolute inset-y-0" style={{ left: `${left}%` }}>
            <div className="absolute inset-y-0 w-px bg-muted-foreground/20" />
            <div
              className={cn(
                'absolute top-0 text-[10px] text-muted-foreground',
                isFirst ? '' : isLast ? '-translate-x-full' : '-translate-x-1/2'
              )}
            >
              {formatHourLabel(hours, minutes)}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderGanttLegend = () => (
    <div className="flex flex-wrap items-center gap-3 rounded border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <span className="h-3 w-3 rounded border border-primary/30 bg-primary/10" />
        <span className="text-foreground">Work Order</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="h-3 w-3 rounded border border-muted-foreground/30 bg-muted" />
        <span className="text-foreground">Block</span>
      </div>
      <div className="flex items-center gap-1">
        <AlertTriangle className="w-3 h-3 text-destructive" />
        <span>Conflict</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="rounded border px-1 text-[10px] text-muted-foreground">+N</span>
        <span>extra items in cell</span>
      </div>
    </div>
  );

  const renderGanttCell = ({
    cellKey,
    dayStart,
    dayDate,
    techId,
    techLabel,
    cellItems,
  }: {
    cellKey: string;
    dayStart: Date;
    dayDate: Date;
    techId: string;
    techLabel: string;
    cellItems: ScheduleItem[];
  }) => {
    const sortedCellItems = [...cellItems].sort(ganttSortComparator);
    const hiddenItems = sortedCellItems.slice(MAX_BARS_PER_CELL);
    const createAtMinutes = (minutes: number) => {
      const startDateObj = minutesToTime(dayStart, minutes);
      handleOpenNew(techId === 'unassigned' ? null : techId);
      setFormState((prev) => ({
        ...prev,
        start: toLocalInput(startDateObj),
        technicianId: techId === 'unassigned' ? '' : techId,
      }));
    };

    return (
      <div
        className="relative h-24 overflow-hidden px-2 py-2"
        role="button"
        tabIndex={0}
        aria-label={`Create schedule item for ${techLabel} on ${dayDate.toLocaleDateString()}`}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percent = Math.max(0, Math.min(1, x / rect.width));
          const mins = snapMinutes(percent * dayMinutes);
          setGanttHover({ key: cellKey, minutes: mins });
        }}
        onMouseLeave={() => setGanttHover(null)}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-gantt-bar="true"]')) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percent = Math.max(0, Math.min(1, x / rect.width));
          const mins = snapMinutes(percent * dayMinutes);
          createAtMinutes(mins);
        }}
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-gantt-ignore="true"]')) return;
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          const minutes = ganttHover?.key === cellKey ? ganttHover.minutes : snapMinutes(dayMinutes / 2);
          createAtMinutes(minutes);
        }}
      >
        <div className="absolute inset-0 rounded bg-muted/30 z-0" />
        {renderGanttRuler()}
        {ganttHover?.key === cellKey && (
          <div
            className="pointer-events-none absolute inset-y-0 z-10"
            style={{ left: `${(ganttHover.minutes / dayMinutes) * 100}%` }}
          >
            <div className="h-full w-px bg-primary/60" />
            <div className="absolute -top-2 -translate-x-1/2 rounded bg-background px-1 text-[10px] text-primary">
              {formatHourLabel(
                Math.floor((dayStartTotalMinutes + ganttHover.minutes) / 60),
                (dayStartTotalMinutes + ganttHover.minutes) % 60
              )}
            </div>
          </div>
        )}
        {sortedCellItems.slice(0, MAX_BARS_PER_CELL).map((item, barIdx) => {
          const start = new Date(item.start_at);
          const startMinutes = (start.getTime() - dayStart.getTime()) / 60000;
          const unclampedEnd = startMinutes + item.duration_minutes;
          const clampedStart = Math.min(Math.max(startMinutes, 0), dayMinutes);
          const clampedEnd = Math.min(Math.max(unclampedEnd, 0), dayMinutes);
          if (clampedEnd <= 0 || clampedStart >= dayMinutes) return null;
          const widthMinutes = Math.max(5, clampedEnd - clampedStart);
          const leftPercent = (clampedStart / dayMinutes) * 100;
          const widthPercent = (widthMinutes / dayMinutes) * 100;
          const conflicts = conflictDetailsMap.get(item.id) ?? [];
          const hasConflict = conflicts.length > 0;
          const conflictSummary = conflicts[0] ? formatConflict(conflicts[0]) : null;
          const barClasses = cn(
            'absolute z-10 rounded border px-2 py-1 text-[11px] leading-tight shadow-sm transition hover:shadow',
            item.source_ref_type === 'BLOCK'
              ? 'bg-muted text-foreground border-muted-foreground/30'
              : 'bg-primary/10 text-primary border-primary/30',
            hasConflict ? 'ring-1 ring-destructive/60 border-destructive/50' : ''
          );

          const handleBarClick = () => {
            if (item.source_ref_type === 'WORK_ORDER') {
              navigate(`/work-orders/${item.source_ref_id}`);
            } else {
              handleOpenEdit(item);
            }
          };

          return (
            <Tooltip key={`gantt-bar-${item.id}-${barIdx}`}>
              <TooltipTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleBarClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleBarClick();
                    }
                  }}
                  className={cn(
                    barClasses,
                    focusedScheduleItemId === item.id ? 'ring-2 ring-primary ring-offset-2' : '',
                    highlightedScheduleItemId === item.id ? 'ring-2 ring-primary animate-pulse' : ''
                  )}
                  data-gantt-bar="true"
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    top: barIdx * 26,
                  }}
                  data-schedule-item-id={item.id}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-medium">{getItemLabel(item)}</span>
                    {hasConflict && <AlertTriangle className="w-3 h-3 shrink-0 text-destructive" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatTimeRange(item)} • {formatNumber(item.duration_minutes / 60, 1)}h
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="w-64 space-y-1">
                <p className="font-semibold">{getItemLabel(item)}</p>
                <p className="text-xs text-muted-foreground">{formatTimeRange(item)}</p>
                <p className="text-xs text-muted-foreground">Duration: {formatNumber(item.duration_minutes / 60, 1)}h</p>
                {item.promised_at && (
                  <p className="text-xs text-muted-foreground">
                    Promised: {new Date(item.promised_at).toLocaleString()}
                  </p>
                )}
                {hasConflict && conflictSummary && (
                  <p className="text-xs text-destructive">
                    {conflictSummary.title} ({conflicts.length})
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {hiddenItems.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="absolute bottom-1 right-2 z-10 text-xs text-muted-foreground hover:underline"
                onClick={(e) => e.stopPropagation()}
                data-gantt-ignore="true"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                  }
                }}
              >
                +{hiddenItems.length} more
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end" sideOffset={4} data-gantt-ignore="true">
              <div className="space-y-1">
                {hiddenItems.map((item) => {
                  const conflicts = conflictDetailsMap.get(item.id) ?? [];
                  const hasConflict = conflicts.length > 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.source_ref_type === 'WORK_ORDER') {
                          navigate(`/work-orders/${item.source_ref_id}`);
                        } else {
                          handleOpenEdit(item);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          if (item.source_ref_type === 'WORK_ORDER') {
                            navigate(`/work-orders/${item.source_ref_id}`);
                          } else {
                            handleOpenEdit(item);
                          }
                        }
                      }}
                    >
                      <span className="truncate">{getItemLabel(item)}</span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {hasConflict && <AlertTriangle className="w-3 h-3 text-destructive" />}
                        {formatTimeRange(item)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  };

  const handleOpenNew = (techId?: string | null) => {
    setEditingId(null);
    const prefilled = prefillStartForDate(techId);
    setFormState((prev) => ({
      ...defaultFormState(),
      start: prefilled.start,
      technicianId: prefilled.technicianId,
    }));
    setFormError(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = useCallback((item: ScheduleItem) => {
    setEditingId(item.id);
    setFormState({
      itemType: item.source_ref_type,
      blockType: item.block_type ?? 'BREAK',
      blockTitle: item.block_title ?? '',
      workOrderId: item.source_ref_type === 'BLOCK' ? '' : item.source_ref_id,
      technicianId: item.technician_id ?? '',
      start: toLocalInput(item.start_at),
      durationHours: Number(formatNumber(item.duration_minutes / 60, 2)),
      status: item.status,
      partsReady: item.parts_ready,
      priority: item.priority,
      promised: item.promised_at ? toLocalInput(item.promised_at) : '',
      notes: item.notes ?? '',
    });
    setFormError(null);
    setDialogOpen(true);
  }, [setDialogOpen]);

  const durationMinutes = Math.max(15, Math.round(Number(formState.durationHours || 0) * 60));
  const isoStart = formState.start ? new Date(formState.start).toISOString() : '';
  const isoPromised = formState.promised ? new Date(formState.promised).toISOString() : null;

  const dialogConflicts = useMemo(() => {
    if (!dialogOpen || !isoStart || !formState.technicianId) return [];
    return schedulingRepo.detectConflicts({
      id: editingId,
      technician_id: formState.technicianId || null,
      start_at: isoStart,
      duration_minutes: durationMinutes,
    } as ScheduleItem);
  }, [dialogOpen, isoStart, formState.technicianId, durationMinutes, editingId, schedulingRepo]);
  const hasDialogConflicts = dialogConflicts.length > 0;
  const dialogConflictSummary = dialogConflicts[0] ? formatConflict(dialogConflicts[0]) : null;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const focusId = params.get('focusScheduleItemId');
    const shouldOpen = params.get('open') === '1';
    if (!focusId) return;

    const target = scheduleItems.find((item) => item.id === focusId);
    if (!target) return;

    if (shouldOpen) {
      handleOpenEdit(target);
    }
    setFocusedScheduleItemId(target.id);
    setHighlightedScheduleItemId(target.id);

    const el = document.querySelector(`[data-schedule-item-id="${focusId}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    const timer = setTimeout(() => {
      setFocusedScheduleItemId(null);
      setHighlightedScheduleItemId(null);
    }, 2500);

    const nextParams = new URLSearchParams(location.search);
    nextParams.delete('focusScheduleItemId');
    nextParams.delete('open');
    navigate(
      { pathname: location.pathname, search: nextParams.toString() ? `?${nextParams.toString()}` : '' },
      { replace: true }
    );

    return () => clearTimeout(timer);
  }, [handleOpenEdit, location.pathname, location.search, navigate, scheduleItems]);

  const saveScheduleItem = () => {
    const isBlock = formState.itemType === 'BLOCK';
    if (!isBlock && !formState.workOrderId) {
      setFormError('Work order is required.');
      return;
    }
    if (!formState.start) {
      setFormError('Start time is required.');
      return;
    }

    const priority = Math.min(5, Math.max(1, Math.round(formState.priority))) as ScheduleItem['priority'];
    const blockRef = formState.blockTitle.trim() || `BLOCK-${new Date(isoStart || Date.now()).toISOString()}`;

    const payload: Omit<ScheduleItem, 'id' | 'created_at' | 'updated_at'> & { id?: string } = {
      id: editingId ?? undefined,
      source_ref_type: isBlock ? 'BLOCK' : 'WORK_ORDER',
      source_ref_id: isBlock ? blockRef : formState.workOrderId,
      block_type: isBlock ? formState.blockType : null,
      block_title: isBlock ? (formState.blockTitle.trim() || null) : null,
      technician_id: formState.technicianId || null,
      start_at: isoStart,
      duration_minutes: durationMinutes,
      priority,
      promised_at: isoPromised,
      parts_ready: formState.partsReady,
      status: formState.status,
      notes: formState.notes.trim() ? formState.notes.trim() : null,
      auto_scheduled: false,
    };

    // Warn (non-blocking) if overbooking
    if (!isBlock && isoStart) {
      const startDateLocal = new Date(isoStart);
      const sameDayItems = scheduleItems.filter(
        (item) =>
          (item.technician_id || null) === payload.technician_id &&
          sameDay(item.start_at, startDateLocal) &&
          item.id !== editingId
      );
      const existingMinutes = sameDayItems.reduce((sum, item) => sum + item.duration_minutes, 0);
      const prospectiveMinutes = existingMinutes + durationMinutes;
      const availableMinutes = dayMinutes;
      if (availableMinutes > 0 && prospectiveMinutes > availableMinutes) {
        const percent = Math.min(200, (prospectiveMinutes / availableMinutes) * 100);
        toast({
          title: 'Over capacity warning',
          description: `${getTechnicianLabel(payload.technician_id || null)} would be ${formatNumber(prospectiveMinutes / 60, 1)} / ${formatNumber(availableMinutes / 60, 1)} hrs (${formatNumber(percent, 0)}%) for that day.`,
          variant: 'destructive',
        });
      }
    }

    if (editingId) {
      schedulingRepo.update(editingId, payload);
    } else {
      schedulingRepo.create(payload);
    }

    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (editingId && window.confirm('Remove this scheduled item?')) {
      schedulingRepo.remove(editingId);
      setDialogOpen(false);
    }
  };

  const adjustDate = (deltaDays: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + deltaDays);
      return next;
    });
  };

  const goToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCurrentDate(today);
  };

  const itemsForDate = useMemo(
    () =>
      scheduleItems
        .filter((item) => sameDay(item.start_at, startDate))
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [scheduleItems, startDate]
  );

  const weekLaneItems = useMemo(
    () => scheduleItems.filter((item) => weekDayRange.some((day) => sameDay(item.start_at, day))),
    [scheduleItems, weekDayRange]
  );
  const weekItemsByTech = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    weekLaneItems.forEach((item) => {
      const key = item.technician_id ?? 'unassigned';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    });
    return map;
  }, [weekLaneItems]);

  const dayGanttMap = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    scheduleItems.forEach((item) => {
      const start = new Date(item.start_at);
      if (!sameDay(item.start_at, startDate)) return;
      const key = item.technician_id ?? 'unassigned';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()));
    return map;
  }, [scheduleItems, startDate]);

  const weekGanttMap = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    const base = getWeekStart(startDate);
    const baseMidnight = new Date(base);
    baseMidnight.setHours(0, 0, 0, 0);
    scheduleItems.forEach((item) => {
      const start = new Date(item.start_at);
      const startMidnight = new Date(start);
      startMidnight.setHours(0, 0, 0, 0);
      const diffDays = Math.round((startMidnight.getTime() - baseMidnight.getTime()) / 86400000);
      if (diffDays < 0 || diffDays > 6) return;
      const techKey = item.technician_id ?? 'unassigned';
      const key = `${techKey}-${diffDays}`;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()));
    return map;
  }, [scheduleItems, startDate]);

  const renderLaneGrid = (laneSource: ScheduleItem[], showHeatmap: boolean) => (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {(['unassigned', ...technicians.map((t) => t.id)] as string[])
        .filter((id) => {
          if (technicianFilter === 'ALL') return true;
          if (technicianFilter === 'UNASSIGNED') return id === 'unassigned';
          return id === technicianFilter;
        })
        .map((techId) => {
          const tech = technicianMap.get(techId) ?? null;
          const laneItems = laneSource.filter((item) =>
            techId === 'unassigned' ? !item.technician_id : item.technician_id === techId
          );
          const visibleDays = showHeatmap ? weekDayRange.length : 1;
          const availableMinutes = dayMinutes * visibleDays;
          const scheduledMinutes = laneItems.reduce((sum, item) => sum + item.duration_minutes, 0);
          const percent = availableMinutes > 0 ? Math.min(200, (scheduledMinutes / availableMinutes) * 100) : 0;
          const loadText = `${formatNumber(scheduledMinutes / 60, 1)} / ${formatNumber(availableMinutes / 60, 1)} hrs (${formatNumber(percent, 0)}%)`;
          const overCap = percent > 100;

          return (
            <Card key={techId} className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-base flex items-center gap-1">
                      {techId === 'unassigned' ? 'Unassigned' : tech?.name || 'Technician'}
                      <HelpTooltip content="Each lane is a tech's capacity. Don't overbook—leave room for surprises." />
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={cn(
                            'px-2 py-0.5 cursor-default',
                            overCap ? 'border-destructive text-destructive' : ''
                          )}
                        >
                          {loadText}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm font-medium">Scheduled: {scheduledMinutes} mins</p>
                        <p className="text-sm text-muted-foreground">Available: {availableMinutes} mins</p>
                        {overCap && (
                          <p className="text-sm text-destructive">Overbooked: {scheduledMinutes - availableMinutes} mins</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenNew(techId === 'unassigned' ? null : techId)}
                      title="Add schedule item"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    {overCap && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="w-3 h-3 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium text-destructive">Over capacity</p>
                          <p className="text-xs text-muted-foreground">Utilization over 100% for this window.</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px]">
                  <span className={cn(getUtilizationTone(percent))}>{loadText}</span>
                  {renderUtilizationBar(percent)}
                  {overCap && <Badge variant="destructive" className="px-2 py-0.5 text-[10px]">Overbooked</Badge>}
                </div>
                {showHeatmap && (
                  <div className="mt-2 flex items-center gap-1">
                    {(techWeekLoads.get(techId) ?? Array(7).fill(0)).map((minutes, idx) => {
                      const percent = Math.min(200, Math.round((minutes / DAILY_CAPACITY_MINUTES) * 100));
                      const day = weekDayRange[idx];
                      return (
                        <Tooltip key={`${techId}-${day.toISOString()}`}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn('h-3 w-6 rounded', getLoadTierClass(percent))}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs font-semibold">
                              {day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {minutes} min / {DAILY_CAPACITY_MINUTES} min ({percent}%)
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {laneItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No scheduled work.</p>
                )}
                {laneItems.map((item) => {
                  const conflicts = conflictDetailsMap.get(item.id) ?? [];
                  const hasConflict = conflicts.length > 0;
                  const conflictSummary = conflicts[0] ? formatConflict(conflicts[0]) : null;
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className={cn(
                            'w-full rounded-lg border p-3 text-left transition hover:border-primary hover:bg-accent',
                            hasConflict ? 'border-destructive/50 bg-destructive/10 ring-1 ring-destructive/40' : ''
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge className={cn('px-2 py-0.5 text-xs flex items-center gap-1', statusStyles[item.status])}>
                              {statusLabels[item.status]}
                              <HelpTooltip content="Quick read of job state (scheduled, in progress, waiting parts, complete)." />
                            </Badge>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span className="flex items-center gap-1">
                                {formatTimeRange(item)}
                                <HelpTooltip content="Planned time. Use best estimate—actuals come from time tracking." />
                              </span>
                              {hasConflict && conflictSummary && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="w-3 h-3 text-destructive" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">{conflictSummary.title}</p>
                                    <p className="text-xs text-muted-foreground">{conflictSummary.details}</p>
                                    {conflicts.length > 1 && (
                                      <p className="text-xs text-muted-foreground">+{conflicts.length - 1} more overlap</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                            <ClipboardList className="w-4 h-4 text-primary" />
                            {item.source_ref_type === 'WORK_ORDER' ? (
                              <Link
                                to={`/work-orders/${item.source_ref_id}`}
                                className="truncate text-primary hover:underline flex items-center gap-1"
                                title="Opens the job. Keep scheduling tied to the WO so history stays clean."
                              >
                                {getItemLabel(item)}
                              </Link>
                            ) : (
                              <span className="truncate">{getItemLabel(item)}</span>
                            )}
                            {item.auto_scheduled && (
                              <Badge variant="outline" className="ml-1 text-[10px]">
                                Auto-scheduled
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <Badge variant="outline" className={cn('px-2 py-0.5 text-[11px] font-semibold flex items-center gap-1', item.priority === 1 ? 'border-destructive text-destructive' : '')}>
                              P{item.priority}
                              <HelpTooltip content="Use priority to bubble urgent work without hiding everything else." />
                            </Badge>
                            <Separator orientation="vertical" className="h-4" />
                            <span>{formatTimeRange(item)}</span>
                            {item.parts_ready && (
                              <>
                                <Separator orientation="vertical" className="h-4" />
                                <span className="text-emerald-600 dark:text-emerald-400">Parts ready</span>
                              </>
                            )}
                            {item.promised_at && (
                              <>
                                <Separator orientation="vertical" className="h-4" />
                                <span>Promised: {new Date(item.promised_at).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                          {item.notes && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 flex items-center gap-1">
                              <span>{item.notes}</span>
                              <HelpTooltip content="Short scheduling notes: 'needs bay 2', 'waiting on part', 'customer drop-off'." />
                            </p>
                          )}
                          {hasConflict && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}</span>
                            </div>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="w-64 space-y-1">
                        <p className="font-semibold">{getItemLabel(item)}</p>
                        <p className="text-xs text-muted-foreground">
                          Duration: {formatNumber(item.duration_minutes / 60, 1)}h • {formatTimeRange(item)}
                        </p>
                        {item.promised_at && (
                          <p className="text-xs text-muted-foreground">
                            Promised: {new Date(item.promised_at).toLocaleString()}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
      );

  return (
    <TooltipProvider>
      <div className="page-container space-y-6">
        <PageHeader
          title="Scheduling"
          subtitle={
            <span className="flex items-center gap-1">
              Plan technician workload for the week.
              <HelpTooltip content="Plan jobs by day and technician. Keep it real so the shop stays predictable." />
            </span>
          }
        actions={
          <div className="flex items-center gap-2 overflow-x-auto pb-1 min-w-0">
            <div className="flex items-center gap-1">
              <Select value={technicianFilter} onValueChange={(val) => setTechnicianFilter(val as typeof technicianFilter)}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All technicians" />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All technicians</SelectItem>
                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <HelpTooltip content="Filters help you focus. Clear filters when you're done so you don't miss work." />
            </div>
            <div className="flex rounded-md border">
              {(['DAY', 'WEEK'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'default' : 'ghost'}
                  size="sm"
                  className={viewMode === mode ? '' : 'bg-transparent'}
                  onClick={() => setViewMode(mode)}
                >
                  {mode === 'DAY' ? 'Day' : 'Week'}
                </Button>
              ))}
            </div>
            {viewMode === 'DAY' && (
              <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                <span className="text-muted-foreground">Layout</span>
                {(['LANES', 'GANTT'] as const).map((layout) => (
                  <Button
                    key={layout}
                    variant={dayLayout === layout ? 'default' : 'ghost'}
                    size="sm"
                    className={dayLayout === layout ? '' : 'bg-transparent'}
                    onClick={() => setDayLayout(layout)}
                  >
                    {layout === 'LANES' ? 'Lanes' : 'Gantt'}
                  </Button>
                ))}
              </div>
            )}
            {viewMode === 'WEEK' && (
              <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                <span className="text-muted-foreground">Layout</span>
                {(['LANES', 'CALENDAR', 'GANTT'] as const).map((layout) => (
                  <Button
                    key={layout}
                    variant={weekLayout === layout ? 'default' : 'ghost'}
                    size="sm"
                    className={weekLayout === layout ? '' : 'bg-transparent'}
                    onClick={() => setWeekLayout(layout)}
                  >
                    {layout === 'LANES' ? 'Lanes' : layout === 'CALENDAR' ? 'Calendar' : 'Gantt'}
                  </Button>
                ))}
              </div>
            )}
            <Button
              onClick={() => {
                if (technicianFilter === 'ALL') handleOpenNew(undefined);
                else if (technicianFilter === 'UNASSIGNED') handleOpenNew(null);
                else handleOpenNew(technicianFilter);
              }}
              title="Creates a scheduled block for a WO. Use for real commitments."
            >
              <Plus className="w-4 h-4 mr-2" />
              New Scheduled Item
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{viewMode === 'WEEK' ? 'Week of' : 'Day'}</p>
              <p className="text-lg font-semibold">
                {viewMode === 'WEEK' ? currentWeekLabel : currentDayLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => adjustDate(viewMode === 'WEEK' ? -7 : -1)}
              title="Jump to a day or week. Use this to plan ahead and avoid overload."
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => adjustDate(viewMode === 'WEEK' ? 7 : 1)}
              title="Jump to a day or week. Use this to plan ahead and avoid overload."
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToday}
              title="Jump to a day or week. Use this to plan ahead and avoid overload."
            >
              Today
            </Button>
          </div>
      </CardContent>
    </Card>

      {viewMode === 'DAY' && dayLayout === 'LANES' && renderLaneGrid(itemsForDate, false)}

      {viewMode === 'DAY' && dayLayout === 'GANTT' && renderGanttLegend()}

      {viewMode === 'DAY' && dayLayout === 'GANTT' && (
        <div className="overflow-x-auto rounded-lg border">
          <div className="sticky top-0 z-20 grid grid-cols-[180px_minmax(0,1fr)] border-b bg-muted/70 px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur">
            <div className="sticky left-0 z-30 border-r bg-muted/70 pr-3">Technician</div>
            <div className="text-center">
              {startDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
          {(['unassigned', ...technicians.map((t) => t.id)] as string[])
            .filter((id) => {
              if (technicianFilter === 'ALL') return true;
              if (technicianFilter === 'UNASSIGNED') return id === 'unassigned';
              return id === technicianFilter;
            })
        .map((techId) => {
          const tech = technicianMap.get(techId) ?? null;
          const cellItems = dayGanttMap.get(techId) ?? [];
          const dayStart = new Date(startDate);
          dayStart.setHours(startHour, startMinute, 0, 0);
          const scheduledMinutes = cellItems.reduce((sum, item) => sum + item.duration_minutes, 0);
          const availableMinutes = dayMinutes;
          const percent = availableMinutes > 0 ? Math.min(200, (scheduledMinutes / availableMinutes) * 100) : 0;
          const loadText = `${formatNumber(scheduledMinutes / 60, 1)} / ${formatNumber(availableMinutes / 60, 1)} hrs (${formatNumber(percent, 0)}%)`;

          return (
            <div
              key={`day-gantt-row-${techId}`}
              className="grid grid-cols-[180px_minmax(0,1fr)] border-b last:border-b-0"
            >
              <div className="sticky left-0 z-10 flex items-center gap-2 border-r bg-background px-3 py-3 text-sm font-medium">
                <User className="w-4 h-4 text-muted-foreground" />
                <div className="min-w-0">
                  <div>{techId === 'unassigned' ? 'Unassigned' : tech?.name || 'Technician'}</div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn('cursor-default', getUtilizationTone(percent))}>{loadText}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm font-medium">Scheduled: {scheduledMinutes} mins</p>
                        <p className="text-sm text-muted-foreground">Available: {availableMinutes} mins</p>
                        {percent > 100 && (
                          <p className="text-sm text-destructive">Overbooked: {scheduledMinutes - availableMinutes} mins</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                    {renderUtilizationBar(percent)}
                    {percent > 100 && <Badge variant="destructive" className="px-2 py-0.5 text-[10px]">Overbooked</Badge>}
                  </div>
                </div>
              </div>
              {renderGanttCell({
                cellKey: `day-${techId}`,
                dayStart,
                dayDate: startDate,
                    techId,
                    techLabel: techId === 'unassigned' ? 'Unassigned' : tech?.name || 'Technician',
                    cellItems,
                  })}
                </div>
              );
            })}
        </div>
      )}

      {viewMode === 'WEEK' && weekLayout === 'LANES' && renderLaneGrid(weekLaneItems, true)}

      {viewMode === 'WEEK' && weekLayout === 'CALENDAR' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {weekDays.map((day, idx) => {
            const itemsForDay = weekItems[idx] ?? [];
            return (
              <Card key={day.toISOString()} className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{day.toLocaleDateString(undefined, { weekday: 'long' })}</CardTitle>
                      <p className="text-sm text-muted-foreground">{formatShortDate(day)}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {itemsForDay.length} item{itemsForDay.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {itemsForDay.length === 0 && (
                    <p className="text-sm text-muted-foreground">No scheduled work.</p>
                  )}
                  {itemsForDay.map((item) => {
                    const conflicts = conflictDetailsMap.get(item.id) ?? [];
                    const hasConflict = conflicts.length > 0;
                    const conflictSummary = conflicts[0] ? formatConflict(conflicts[0]) : null;
                    return (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className={cn(
                              'w-full rounded-lg border p-3 text-left transition hover:border-primary hover:bg-accent',
                              hasConflict ? 'border-destructive/50 bg-destructive/10 ring-1 ring-destructive/40' : ''
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Badge className={cn('px-2 py-0.5 text-xs', statusStyles[item.status])}>{statusLabels[item.status]}</Badge>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{formatTimeRange(item)}</span>
                                {hasConflict && conflictSummary && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="w-3 h-3 text-destructive" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="font-medium">{conflictSummary.title}</p>
                                      <p className="text-xs text-muted-foreground">{conflictSummary.details}</p>
                                      {conflicts.length > 1 && (
                                        <p className="text-xs text-muted-foreground">+{conflicts.length - 1} more overlap</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                              <ClipboardList className="w-4 h-4 text-primary" />
                              <span className="truncate">{getItemLabel(item)}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                              <Badge variant="outline" className={cn('px-2 py-0.5 text-[11px] font-semibold', item.priority === 1 ? 'border-destructive text-destructive' : '')}>
                                P{item.priority}
                              </Badge>
                              <Separator orientation="vertical" className="h-4" />
                              <span>{getTechnicianLabel(item.technician_id)}</span>
                              <Separator orientation="vertical" className="h-4" />
                              <span>{formatTimeRange(item)}</span>
                            </div>
                            {item.notes && (
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-2 flex items-center gap-1">
                                <span>{item.notes}</span>
                                <HelpTooltip content="Short scheduling notes: 'needs bay 2', 'waiting on part', 'customer drop-off'." />
                              </p>
                            )}
                            {hasConflict && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}</span>
                              </div>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="w-64 space-y-1">
                          <p className="font-semibold">{getItemLabel(item)}</p>
                          <p className="text-xs text-muted-foreground">
                            Duration: {formatNumber(item.duration_minutes / 60, 1)}h • {formatTimeRange(item)}
                          </p>
                          {item.promised_at && (
                            <p className="text-xs text-muted-foreground">
                              Promised: {new Date(item.promised_at).toLocaleString()}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {viewMode === 'WEEK' && weekLayout === 'GANTT' && (
        renderGanttLegend()
      )}

      {viewMode === 'WEEK' && weekLayout === 'GANTT' && (
        <div className="overflow-x-auto rounded-lg border">
          <div className="sticky top-0 z-20 grid grid-cols-[180px_repeat(7,minmax(0,1fr))] border-b bg-muted/70 px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur">
            <div className="sticky left-0 z-30 border-r bg-muted/70 pr-3">Technician</div>
            {weekDayRange.map((day) => (
              <div key={`gantt-head-${day.toISOString()}`} className="text-center">
                {day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            ))}
          </div>
          {(['unassigned', ...technicians.map((t) => t.id)] as string[])
            .filter((id) => {
              if (technicianFilter === 'ALL') return true;
              if (technicianFilter === 'UNASSIGNED') return id === 'unassigned';
              return id === technicianFilter;
            })
            .map((techId) => {
              const tech = technicianMap.get(techId) ?? null;
              const weekItemsForTech = weekItemsByTech.get(techId) ?? [];
              const scheduledMinutes = weekItemsForTech.reduce((sum, item) => sum + item.duration_minutes, 0);
              const availableMinutes = dayMinutes * weekDayRange.length;
              const percent = availableMinutes > 0 ? Math.min(200, (scheduledMinutes / availableMinutes) * 100) : 0;
              const loadText = `${formatNumber(scheduledMinutes / 60, 1)} / ${formatNumber(availableMinutes / 60, 1)} hrs (${formatNumber(percent, 0)}%)`;
              return (
                <div
                  key={`gantt-row-${techId}`}
                  className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] border-b last:border-b-0"
                >
                  <div className="sticky left-0 z-10 flex items-center gap-2 border-r bg-background px-3 py-3 text-sm font-medium">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <div>{techId === 'unassigned' ? 'Unassigned' : tech?.name || 'Technician'}</div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn('cursor-default', getUtilizationTone(percent))}>{loadText}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm font-medium">Scheduled: {scheduledMinutes} mins</p>
                            <p className="text-sm text-muted-foreground">Available: {availableMinutes} mins</p>
                            {percent > 100 && (
                              <p className="text-sm text-destructive">
                                Overbooked: {scheduledMinutes - availableMinutes} mins
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                        {renderUtilizationBar(percent)}
                        {percent > 100 && <Badge variant="destructive" className="px-2 py-0.5 text-[10px]">Overbooked</Badge>}
                      </div>
                    </div>
                  </div>
                  {weekDayRange.map((day, dayIdx) => {
                    const dayStart = new Date(day);
                    dayStart.setHours(startHour, startMinute, 0, 0);
                    const cellItems = weekGanttMap.get(`${techId}-${dayIdx}`) ?? [];
                    return (
                      <div key={`gantt-cell-${techId}-${day.toISOString()}`}>
                        {renderGanttCell({
                          cellKey: `week-${techId}-${dayIdx}`,
                          dayStart,
                          dayDate: day,
                          techId,
                          techLabel: techId === 'unassigned' ? 'Unassigned' : tech?.name || 'Technician',
                          cellItems,
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            Upcoming work
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {scheduleItems.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>}
          {scheduleItems.map((item) => {
            const conflicts = conflictDetailsMap.get(item.id) ?? [];
            const hasConflict = conflicts.length > 0;
            const conflictSummary = conflicts[0] ? formatConflict(conflicts[0]) : null;
            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-lg border p-3 shadow-sm transition hover:border-primary hover:bg-accent',
                  hasConflict ? 'border-destructive/50 bg-destructive/10 ring-1 ring-destructive/30' : ''
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className={cn('border', statusStyles[item.status])}>{statusLabels[item.status]}</Badge>
                    <span className="text-xs text-muted-foreground">{formatShortDate(new Date(item.start_at))}</span>
                    {hasConflict && conflictSummary && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="w-3 h-3 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{conflictSummary.title}</p>
                          <p className="text-xs text-muted-foreground">{conflictSummary.details}</p>
                          {conflicts.length > 1 && (
                            <p className="text-xs text-muted-foreground">+{conflicts.length - 1} more overlap</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <Badge variant="outline" className={cn('px-2 py-0.5 text-[11px] font-semibold', item.priority === 1 ? 'border-destructive text-destructive' : '')}>
                    P{item.priority}
                  </Badge>
                </div>
                <div className="mt-2 text-sm font-semibold">{getItemLabel(item)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatTimeRange(item)} • {getTechnicianLabel(item.technician_id)}
                </div>
                {hasConflict && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="w-3 h-3" />
                    {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Scheduled Item' : 'New Scheduled Item'}</DialogTitle>
            <DialogDescription>Assign a work order to the calendar and set timing and status.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {formError && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>Cannot save</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {dialogConflicts.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>Scheduling conflict</AlertTitle>
                <AlertDescription className="space-y-1">
                  <p>
                    {dialogConflicts.length} overlapping item{dialogConflicts.length === 1 ? '' : 's'} with this technician.
                  </p>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    {dialogConflicts.map((conflict) => (
                      <li key={conflict.id}>
                        {getItemLabel(conflict)} — {formatTimeRange(conflict)}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formState.itemType}
                  onValueChange={(val: 'WORK_ORDER' | 'BLOCK') =>
                    setFormState((prev) => ({ ...prev, itemType: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WORK_ORDER">Work Order</SelectItem>
                    <SelectItem value="BLOCK">Block</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formState.itemType === 'WORK_ORDER' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-1">
                      Work Order
                      <HelpTooltip content="Opens the job. Keep scheduling tied to the WO so history stays clean." />
                    </Label>
                    {hasDialogConflicts && dialogConflictSummary && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{dialogConflictSummary.title}</p>
                          <p className="text-xs text-muted-foreground">{dialogConflictSummary.details}</p>
                          {dialogConflicts.length > 1 && (
                            <p className="text-xs text-muted-foreground">+{dialogConflicts.length - 1} more overlap</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <Select
                    value={formState.workOrderId || undefined}
                    onValueChange={(val) => setFormState((prev) => ({ ...prev, workOrderId: val }))}
                  >
                    <SelectTrigger className={cn(hasDialogConflicts ? 'border-destructive/50 bg-destructive/10' : '')}>
                      <SelectValue placeholder="Select work order" />
                    </SelectTrigger>
                    <SelectContent>
                      {workOrders.map((wo) => (
                        <SelectItem key={wo.id} value={wo.id}>
                          {getWorkOrderLabel(wo.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Block Type</Label>
                    <Select
                      value={formState.blockType}
                      onValueChange={(val: ScheduleBlockType) =>
                        setFormState((prev) => ({ ...prev, blockType: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BREAK">Break</SelectItem>
                        <SelectItem value="PTO">PTO</SelectItem>
                        <SelectItem value="MEETING">Meeting</SelectItem>
                        <SelectItem value="FABRICATION">Fabrication</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Block Title</Label>
                    <Input
                      value={formState.blockTitle}
                      onChange={(e) => setFormState((prev) => ({ ...prev, blockTitle: e.target.value }))}
                      placeholder="Optional description (e.g., Team meeting)"
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-1">
                    Technician
                    <HelpTooltip content="Each lane is a tech's capacity. Don't overbook—leave room for surprises." />
                  </Label>
                  {hasDialogConflicts && dialogConflictSummary && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{dialogConflictSummary.title}</p>
                        <p className="text-xs text-muted-foreground">{dialogConflictSummary.details}</p>
                        {dialogConflicts.length > 1 && (
                          <p className="text-xs text-muted-foreground">+{dialogConflicts.length - 1} more overlap</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <Select
                  value={formState.technicianId || undefined}
                  onValueChange={(val) =>
                    setFormState((prev) => ({
                      ...prev,
                      technicianId: val === '__NONE__' ? '' : val,
                    }))
                  }
                >
                  <SelectTrigger className={cn(hasDialogConflicts ? 'border-destructive/50 bg-destructive/10' : '')}>
                    <SelectValue placeholder="Assign technician (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">
                      Unassigned
                    </SelectItem>
                    {technicians
                      .filter((tech) => tech.id && tech.id.trim() !== '')
                      .map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-1">
                    Start
                    <HelpTooltip content="Drag jobs to change day/time. Move it when the plan changes." />
                  </Label>
                  {hasDialogConflicts && dialogConflictSummary && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{dialogConflictSummary.title}</p>
                        <p className="text-xs text-muted-foreground">{dialogConflictSummary.details}</p>
                        {dialogConflicts.length > 1 && (
                          <p className="text-xs text-muted-foreground">+{dialogConflicts.length - 1} more overlap</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <Input
                  type="datetime-local"
                  value={formState.start}
                  onChange={(e) => setFormState((prev) => ({ ...prev, start: e.target.value }))}
                  className={cn(hasDialogConflicts ? 'border-destructive/50 bg-destructive/10' : '')}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-1">
                    Duration (hours)
                    <HelpTooltip content="Planned time. Use best estimate—actuals come from time tracking." />
                  </Label>
                  {hasDialogConflicts && dialogConflictSummary && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{dialogConflictSummary.title}</p>
                        <p className="text-xs text-muted-foreground">{dialogConflictSummary.details}</p>
                        {dialogConflicts.length > 1 && (
                          <p className="text-xs text-muted-foreground">+{dialogConflicts.length - 1} more overlap</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <Input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={formState.durationHours}
                  onChange={(e) => setFormState((prev) => ({ ...prev, durationHours: Number(e.target.value) }))}
                  className={cn(hasDialogConflicts ? 'border-destructive/50 bg-destructive/10' : '')}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Status
                  <HelpTooltip content="Quick read of job state (scheduled, in progress, waiting parts, complete)." />
                </Label>
                <Select
                  value={formState.status}
                  onValueChange={(val: ScheduleItemStatus) => setFormState((prev) => ({ ...prev, status: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(statusLabels) as ScheduleItemStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-1">
                    Priority (1-5)
                    <HelpTooltip content="Use priority to bubble urgent work without hiding everything else." />
                  </Label>
                  <Badge variant="outline" className={cn('px-2 py-0.5 text-[11px] font-semibold', formState.priority === 1 ? 'border-destructive text-destructive' : '')}>
                    P{formState.priority || 1}
                  </Badge>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={formState.priority}
                  onChange={(e) => setFormState((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Promised Date</Label>
                <Input
                  type="datetime-local"
                  value={formState.promised}
                  onChange={(e) => setFormState((prev) => ({ ...prev, promised: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between space-y-0 rounded-lg border p-3">
                <div>
                  <Label className="text-sm font-medium">Parts Ready</Label>
                  <p className="text-xs text-muted-foreground">Flag when all parts are staged.</p>
                </div>
                <Switch
                  checked={formState.partsReady}
                  onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, partsReady: checked }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Notes
                <HelpTooltip content="Short scheduling notes: 'needs bay 2', 'waiting on part', 'customer drop-off'." />
              </Label>
              <Textarea
                value={formState.notes}
                onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Extra scheduling details, bay needs, parts status…"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            {editingId && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                title="Removes the scheduled block without deleting the WO."
              >
                Remove
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveScheduleItem} disabled={hasDialogConflicts} title={hasDialogConflicts ? 'Resolve conflicts before saving' : undefined}>
                {editingId ? 'Save Changes' : 'Create Item'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
