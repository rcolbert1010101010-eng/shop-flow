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
import type { Customer } from '@/types';
import { parseCustomersImport, type ImportParseResult, type ImportPreviewRow } from '@/lib/customersImport';
import { cn } from '@/lib/utils';

type ImportCustomersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
};

type ImportSummary = {
  created: number;
  updated: number;
};

const buildAddress = (row: ImportPreviewRow) => {
  const line1 = [row.address1, row.address2].filter(Boolean).join(', ');
  const cityState = [row.city, [row.state, row.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const address = [line1, cityState].filter(Boolean).join('\n').trim();
  return address || null;
};

const findExistingCustomer = (row: ImportPreviewRow, list: Customer[]) => {
  const numberKey = row.customer_number?.trim().toLowerCase();
  const accountKey = row.account_number?.trim().toLowerCase();

  if (numberKey) {
    const byNumber = list.find((c) => {
      const num = (c as any).customer_number ?? (c as any).account_number;
      return typeof num === 'string' && num.trim().toLowerCase() === numberKey;
    });
    if (byNumber) return byNumber;
  }

  if (accountKey) {
    const byAccount = list.find((c) => {
      const acct = (c as any).account_number ?? (c as any).customer_number;
      return typeof acct === 'string' && acct.trim().toLowerCase() === accountKey;
    });
    if (byAccount) return byAccount;
  }

  const nameKey = row.name.trim().toLowerCase();
  return list.find((c) => c.company_name.trim().toLowerCase() === nameKey) ?? null;
};

export function ImportCustomersDialog({ open, onOpenChange, customers }: ImportCustomersDialogProps) {
  const repos = useRepos();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const sampleText = [
    'name,phone,email,address1,address2,city,state,zip,notes,is_active',
    'Northstar Logistics,406-555-0101,dispatch@northstar.com,123 Fleet Ave,,Billings,MT,59101,Top fleet customer,true',
    'Canyon Mining,406-555-0155,accounts@canyon.com,90 Mine Rd,Suite 200,Helena,MT,59601,Net 30,false',
  ].join('\n');

  const handleDownloadTemplate = () => {
    const headers = ['name', 'phone', 'email', 'address1', 'address2', 'city', 'state', 'zip', 'notes', 'is_active'];
    const exampleRows = [
      ['Northstar Logistics', '406-555-0101', 'dispatch@northstar.com', '123 Fleet Ave', '', 'Billings', 'MT', '59101', 'Top fleet customer', 'true'],
      ['Canyon Mining', '406-555-0155', 'accounts@canyon.com', '90 Mine Rd', 'Suite 200', 'Helena', 'MT', '59601', 'Net 30', 'false'],
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
    link.download = 'customers-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseResult: ImportParseResult = useMemo(() => {
    const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return parseCustomersImport(normalized, customers);
  }, [customers, input]);

  const hasPhoneColumn = parseResult.headers.includes('phone');
  const hasEmailColumn = parseResult.headers.includes('email');
  const hasAddressColumns = parseResult.headers.some(
    (header) => header === 'address1' || header === 'address2' || header === 'city' || header === 'state' || header === 'zip'
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

      const currentCustomers = repos.customers.customers;
      let created = 0;
      let updated = 0;

      for (const row of validRows) {
        const existing = findExistingCustomer(row, currentCustomers);
        const address = hasAddressColumns ? buildAddress(row) : null;
        const notes = hasNotesColumn ? row.notes : null;
        if (existing) {
          const patch: Partial<Customer> = { company_name: row.name };
          if (hasPhoneColumn) patch.phone = row.phone;
          if (hasEmailColumn) patch.email = row.email;
          if (hasAddressColumns) patch.address = address;
          if (hasNotesColumn) patch.notes = notes;
          if (hasIsActiveColumn) patch.is_active = row.is_active;

          const result = repos.customers.updateCustomer(existing.id, patch);
          if (!result.success) {
            throw new Error(`Row ${row.index}: ${result.error || 'Unable to update customer'}`);
          }
          updated += 1;
        } else {
          const result = repos.customers.addCustomer({
            company_name: row.name,
            contact_name: null,
            phone: hasPhoneColumn ? row.phone : null,
            email: hasEmailColumn ? row.email : null,
            address: hasAddressColumns ? address : null,
            notes: hasNotesColumn ? notes : null,
            price_level: 'RETAIL',
            is_tax_exempt: false,
            tax_rate_override: null,
          });
          if (!result.success || !result.customer) {
            throw new Error(`Row ${row.index}: ${result.error || 'Unable to create customer'}`);
          }
          if (hasIsActiveColumn && row.is_active === false) {
            repos.customers.updateCustomer(result.customer.id, { is_active: false });
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
        description: `Added ${result.created} customer(s), updated ${result.updated}.`,
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

  const actionLabel = (row: ImportPreviewRow) =>
    findExistingCustomer(row, customers) ? 'Update' : 'Create';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] w-[min(900px,95vw)] max-w-5xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import Customers
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <p>Paste CSV or tab-separated rows with headers: name, phone, email, address1, address2, city, state, zip, notes, is_active.</p>
            <p className="text-xs text-muted-foreground">
              Leave is_active blank for active customers. Numbers (customer/account) are matched when present; otherwise name matching is used.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="customers-import-text" className="flex items-center gap-1">
                Paste rows</Label>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
            <Textarea
              id="customers-import-text"
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
              Tabs are also supported. Missing address parts are ignored. Leave is_active blank for active records.
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
