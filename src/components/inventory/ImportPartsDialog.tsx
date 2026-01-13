import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import type { Part, PartCategory, Vendor } from '@/types';
import { parsePartsImport, type ImportParseResult } from '@/lib/partsImport';
import { cn } from '@/lib/utils';

type ImportPartsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parts: Part[];
  vendors: Vendor[];
  categories: PartCategory[];
};

type ImportSummary = {
  partsCreated: number;
  vendorsCreated: number;
  categoriesCreated: number;
};

export function ImportPartsDialog({ open, onOpenChange, parts, vendors, categories }: ImportPartsDialogProps) {
  const repos = useRepos();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sampleText = [
    'part_number,description,cost,selling_price,quantity_on_hand,vendor,category,is_active',
    'IMP-100,Hydraulic Hose,22.39,39.00,6,Summit Brake & Axle,Hydraulics,true',
    'IMP-101,LED Marker Light Amber,6.50,12.99,30,NAPA Truck & Trailer Parts,Electrical & Lighting,true',
  ].join('\n');

  const existingPartNumbers = useMemo(
    () => new Set(parts.map((p) => p.part_number.trim().toLowerCase())),
    [parts]
  );

  const parseResult: ImportParseResult = useMemo(() => {
    const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return parsePartsImport(normalized, { existingPartNumbers: Array.from(existingPartNumbers) });
  }, [existingPartNumbers, input]);

  const validRows = useMemo(() => parseResult.rows.filter((row) => row.errors.length === 0), [parseResult.rows]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (validRows.length === 0) {
        throw new Error('No valid rows to import');
      }

      const vendorLookup = new Map<string, Vendor>();
      vendors.forEach((v) => vendorLookup.set(v.vendor_name.trim().toLowerCase(), v));
      const categoryLookup = new Map<string, PartCategory>();
      categories.forEach((c) => categoryLookup.set(c.category_name.trim().toLowerCase(), c));

      let vendorsCreated = 0;
      let categoriesCreated = 0;

      const ensureVendor = (name: string) => {
        const key = name.trim().toLowerCase();
        const existing = vendorLookup.get(key);
        if (existing) return existing;
        const created = repos.vendors.addVendor({
          vendor_name: name.trim(),
          phone: null,
          email: null,
          notes: 'Created from import',
        });
        vendorLookup.set(key, created);
        vendorsCreated += 1;
        return created;
      };

      const ensureCategory = (name: string) => {
        const key = name.trim().toLowerCase();
        const existing = categoryLookup.get(key);
        if (existing) return existing;
        const created = repos.categories.addCategory({
          category_name: name.trim(),
          description: 'Created from import',
        });
        categoryLookup.set(key, created);
        categoriesCreated += 1;
        return created;
      };

      let partsCreated = 0;
      validRows.forEach((row) => {
        const vendor = ensureVendor(row.vendor);
        const category = ensureCategory(row.category);
        repos.parts.addPart({
          part_number: row.part_number,
          description: row.description || row.part_number,
          vendor_id: vendor.id,
          category_id: category.id,
          cost: row.cost,
          selling_price: row.selling_price,
          quantity_on_hand: row.quantity_on_hand,
          core_required: false,
          core_charge: 0,
          min_qty: null,
          max_qty: null,
          bin_location: null,
          last_cost: row.cost,
          avg_cost: row.cost,
          model: null,
          serial_number: null,
          barcode: null,
          is_kit: false,
          is_active: row.is_active,
        });
        partsCreated += 1;
      });

      return { partsCreated, vendorsCreated, categoriesCreated };
    },
    onSuccess: (result) => {
      setSummary(result);
      toast({
        title: 'Import complete',
        description: `Added ${result.partsCreated} parts (${result.vendorsCreated} vendor(s), ${result.categoriesCreated} category(s) created).`,
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

  const errorCount = parseResult.rows.reduce((sum, row) => sum + (row.errors.length > 0 ? 1 : 0), 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] w-[min(900px,95vw)] max-w-5xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import Parts
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <p>Paste CSV/tab data with headers: part_number, description, cost, selling_price, quantity_on_hand, vendor, category, is_active.</p>
            <p className="text-xs text-muted-foreground">
              Vendor/category labels are auto-created if new. Part numbers must be unique across existing and pasted rows.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          <div className="space-y-2">
            <Label htmlFor="parts-import-text">Paste rows</Label>
            <Textarea
              id="parts-import-text"
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
              Tabs are also supported. Leave is_active blank for active parts. Quantities must be zero or positive.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Badge variant={errorCount > 0 ? 'destructive' : 'secondary'}>
              {parseResult.rows.length} row(s) • {errorCount} with errors
            </Badge>
            <Badge variant="secondary">{validRows.length} ready to import</Badge>
            {summary ? (
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {summary.partsCreated} created
              </Badge>
            ) : null}
          </div>

          <div className="rounded-lg border min-h-[220px]">
            <ScrollArea className="h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Part #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">QOH</TableHead>
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
                        <TableCell className="font-mono text-xs">{row.part_number || <span className="text-muted-foreground">Missing</span>}</TableCell>
                        <TableCell className="text-xs">{row.vendor || '—'}</TableCell>
                        <TableCell className="text-xs">{row.category || '—'}</TableCell>
                        <TableCell className="text-right text-xs">${Number.isFinite(row.cost) ? row.cost.toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-right text-xs">${Number.isFinite(row.selling_price) ? row.selling_price.toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-right text-xs">{row.quantity_on_hand}</TableCell>
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
              Created {summary.partsCreated} parts, {summary.vendorsCreated} vendor(s), {summary.categoriesCreated} category(s).
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Valid rows will be imported; invalid rows stay highlighted until fixed.
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={validRows.length === 0 || mutation.isPending}>
              {mutation.isPending ? 'Importing…' : `Import ${validRows.length} part(s)`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
