import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EventDialog } from './components/EventDialog';
import { DayDetailDialog } from './components/DayDetailDialog';
import { TaskDialog } from './components/TaskDialog';
import type { PlannerEvent, PlannerTask } from './models';
import { loadPlannerData, savePlannerData, upsertEvent, upsertTask } from './storage';

type CalendarItem = { type: 'task' | 'event'; title: string; id: string; priority?: string; all_day?: boolean };

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const formatMonthYear = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

function buildMonthGrid(baseDate: Date) {
  const start = startOfMonth(baseDate);
  const end = endOfMonth(baseDate);
  const startDay = start.getDay(); // 0=Sun
  const daysInMonth = end.getDate();

  const days: Array<{ date: Date; day: number }> = [];
  for (let i = 1; i <= daysInMonth; i += 1) {
    days.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), i), day: i });
  }

  const padded = Array.from({ length: startDay }, () => null);
  return [...padded, ...days];
}

export default function PlannerCalendar() {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [eventDefaults, setEventDefaults] = useState<{ start_date?: string; end_date?: string | null }>({});
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDefaults, setTaskDefaults] = useState<{ due_date?: string | null }>({});

  useEffect(() => {
    const data = loadPlannerData();
    setTasks(data.tasks);
    setEvents(data.events);
  }, []);

  const days = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const addItem = (dateKey: string, item: CalendarItem) => {
      const arr = map.get(dateKey) ?? [];
      arr.push(item);
      map.set(dateKey, arr);
    };

    tasks.forEach((task) => {
      if (task.due_date) {
        addItem(task.due_date, { type: 'task', title: task.title, id: task.id, priority: task.priority });
      }
    });

    events.forEach((event) => {
      const start = new Date(event.start_date);
      const end = event.end_date ? new Date(event.end_date) : start;
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        addItem(key, { type: 'event', title: event.title, id: event.id, all_day: event.all_day });
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return map;
  }, [events, tasks]);

  const handleEventSave = (event: Omit<PlannerEvent, 'created_at'> & { created_at?: string }) => {
    const saved = upsertEvent(event);
    const data = loadPlannerData();
    setEvents(data.events);
    savePlannerData(data);
    setEventDialogOpen(false);
    setEventDefaults({});
    return saved;
  };

  const handleTaskSave = (task: Omit<PlannerTask, 'created_at'> & { created_at?: string }) => {
    const saved = upsertTask(task);
    const data = loadPlannerData();
    setTasks(data.tasks);
    savePlannerData(data);
    setTaskDialogOpen(false);
    setTaskDefaults({});
    return saved;
  };

  const prevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const openDayDetail = (date: string) => {
    setSelectedDate(date);
    setDayDetailOpen(true);
  };

  const itemsForDate = (dateKey: string) => {
    const tasksForDay = tasks.filter((t) => t.due_date === dateKey);
    const eventsForDay = events.filter((event) => {
      const start = new Date(event.start_date);
      const end = event.end_date ? new Date(event.end_date) : start;
      const target = new Date(dateKey);
      return target >= start && target <= end;
    });
    return { tasksForDay, eventsForDay };
  };

  const handleAddTaskForDate = (dateKey: string) => {
    setTaskDefaults({ due_date: dateKey });
    setTaskDialogOpen(true);
  };

  const handleAddEventForDate = (dateKey: string) => {
    setEventDefaults({ start_date: dateKey, end_date: dateKey });
    setEventDialogOpen(true);
  };

  return (
    <div className="page-container space-y-4">
      <PageHeader
        title="Planner Calendar"
        subtitle="Month view of personal tasks and events"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={prevMonth} size="sm">
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button variant="outline" onClick={nextMonth} size="sm">
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
            <Button onClick={() => setEventDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {formatMonthYear(currentMonth)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-sm font-medium text-muted-foreground mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="min-h-[120px] border rounded-lg bg-muted/30" />;
              }

              const key = day.date.toISOString().slice(0, 10);
              const items = itemsByDate.get(key) ?? [];
              const visible = items.slice(0, 3);
              const overflow = items.length - visible.length;

              return (
                <button
                  type="button"
                  onClick={() => openDayDetail(key)}
                  className="min-h-[140px] border rounded-lg p-2 flex flex-col gap-2 text-left hover:border-primary transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{day.day}</div>
                  </div>
                  <div className="space-y-1 flex-1">
                    {visible.map((item) => (
                      <div
                        key={item.id}
                        className="text-xs px-2 py-1 rounded-md bg-accent flex items-center gap-2"
                      >
                        <span className="font-medium truncate">{item.title}</span>
                        {item.type === 'task' && item.priority ? (
                          <Badge variant="secondary">{item.priority}</Badge>
                        ) : null}
                        {item.type === 'event' && item.all_day ? (
                          <Badge variant="outline">All day</Badge>
                        ) : null}
                      </div>
                    ))}
                    {overflow > 0 ? (
                      <div className="text-xs text-muted-foreground">+{overflow} more</div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <EventDialog open={eventDialogOpen} defaults={eventDefaults} onOpenChange={setEventDialogOpen} onSave={handleEventSave} />
      <TaskDialog open={taskDialogOpen} defaults={taskDefaults} onOpenChange={setTaskDialogOpen} onSave={handleTaskSave} />
      <DayDetailDialog
        open={dayDetailOpen}
        date={selectedDate}
        tasks={selectedDate ? itemsForDate(selectedDate).tasksForDay : []}
        events={selectedDate ? itemsForDate(selectedDate).eventsForDay : []}
        onOpenChange={setDayDetailOpen}
        onAddTask={handleAddTaskForDate}
        onAddEvent={handleAddEventForDate}
      />
    </div>
  );
}
