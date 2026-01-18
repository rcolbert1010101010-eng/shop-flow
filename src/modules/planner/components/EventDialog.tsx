import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { PlannerEvent } from '../models';

type EventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (event: Omit<PlannerEvent, 'created_at'> & { created_at?: string }) => void;
  initialEvent?: PlannerEvent | null;
  defaults?: {
    start_date?: string;
    end_date?: string | null;
    all_day?: boolean;
  };
};

export function EventDialog({ open, onOpenChange, onSave, initialEvent, defaults }: EventDialogProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(true);

  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title);
      setNotes(initialEvent.notes ?? '');
      setStartDate(initialEvent.start_date);
      setEndDate(initialEvent.end_date ?? '');
      setAllDay(initialEvent.all_day);
    } else {
      setTitle('');
      setNotes('');
      setStartDate(defaults?.start_date ?? '');
      setEndDate(defaults?.end_date ?? '');
      setAllDay(defaults?.all_day ?? true);
    }
  }, [defaults?.all_day, defaults?.end_date, defaults?.start_date, initialEvent, open]);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !startDate) return;

    onSave({
      id: initialEvent?.id ?? undefined,
      title: trimmedTitle,
      notes: notes.trim() ? notes.trim() : null,
      start_date: startDate,
      end_date: endDate || null,
      all_day: allDay,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialEvent ? 'Edit Event' : 'Add Event'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2 flex items-center gap-2">
              <Switch checked={allDay} onCheckedChange={setAllDay} id="all-day" />
              <Label htmlFor="all-day">All day</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
