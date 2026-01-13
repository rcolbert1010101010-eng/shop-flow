import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download } from 'lucide-react';

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
import { useShopStore } from '@/stores/shopStore';
import { ChevronDown, ChevronUp, History } from 'lucide-react';

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
  const addPartsImportHistory = useShopStore((s) => s.addPartsImportHistory);
  const partsImportHistory = useShopStore((s) => s.getPartsImportHistory());
  const [input, setInput] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sampleText = [
    'part_number,description,cost,selling_price,quantity_on_hand,vendor,category,is_active',
    'IMP-100,Hydraulic Hose,22.39,39.00,6,Summit Brake & Axle,Hydraulics,true',
    'IMP-101,LED Marker Light Amber,6.50,12.99,30,NAPA Truck & Trailer Parts,Electrical & Lighting,true',
  ].join('\n');

  const handleDownloadTemplate = () => {
    const headers = [
      'part_number',
      'description',
      'cost',
      'selling_price',
      'quantity_on_hand',
      'vendor',
      'category',
      'is_active',
      'bin_location',
      'location',
      'min_qty',
      'max_qty',
      'has_core',
      'core_cost',
      'uom',
      'allow_fractional_qty',
      'qty_precision',
      'material_kind',
      'sheet_width_in',
      'sheet_length_in',
      'thickness_in',
      'grade',
    ];
    const exampleRows = [
      ['IMP-100', 'Hydraulic Hose', '22.39', '39.00', '6', 'Summit Brake & Axle', 'Hydraulics', 'true', 'A1', 'Warehouse A', '2', '10', 'false', '0', 'EA', 'false', '0', 'STANDARD', '', '', '', ''],
      ['IMP-101', 'LED Marker Light Amber', '6.50', '12.99', '30', 'NAPA Truck & Trailer Parts', 'Electrical & Lighting', 'true', 'B2', 'Warehouse B', '5', '50', 'false', '0', 'EA', 'false', '0', 'STANDARD', '', '', '', ''],
      ['IMP-102', 'Steel Cable', '45.00', '89.99', '12.5', 'Auto Parts Co', 'Brakes', 'true', 'C3', 'Warehouse C', '4', '20', 'false', '0', 'FT', 'true', '2', 'STANDARD', '', '', '', ''],
      ['IMP-103', 'Steel Plate A36', '125.00', '250.00', '0', 'Metal Supply Co', 'Raw Materials', 'true', 'D4', 'Warehouse D', '10', '100', 'false', '0', 'SQFT', 'true', '2', 'SHEET', '48', '96', '0.25', 'A36'],
    ];

    const escapeCSVField = (field: string): string => {
      if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvRows = [headers.map(escapeCSVField).join(',')];
    exampleRows.forEach((row) => {
      csvRows.push(row.map(escapeCSVField).join(','));
    });

    const csvContent = csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shopflow-parts-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
        const uom = row.uom ?? 'EA';
        const allow_fractional_qty = row.allow_fractional_qty ?? (uom === 'FT' || uom === 'SQFT' ? true : false);
        const qty_precision = row.qty_precision ?? (uom === 'EA' ? 0 : 2);
        const material_kind = row.material_kind ?? 'STANDARD';
        
        repos.parts.addPart({
          part_number: row.part_number,
          description: row.description || row.part_number,
          vendor_id: vendor.id,
          category_id: category.id,
          cost: row.cost,
          selling_price: row.selling_price,
          quantity_on_hand: row.quantity_on_hand,
          core_required: row.has_core ?? false,
          core_charge: row.core_cost ?? 0,
          min_qty: row.min_qty ?? null,
          max_qty: row.max_qty ?? null,
          bin_location: row.bin_location ?? null,
          location: row.location ?? null,
          uom,
          allow_fractional_qty,
          qty_precision,
          material_kind,
          sheet_width_in: row.sheet_width_in ?? null,
          sheet_length_in: row.sheet_length_in ?? null,
          thickness_in: row.thickness_in ?? null,
          grade: row.grade ?? null,
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
      const totalRows = parseResult.rows.length;
      const failedRows = parseResult.rows.filter((r) => r.errors.length > 0).length;
      const skippedRows = totalRows - validRows.length;
addPartsImportHistory({
        total_rows: totalRows,
        valid_rows: validRows.length,
        partsCreated,
        vendorsCreated,
        categoriesCreated,
        skipped_rows: skippedRows,
        failed_rows: failedRows,
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
Optional columns: bin_location, location, min_qty, max_qty, has_core, core_cost. Vendor/category labels are auto-created if new. Part numbers must be unique across existing and pasted rows.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="parts-import-text">Paste rows</Label>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Excel Template
              </Button>
            </div>
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
                    <TableHead>Bin</TableHead>
                    <TableHead>Min/Max</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">
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
                        <TableCell className="text-xs">{row.bin_location || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {row.min_qty != null || row.max_qty != null
                            ? `${row.min_qty ?? '—'}/${row.max_qty ?? '—'}`
                            : '—'}
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

          {partsImportHistory.length > 0 && (
            <div className="rounded-lg border">
              <button
                type="button"
                onClick={() => setHistoryExpanded(!historyExpanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <History className="w-4 h-4" />
                  Import History ({partsImportHistory.length})
                </div>
                {historyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {historyExpanded && (
                <div className="border-t">
                  <ScrollArea className="h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Valid</TableHead>
                          <TableHead className="text-right">Created</TableHead>
                          <TableHead className="text-right">Vendors</TableHead>
                          <TableHead className="text-right">Categories</TableHead>
                          <TableHead className="text-right">Skipped</TableHead>
                          <TableHead className="text-right">Failed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partsImportHistory.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(entry.performed_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-xs">{entry.total_rows}</TableCell>
                            <TableCell className="text-right text-xs">{entry.valid_rows}</TableCell>
                            <TableCell className="text-right text-xs">{entry.partsCreated}</TableCell>
                            <TableCell className="text-right text-xs">{entry.vendorsCreated}</TableCell>
                            <TableCell className="text-right text-xs">{entry.categoriesCreated}</TableCell>
                            <TableCell className="text-right text-xs">{entry.skipped_rows}</TableCell>
                            <TableCell className="text-right text-xs">{entry.failed_rows}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
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



