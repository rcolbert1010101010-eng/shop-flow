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
import type { Vendor } from '@/types';
import { parseVendorsImport, type ImportParseResult, type ImportPreviewRow } from '@/lib/vendorsImport';
import { cn } from '@/lib/utils';

type ImportVendorsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
};

type ImportSummary = {
  created: number;
  updated: number;
};

const buildNotes = (row: ImportPreviewRow) => {
  const addressParts = [row.address1, row.city, row.state, row.zip].filter(Boolean).join(', ');
  const pieces = [row.notes, addressParts ? `Address: ${addressParts}` : null].filter(Boolean);
  return pieces.length > 0 ? pieces.join('\n') : null;
};

const findExistingVendor = (row: ImportPreviewRow, list: Vendor[]) => {
  const key = row.name.trim().toLowerCase();
  return list.find((v) => v.vendor_name.trim().toLowerCase() === key) ?? null;
};

export function ImportVendorsDialog({ open, onOpenChange, vendors }: ImportVendorsDialogProps) {
  const repos = useRepos();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const sampleText = [
    'name,phone,email,address1,city,state,zip,notes,is_active',
    'Summit Brake & Axle,406-555-1111,orders@summit.com,200 Parts Rd,Billings,MT,59101,Main brake supplier,true',
    'Great Plains Supply,406-555-2222,support@gpsupply.com,10 Industrial Way,Bozeman,MT,59715,Send statements to AP,false',
  ].join('\n');

  const handleDownloadTemplate = () => {
    const headers = ['name', 'phone', 'email', 'address1', 'city', 'state', 'zip', 'notes', 'is_active'];
    const exampleRows = [
      ['Summit Brake & Axle', '406-555-1111', 'orders@summit.com', '200 Parts Rd', 'Billings', 'MT', '59101', 'Main brake supplier', 'true'],
      ['Great Plains Supply', '406-555-2222', 'support@gpsupply.com', '10 Industrial Way', 'Bozeman', 'MT', '59715', 'Send statements to AP', 'false'],
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
    link.download = 'vendors-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseResult: ImportParseResult = useMemo(() => {
    const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return parseVendorsImport(normalized, vendors);
  }, [input, vendors]);

  const hasPhoneColumn = parseResult.headers.includes('phone');
  const hasEmailColumn = parseResult.headers.includes('email');
  const hasAddressColumn = parseResult.headers.some(
    (header) => header === 'address1' || header === 'city' || header === 'state' || header === 'zip'
  );
  const hasNotesColumn = parseResult.headers.includes('notes');
  const hasIsActiveColumn = parseResult.headers.includes('is_active');

  const validRows = useMemo(() => parseResult.rows.filter((row) => row.errors.length === 0), [parseResult.rows]);
  const errorCount = parseResult.rows.reduce((sum, row) => sum + (row.errors.length > 0 ? 1 : 0), 0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (validRows.length === 0) {
        throw new Error('No valid rows to import');
      }

      const currentVendors = repos.vendors.vendors;
      let created = 0;
      let updated = 0;

      for (const row of validRows) {
        const notes = buildNotes(row);
        const existing = findExistingVendor(row, currentVendors);
        if (existing) {
          const patch: Partial<Vendor> = { vendor_name: row.name };
          if (hasPhoneColumn) patch.phone = row.phone;
          if (hasEmailColumn) patch.email = row.email;
          if (hasNotesColumn || hasAddressColumn) patch.notes = notes;
          if (hasIsActiveColumn) patch.is_active = row.is_active;

          repos.vendors.updateVendor(existing.id, patch);
          updated += 1;
        } else {
          const createdVendor = repos.vendors.addVendor({
            vendor_name: row.name,
            phone: hasPhoneColumn ? row.phone : null,
            email: hasEmailColumn ? row.email : null,
            notes: hasNotesColumn || hasAddressColumn ? notes : null,
          });
          if (hasIsActiveColumn && row.is_active === false) {
            repos.vendors.updateVendor(createdVendor.id, { is_active: false });
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
        description: `Added ${result.created} vendor(s), updated ${result.updated}.`,
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

  const actionLabel = (row: ImportPreviewRow) => (findExistingVendor(row, vendors) ? 'Update' : 'Create');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] w-[min(900px,95vw)] max-w-4xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import Vendors
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <p>Paste CSV or tab-separated rows with headers: name, phone, email, address1, city, state, zip, notes, is_active.</p>
            <p className="text-xs text-muted-foreground">
              Leave is_active blank for active vendors. Address fields are merged into notes if present.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="vendors-import-text" className="flex items-center gap-1">
                Paste rows</Label>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
            <Textarea
              id="vendors-import-text"
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
            <p className="text-xs text-muted-foreground">Tabs are supported. Missing fields are ignored.</p>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City/State</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Paste data to preview.
                      </TableCell>
                    </TableRow>
                  ) : (
                    parseResult.rows.map((row) => {
                      const cityState = [row.city, row.state].filter(Boolean).join(', ');
                      return (
                        <TableRow key={row.index} className={cn(row.errors.length > 0 && 'bg-destructive/5')}>
                          <TableCell className="font-mono text-xs">{row.index}</TableCell>
                          <TableCell className="text-xs">
                            {row.name || <span className="text-muted-foreground">Missing</span>}
                          </TableCell>
                          <TableCell className="text-xs">{row.phone || '—'}</TableCell>
                          <TableCell className="text-xs">{row.email || '—'}</TableCell>
                          <TableCell className="text-xs">{cityState || '—'}</TableCell>
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
                      );
                    })
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
