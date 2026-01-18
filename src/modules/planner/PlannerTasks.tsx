import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { TaskDialog } from './components/TaskDialog';
import type { PlannerTask } from './models';
import { deleteTask, loadPlannerData, savePlannerData, setTaskStatus, upsertTask } from './storage';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

type TaskFilter = 'all' | 'open' | 'today' | 'week' | 'overdue';
const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export default function PlannerTasks() {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('all');

  useEffect(() => {
    const data = loadPlannerData();
    setTasks(data.tasks);
  }, []);

  const todayKey = new Date().toISOString().slice(0, 10);
  const startOfWeek = (() => {
    const d = new Date();
    const day = d.getDay(); // 0 Sunday
    const diff = d.getDate() - day;
    const start = new Date(d.setDate(diff));
    return start.toISOString().slice(0, 10);
  })();
  const endOfWeek = (() => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  })();

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      const due = task.due_date;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'open') return task.status !== 'Done';
      if (activeFilter === 'today') return due === todayKey;
      if (activeFilter === 'week') return due ? due >= startOfWeek && due <= endOfWeek : false;
      if (activeFilter === 'overdue') return due ? due < todayKey && task.status !== 'Done' : false;
      return true;
    });
  }, [activeFilter, endOfWeek, startOfWeek, tasks, todayKey]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'Open' ? -1 : 1;
      }
      const aDue = a.due_date || '';
      const bDue = b.due_date || '';
      if (aDue !== bDue) {
        if (!aDue) return 1;
        if (!bDue) return -1;
        return aDue.localeCompare(bDue);
      }
      return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
    });
  }, [filtered]);

  const handleSave = (task: Omit<PlannerTask, 'created_at'> & { created_at?: string }) => {
    const saved = upsertTask(task);
    const data = loadPlannerData();
    setTasks(data.tasks);
    savePlannerData(data);
    setEditingTask(null);
    setDialogOpen(false);
    return saved;
  };

  const handleToggle = (task: PlannerTask) => {
    const nextStatus = task.status === 'Done' ? 'Open' : 'Done';
    setTaskStatus(task.id, nextStatus);
    const data = loadPlannerData();
    setTasks(data.tasks);
  };

  const handleDelete = (taskId: string) => {
    deleteTask(taskId);
    const data = loadPlannerData();
    setTasks(data.tasks);
  };

  return (
    <div className="page-container space-y-4">
      <PageHeader
        title="Planner Tasks"
        subtitle="Track personal tasks"
        actions={
          <Button onClick={() => { setEditingTask(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        {(['all', 'open', 'today', 'week', 'overdue'] as TaskFilter[]).map((filter) => (
          <Button
            key={filter}
            variant={activeFilter === filter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(filter)}
          >
            {filter === 'all'
              ? 'All'
              : filter === 'open'
              ? 'Open'
              : filter === 'today'
              ? 'Today'
              : filter === 'week'
              ? 'This Week'
              : 'Overdue'}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Done</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="text-center">
                    <Switch checked={task.status === 'Done'} onCheckedChange={() => handleToggle(task)} />
                  </TableCell>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>{formatDate(task.due_date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{task.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={task.status === 'Done' ? 'secondary' : 'outline'}>{task.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {task.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingTask(task); setDialogOpen(true); }}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    No tasks yet. Add your first task to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TaskDialog
        open={dialogOpen}
        initialTask={editingTask}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
      />
    </div>
  );
}
