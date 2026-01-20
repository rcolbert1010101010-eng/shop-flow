import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useRepos } from '@/repos';
import type { Customer, Unit } from '@/types';
import { parseUnitsImport, type ImportParseResult, type ImportPreviewRow } from '@/lib/unitsImport';
import { cn } from '@/lib/utils';
import { HelpTooltip } from '@/components/help/HelpTooltip';

type ImportUnitsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: Unit[];
  customers: Customer[];
};

type ImportSummary = {
  created: number;
  updated: number;
};

const buildNotes = (row: ImportPreviewRow) => {
  const pieces = [row.notes, row.plate ? `Plate: ${row.plate}` : null].filter(Boolean);
  return pieces.length > 0 ? pieces.join('\n') : null;
};

const findExistingUnit = (row: ImportPreviewRow, list: Unit[]) => {
  const vinKey = row.vin?.trim().toLowerCase();
  if (vinKey) {
    const byVin = list.find((u) => u.vin?.trim().toLowerCase() === vinKey);
    if (byVin) return byVin;
  }
  const numKey = row.unit_number.trim().toLowerCase();
  if (numKey) {
    const byNumber = list.find((u) => u.unit_name?.trim().toLowerCase() === numKey);
    if (byNumber) return byNumber;
  }
  return null;
};

export function ImportUnitsDialog({ open, onOpenChange, units, customers }: ImportUnitsDialogProps) {
  const repos = useRepos();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const sampleText = [
    'unit_number,vin,year,make,model,plate,notes,is_active',
    'TRK-100,1HTMMAAN37H123456,2021,Peterbilt,389,ABC123,Shop truck,true',
    'TRL-05,,2019,Load Trail,Dump,,Needs new tarp,false',
  ].join('\n');

  const handleDownloadTemplate = () => {
    const headers = ['unit_number', 'vin', 'year', 'make', 'model', 'plate', 'notes', 'is_active'];
    const exampleRows = [
      ['TRK-100', '1HTMMAAN37H123456', '2021', 'Peterbilt', '389', 'ABC123', 'Shop truck', 'true'],
      ['TRL-05', '', '2019', 'Load Trail', 'Dump', '', 'Needs new tarp', 'false'],
    ];
    const escapeCSVField = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvRows = [headers.map(escapeCSVField).join(',')];
    exampleRows.forEach((row) => csvRows.push(row.map(escapeCSVField).join(',')));
    const csvContent = csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'units-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseResult: ImportParseResult = useMemo(() => {
    const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return parseUnitsImport(normalized, units);
  }, [input, units]);

  const validRows = useMemo(() => parseResult.rows.filter((row) => row.errors.length === 0), [parseResult.rows]);
  const errorCount = parseResult.rows.reduce((sum, row) => sum + (row.errors.length > 0 ? 1 : 0), 0);

  const hasCustomerColumn = parseResult.headers.includes('customer');
  const hasYearColumn = parseResult.headers.includes('year');
  const hasMakeColumn = parseResult.headers.includes('make');
  const hasModelColumn = parseResult.headers.includes('model');
  const hasVinColumn = parseResult.headers.includes('vin');
  const hasUnitNumberColumn = parseResult.headers.includes('unit_number');
  const hasNotesColumn = parseResult.headers.includes('notes');
  const hasPlateColumn = parseResult.headers.includes('plate');
  const hasIsActiveColumn = parseResult.headers.includes('is_active');

  const resolveCustomerId = (row: ImportPreviewRow, currentCustomers: Customer[], existing?: Unit | null) => {
    if (hasCustomerColumn && row.customer) {
      const match = currentCustomers.find(
        (c) => c.company_name.trim().toLowerCase() === row.customer!.trim().toLowerCase()
      );
      if (!match) {
        throw new Error(`Row ${row.index}: customer "${row.customer}" not found`);
      }
      return match.id;
    }

    if (existing && !hasCustomerColumn) {
      return existing.customer_id;
    }

    const walkin = currentCustomers.find((c) => c.id === 'walkin');
    const fallback = walkin ?? currentCustomers[0];
    if (!fallback) {
      throw new Error('No customers available. Add a customer or include a customer column.');
    }
    return fallback.id;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (validRows.length === 0) {
        throw new Error('No valid rows to import');
      }

      const currentUnits = repos.units.units;
      const currentCustomers = repos.customers.customers;
      let created = 0;
      let updated = 0;

      for (const row of validRows) {
        const existing = findExistingUnit(row, currentUnits);
        const customer_id = resolveCustomerId(row, currentCustomers, existing);
        const notes = buildNotes(row);
        const unit_name = row.unit_number || row.vin || existing?.unit_name || 'Unit';

        if (existing) {
          const patch: Partial<Unit> = {};
          if (hasCustomerColumn) patch.customer_id = customer_id;
          if (hasUnitNumberColumn || hasVinColumn) patch.unit_name = unit_name;
          if (hasVinColumn) patch.vin = row.vin;
          if (hasYearColumn) patch.year = row.year;
          if (hasMakeColumn) patch.make = row.make;
          if (hasModelColumn) patch.model = row.model;
          if (hasNotesColumn || hasPlateColumn) patch.notes = notes;
          if (hasIsActiveColumn) patch.is_active = row.is_active;

          repos.units.updateUnit(existing.id, patch);
          updated += 1;
        } else {
          const createdUnit = repos.units.addUnit({
            customer_id,
            unit_name,
            vin: row.vin,
            year: row.year,
            make: row.make,
            model: row.model,
            mileage: null,
            hours: null,
            notes,
          });
          if (row.is_active === false) {
            repos.units.updateUnit(createdUnit.id, { is_active: false });
          }
          created += 1;
        }
      }

      return { created, updated };
    },
    onSuccess: (result) => {
      setSummary(result);
      toast({
        title: 'Import complete',
        description: `Added ${result.created} unit(s), updated ${result.updated}.`,
      });
      setInput('');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Import failed';
      toast({ title: 'Import failed', description: message, variant: 'destructive' });
    },
  });

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setInput('');
      setSummary(null);
    }
    onOpenChange(nextOpen);
  };

  const actionLabel = (row: ImportPreviewRow) => (findExistingUnit(row, units) ? 'Update' : 'Create');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] w-[min(900px,95vw)] max-w-5xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import Units
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <p>Paste CSV or tab-separated rows with headers: unit_number, vin, year, make, model, plate, notes, is_active.</p>
            <p className="text-xs text-muted-foreground">
              Optional: add a customer column to map units to existing customers. Leave is_active blank for active units.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="units-import-text" className="flex items-center gap-1">
                Paste rows
                <HelpTooltip content="Paste CSV or tab-separated unit rows with headers. Use the template to keep formatting aligned." />
              </Label>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
            <Textarea
              id="units-import-text"
              placeholder="Paste CSV or tab-separated rows including headers…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-40 font-mono text-sm whitespace-pre"
              ref={textareaRef}
            />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileSpreadsheet className="w-4 h-4" />
              Quick sample
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInput(sampleText);
                  textareaRef.current?.focus();
                }}
              >
                Use sample
              </Button>
            </div>
            <pre className="bg-background rounded-md border px-3 py-2 text-xs overflow-auto whitespace-pre-wrap">
{sampleText}
            </pre>
            <p className="text-xs text-muted-foreground">
              Tabs are supported. Include either unit_number or VIN. Add a customer column to target a specific account.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Badge variant={errorCount > 0 ? 'destructive' : 'secondary'}>
              {parseResult.rows.length} row(s) • {errorCount} with errors
            </Badge>
            <Badge variant="secondary">{validRows.length} ready</Badge>
            {summary ? (
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {summary.created} added / {summary.updated} updated
              </Badge>
            ) : null}
          </div>

          <div className="rounded-lg border min-h-[220px]">
            <ScrollArea className="h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Unit #</TableHead>
                    <TableHead>VIN</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Make/Model</TableHead>
                    <TableHead>Plate</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Paste data to preview.
                      </TableCell>
                    </TableRow>
                  ) : (
                    parseResult.rows.map((row) => (
                      <TableRow key={row.index} className={cn(row.errors.length > 0 && 'bg-destructive/5')}>
                        <TableCell className="font-mono text-xs">{row.index}</TableCell>
                        <TableCell className="text-xs">
                          {row.unit_number || <span className="text-muted-foreground">Missing</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{row.vin || '—'}</TableCell>
                        <TableCell className="text-xs">{row.year ?? '—'}</TableCell>
                        <TableCell className="text-xs">
                          {[row.make, row.model].filter(Boolean).join(' ') || '—'}
                        </TableCell>
                        <TableCell className="text-xs">{row.plate || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {actionLabel(row)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.errors.length === 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              Ready
                            </Badge>
                          ) : (
                            <div className="flex flex-col gap-1 text-[11px] text-destructive">
                              {row.errors.map((err) => (
                                <span key={err} className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {err}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {summary ? (
            <div className="text-sm text-muted-foreground">
              Created {summary.created}, updated {summary.updated}. Invalid rows remain highlighted.
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Valid rows will be created or updated. Invalid rows stay highlighted until fixed.
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={validRows.length === 0 || mutation.isPending}>
              {mutation.isPending ? 'Importing…' : `Import ${validRows.length} row(s)`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
