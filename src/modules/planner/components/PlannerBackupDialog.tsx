import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import type { PlannerData } from '../models';
import { exportPlannerData, importPlannerData, resetPlannerData } from '../storage';

type PlannerBackupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataImported: (data: PlannerData) => void;
  onDataReset: (data: PlannerData) => void;
};

export function PlannerBackupDialog({ open, onOpenChange, onDataImported, onDataReset }: PlannerBackupDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const [importConfirm, setImportConfirm] = useState<PlannerData | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const handleExport = () => {
    const payload = exportPlannerData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopflow-planner-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = importPlannerData(parsed);
      if (!imported) {
        toast({ title: 'Invalid backup file', variant: 'destructive' });
        return;
      }
      setImportConfirm(imported);
    } catch {
      toast({ title: 'Failed to read backup file', variant: 'destructive' });
    }
  };

  const triggerFile = () => {
    fileInputRef.current?.click();
  };

  const handleConfirmImport = () => {
    if (!importConfirm) return;
    onDataImported(importConfirm);
    toast({ title: 'Planner data imported' });
    setImportConfirm(null);
    onOpenChange(false);
  };

  const handleReset = () => {
    setResetConfirm(true);
  };

  const handleConfirmReset = () => {
    const data = resetPlannerData();
    onDataReset(data);
    toast({ title: 'Planner data reset' });
    setResetConfirm(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setImportConfirm(null); setResetConfirm(false); onOpenChange(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Planner Backup</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Export</Label>
            <p className="text-sm text-muted-foreground">
              Download a JSON backup of your planner data (tasks and events).
            </p>
            <Button onClick={handleExport} variant="secondary">
              Export Backup
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Import</Label>
            <p className="text-sm text-muted-foreground">
              Import a JSON backup. This will replace your current planner data.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={triggerFile}>
                Choose File
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                  e.target.value = '';
                }}
              />
              {importConfirm ? <span className="text-xs text-muted-foreground">Ready to import</span> : null}
            </div>
            {importConfirm ? (
              <div className="p-3 border rounded-lg space-y-2">
                <div className="text-sm font-medium">Confirm import?</div>
                <div className="text-xs text-muted-foreground">
                  This will replace your current Planner data.
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setImportConfirm(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleConfirmImport}>
                    Confirm Import
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Reset</Label>
            <p className="text-sm text-muted-foreground">
              Clear all planner data and start fresh.
            </p>
            {!resetConfirm ? (
              <Button variant="destructive" onClick={handleReset}>
                Reset Planner
              </Button>
            ) : (
              <div className="p-3 border rounded-lg space-y-2">
                <div className="text-sm font-medium">Confirm reset?</div>
                <div className="text-xs text-muted-foreground">
                  This will remove all tasks and events from local storage.
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setResetConfirm(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleConfirmReset}>
                    Confirm Reset
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
