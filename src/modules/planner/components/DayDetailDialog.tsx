import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PlannerEvent, PlannerTask } from '../models';

type DayDetailDialogProps = {
  open: boolean;
  date: string | null;
  tasks: PlannerTask[];
  events: PlannerEvent[];
  onOpenChange: (open: boolean) => void;
  onAddTask: (date: string) => void;
  onAddEvent: (date: string) => void;
};

export function DayDetailDialog({ open, date, tasks, events, onOpenChange, onAddTask, onAddEvent }: DayDetailDialogProps) {
  const label = date ? new Date(date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'short' }) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{label || 'Day details'}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          {date ? (
            <>
              <Button size="sm" onClick={() => onAddTask(date)}>
                Add Task
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onAddEvent(date)}>
                Add Event
              </Button>
            </>
          ) : null}
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold mb-2">Tasks</div>
            {tasks.length === 0 && <div className="text-sm text-muted-foreground">No tasks for this day.</div>}
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="p-3 border rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{task.title}</div>
                    <Badge variant="outline">{task.priority}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">Status: {task.status}</div>
                  {task.tags?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {task.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Events</div>
            {events.length === 0 && <div className="text-sm text-muted-foreground">No events for this day.</div>}
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="p-3 border rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{event.title}</div>
                    {event.all_day ? <Badge variant="secondary">All day</Badge> : null}
                  </div>
                  {event.end_date ? (
                    <div className="text-xs text-muted-foreground">
                      {event.start_date} - {event.end_date}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">{event.start_date}</div>
                  )}
                  {event.notes ? <div className="text-sm">{event.notes}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
