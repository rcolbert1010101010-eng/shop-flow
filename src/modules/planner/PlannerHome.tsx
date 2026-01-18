import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CheckSquare, Plus, Clock, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TaskDialog } from './components/TaskDialog';
import { EventDialog } from './components/EventDialog';
import { PlannerBackupDialog } from './components/PlannerBackupDialog';
import type { PlannerData, PlannerEvent, PlannerTask } from './models';
import { loadPlannerData, savePlannerData, upsertEvent, upsertTask } from './storage';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date';

export default function PlannerHome() {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [taskDefaults, setTaskDefaults] = useState<{ due_date?: string | null }>({});
  const [eventDefaults, setEventDefaults] = useState<{ start_date?: string; end_date?: string | null }>({});

  useEffect(() => {
    const data = loadPlannerData();
    setTasks(data.tasks);
    setEvents(data.events);
  }, []);

  const openTasks = useMemo(() => tasks.filter((t) => t.status === 'Open'), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'Done'), [tasks]);
  const upcoming = useMemo(
    () =>
      openTasks
        .filter((t) => !!t.due_date)
        .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
        .slice(0, 5),
    [openTasks]
  );

  const upcomingEvents = useMemo(
    () =>
      [...events].sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 5),
    [events]
  );

  const handleTaskSave = (task: Omit<PlannerTask, 'created_at'> & { created_at?: string }) => {
    const saved = upsertTask(task);
    const data = loadPlannerData();
    setTasks(data.tasks);
    savePlannerData(data);
    setTaskDefaults({});
    return saved;
  };

  const handleDataImported = (data: PlannerData) => {
    setTasks(data.tasks ?? []);
    setEvents(data.events ?? []);
    setTaskDefaults({});
    setEventDefaults({});
  };

  const handleDataReset = (data: PlannerData) => {
    setTasks(data.tasks ?? []);
    setEvents(data.events ?? []);
    setTaskDefaults({});
    setEventDefaults({});
  };

  const handleEventSave = (event: Omit<PlannerEvent, 'created_at'> & { created_at?: string }) => {
    const saved = upsertEvent(event);
    const data = loadPlannerData();
    setEvents(data.events);
    savePlannerData(data);
    setEventDefaults({});
    return saved;
  };

  return (
    <div className="page-container space-y-4">
      <PageHeader
        title="Planner"
        subtitle="Personal planner for tasks and events"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/planner/tasks">
                <CheckSquare className="mr-2 h-4 w-4" />
                Tasks
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/planner/calendar">
                <CalendarCheck className="mr-2 h-4 w-4" />
                Calendar
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBackupDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Export / Import
            </Button>
            <Button onClick={() => setTaskDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
            <Button variant="secondary" onClick={() => setEventDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Open Tasks</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{openTasks.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{completedTasks.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{upcomingEvents.length}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Next Tasks</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/planner/tasks">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 && <div className="text-muted-foreground text-sm">No upcoming tasks.</div>}
            {upcoming.map((task) => (
              <div key={task.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{task.title}</div>
                  <Badge variant="outline">{task.priority}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatDate(task.due_date)}
                </div>
                {task.tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {task.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upcoming Events</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/planner/calendar">View calendar</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.length === 0 && <div className="text-muted-foreground text-sm">No events scheduled.</div>}
            {upcomingEvents.map((event) => (
              <div key={event.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{event.title}</div>
                  {event.all_day ? <Badge variant="secondary">All day</Badge> : null}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {formatDate(event.start_date)}
                  {event.end_date ? ` - ${formatDate(event.end_date)}` : ''}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...tasks]
              .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
              .slice(0, 5)
              .map((task) => (
                <div key={task.id} className="flex items-center justify-between py-1">
                  <div>
                    <div className="font-medium">{task.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(task.due_date)}</div>
                  </div>
                  <Badge variant={task.status === 'Done' ? 'secondary' : 'outline'}>{task.status}</Badge>
                </div>
              ))}
            {tasks.length === 0 && <div className="text-muted-foreground text-sm">No tasks yet.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...events]
              .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
              .slice(0, 5)
              .map((event) => (
                <div key={event.id} className="flex items-center justify-between py-1">
                  <div>
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(event.start_date)}</div>
                  </div>
                  {event.all_day ? <Badge variant="secondary">All day</Badge> : null}
                </div>
              ))}
            {events.length === 0 && <div className="text-muted-foreground text-sm">No events yet.</div>}
          </CardContent>
        </Card>
      </div>

      <TaskDialog open={taskDialogOpen} defaults={taskDefaults} onOpenChange={setTaskDialogOpen} onSave={handleTaskSave} />
      <EventDialog open={eventDialogOpen} defaults={eventDefaults} onOpenChange={setEventDialogOpen} onSave={handleEventSave} />
      <PlannerBackupDialog
        open={backupDialogOpen}
        onOpenChange={setBackupDialogOpen}
        onDataImported={handleDataImported}
        onDataReset={handleDataReset}
      />
    </div>
  );
}
