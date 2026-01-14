import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRepos } from '@/repos';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';
import { formatQtyWithUom, formatSheetsEquivalent } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpTooltip } from '@/components/help/HelpTooltip';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

type Line = {
  id: string;
  partId: string;
  qty: string;
  receiveMode?: 'SQFT' | 'SHEETS';
  sheetsReceived?: string;
};

const newId = () => Math.random().toString(36).slice(2, 9);

export default function ReceiveInventory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { parts: partsRepo, vendors: vendorsRepo, purchaseOrders: poRepo } = useRepos();
  const receiveInventory = partsRepo.receiveInventory;
  const parts = partsRepo.parts.filter((p) => p.is_active && !p.is_kit);
  const vendors = vendorsRepo.vendors;
  const { purchaseOrders, purchaseOrderLines } = poRepo;
  const [searchParams] = useSearchParams();
  const poId = searchParams.get('poId');
  const prefilledPo = useRef(false);

  const NONE = '__none__';
  const [vendorId, setVendorId] = useState<string>('');
  const [reference, setReference] = useState('');
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedPart, setSelectedPart] = useState('');
  const [selectedQty, setSelectedQty] = useState('1');
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const partsById = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const availableParts = useMemo(() => {
    const list = parts.filter((p) => (p as any).is_active !== false);
    if (!vendorId) return list;
    return list.filter((p) => p.vendor_id === vendorId);
  }, [parts, vendorId]);
  const lineErrors = useMemo(() => {
    return lines.map((l) => {
      const errors: string[] = [];
      if (!l.partId) errors.push('Part required');
      const part = partsById.get(l.partId);
      const isSheetMaterial = part?.uom === 'SQFT' && part?.sheet_width_in && part?.sheet_length_in;
      const receiveMode = l.receiveMode || (isSheetMaterial ? 'SHEETS' : 'SQFT');
      
      if (isSheetMaterial && receiveMode === 'SHEETS') {
        const sheets = Number(l.sheetsReceived || l.qty);
        if (!Number.isFinite(sheets) || sheets <= 0) {
          errors.push('Sheets must be > 0');
        } else if (!Number.isInteger(sheets)) {
          errors.push('Sheets must be whole number');
        }
      } else {
        const qtyNum = Number(l.qty);
        if (!Number.isFinite(qtyNum) || qtyNum <= 0) errors.push('Qty must be > 0');
        if (part?.uom === 'EA' && !Number.isInteger(qtyNum)) {
          errors.push('EA quantities must be whole numbers');
        }
      }
      return { id: l.id, errors };
    });
  }, [lines, partsById]);
  const hasValidLines = useMemo(
    () => lines.length > 0 && lineErrors.every((l) => l.errors.length === 0),
    [lineErrors, lines.length]
  );

  const addLine = () => {
    if (!selectedPart) {
      toast({ title: 'Select a part', variant: 'destructive' });
      return;
    }
    const part = partsById.get(selectedPart);
    const isSheetMaterial = part?.uom === 'SQFT' && part?.sheet_width_in && part?.sheet_length_in;
    const qtyNum = Number(selectedQty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      toast({ title: 'Quantity must be greater than 0', variant: 'destructive' });
      return;
    }

    setLines((prev) => {
      const existing = prev.find((l) => l.partId === selectedPart);
      if (existing) {
        toast({ title: 'Merged duplicate line' });
        return prev.map((l) =>
          l.partId === selectedPart ? { ...l, qty: String(qtyNum + Number(l.qty || 0)) } : l
        );
      }
      const newLine: Line = {
        id: newId(),
        partId: selectedPart,
        qty: isSheetMaterial ? String((qtyNum * (part.sheet_width_in! * part.sheet_length_in!) / 144).toFixed(2)) : String(qtyNum),
        receiveMode: isSheetMaterial ? 'SHEETS' : undefined,
        sheetsReceived: isSheetMaterial ? String(qtyNum) : undefined,
      };
      return [...prev, newLine];
    });
    setSelectedPart('');
    setSelectedQty('1');
  };

  const updateLineQty = (id: string, value: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, qty: value } : l)));
  };
  const focusNextQty = (lineId: string, direction: 'forward' | 'backward' = 'forward') => {
    const idx = lines.findIndex((l) => l.id === lineId);
    if (idx === -1) return;
    const start = direction === 'forward' ? idx + 1 : idx - 1;
    const step = direction === 'forward' ? 1 : -1;
    for (let i = start; i >= 0 && i < lines.length; i += step) {
      const ref = qtyRefs.current[lines[i].id];
      if (ref && !ref.disabled && !ref.readOnly) {
        ref.focus();
        ref.select?.();
        return;
      }
    }
  };

  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const clearForm = () => {
    setVendorId('');
    setReference('');
    setReceivedDate(new Date().toISOString().slice(0, 10));
    setLines([]);
    setSelectedPart('');
    setSelectedQty('1');
  };

  const handlePost = () => {
    if (!receiveInventory) {
      toast({ title: 'Receive not available', variant: 'destructive' });
      return;
    }
    const prepared = lines
      .map((l) => {
        const part = partsById.get(l.partId);
        if (!part) return null;
        
        let quantity = Number(l.qty);
        let reasonSuffix = '';
        
        // Handle sheet material conversion
        if (part.uom === 'SQFT' && part.sheet_width_in && part.sheet_length_in && l.receiveMode === 'SHEETS') {
          const sheets = Number(l.sheetsReceived || l.qty);
          if (!Number.isFinite(sheets) || sheets <= 0 || !Number.isInteger(sheets)) {
            return null; // Will be filtered out
          }
          const sqftPerSheet = (part.sheet_width_in * part.sheet_length_in) / 144;
          const precision = part.qty_precision ?? 2;
          const multiplier = Math.pow(10, precision);
          quantity = Math.round(sheets * sqftPerSheet * multiplier) / multiplier;
          reasonSuffix = ` (Received ${sheets} sheet${sheets !== 1 ? 's' : ''}, ${part.sheet_width_in}"x${part.sheet_length_in}" = ${quantity.toFixed(precision)} SQFT)`;
        }
        
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return null;
        }
        
        return { part_id: l.partId, quantity, reasonSuffix };
      })
      .filter((l): l is { part_id: string; quantity: number; reasonSuffix: string } => l !== null);
      
    if (prepared.length === 0) {
      return;
    }
    
    // Note: reasonSuffix would need to be passed through receiveInventory if we want it in movements
    // For now, we'll just use the quantity conversion
    const result = receiveInventory({
      lines: prepared.map(({ part_id, quantity }) => ({ part_id, quantity })),
      vendor_id: vendorId ? vendorId : null,
      reference: reference.trim() || null,
      received_at: receivedDate ? new Date(receivedDate).toISOString() : undefined,
      source_type: poId ? 'PURCHASE_ORDER' : 'MANUAL',
      source_id: poId || null,
    });
    if (!result?.success) {
      toast({ title: 'Receive failed', description: result?.error || 'Unable to post receipt', variant: 'destructive' });
      return;
    }
    toast({ title: 'Receipt posted', description: `Received ${prepared.length} line(s) • QOH updated` });
    clearForm();
    navigate('/inventory');
  };

  useEffect(() => {
    if (selectedPart && !availableParts.find((p) => p.id === selectedPart)) {
      setSelectedPart('');
    }
  }, [availableParts, selectedPart]);

  useEffect(() => {
    if (!poId || prefilledPo.current) return;
    const po = purchaseOrders.find((o) => o.id === poId);
    if (!po) return;
    prefilledPo.current = true;
    setVendorId(po.vendor_id);
    setReference((prev) => prev || po.po_number || `PO:${poId}`);
    const remainingLines = purchaseOrderLines
      .filter((l) => l.purchase_order_id === poId)
      .map((l) => ({ line: l, remaining: l.ordered_quantity - l.received_quantity }))
      .filter((l) => l.remaining > 0);
    setLines(
      remainingLines.map((l) => ({
        id: newId(),
        partId: l.line.part_id,
        qty: String(l.remaining),
      }))
    );
  }, [poId, purchaseOrderLines, purchaseOrders]);

  return (
    <TooltipProvider>
      <div className="page-container space-y-4">
      <PageHeader 
        title={
          <span className="flex items-center gap-1">
            Receive Inventory
            <HelpTooltip content="Use this screen to bring parts into stock. Receiving increases QOH and records cost." />
          </span>
        } 
        subtitle="Increase stock with audit trail" 
        backTo="/inventory"
        actions={<ModuleHelpButton moduleKey="receiving" />}
      />

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Vendor</Label>
            <Select
              value={vendorId || NONE}
              onValueChange={(val) => setVendorId(val === NONE ? '' : val)}
              disabled={Boolean(poId)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Optional vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No vendor</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.vendor_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Reference
              <HelpTooltip content="Record the vendor invoice number for traceability and cost audits." />
            </Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice / packing slip #" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Received Date
              <HelpTooltip content="Date the parts were physically received. Used for reporting and cost history." />
            </Label>
            <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Add Part
              <HelpTooltip content="Pick the exact part number you received. This controls QOH and future picking." />
            </Label>
            <Select value={selectedPart} onValueChange={setSelectedPart}>
              <SelectTrigger>
                <SelectValue placeholder="Select part" />
              </SelectTrigger>
              <SelectContent>
                {availableParts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.part_number} — {p.description || 'No description'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Qty Received
              <HelpTooltip content="Enter what arrived today. Partial receiving is normal—don't force it to match the PO." />
            </Label>
            <Input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={selectedQty}
              onChange={(e) => setSelectedQty(e.target.value)}
            />
          </div>
          <div className="flex md:justify-end">
            <Button onClick={addLine}>Add Line</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2">Part</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-muted-foreground" colSpan={3}>
                    No lines added.
                  </td>
                </tr>
              ) : (
                lines.map((line) => {
                  const part = partsById.get(line.partId);
                  const errors = lineErrors.find((le) => le.id === line.id)?.errors ?? [];
                  const isSheetMaterial = part?.uom === 'SQFT' && part?.sheet_width_in && part?.sheet_length_in;
                  const receiveMode = line.receiveMode || (isSheetMaterial ? 'SHEETS' : 'SQFT');
                  const showSheetsInput = isSheetMaterial && receiveMode === 'SHEETS';
                  
                  return (
                    <tr key={line.id} className="border-t border-border/60">
                      <td className="py-2">
                        <div className="font-medium">{part?.part_number || 'Unknown part'}</div>
                        <div className="text-xs text-muted-foreground">{part?.description || '—'}</div>
                        {isSheetMaterial && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {part.sheet_width_in}" × {part.sheet_length_in}"
                          </div>
                        )}
                        {part && (() => {
                          const sheetsEq = formatSheetsEquivalent(part.quantity_on_hand ?? 0, part);
                          return sheetsEq ? (
                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              <div>On hand: {formatQtyWithUom(part.quantity_on_hand ?? 0, part)}</div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help">{sheetsEq}</div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="font-semibold text-xs mb-1">Derived from sheet size</div>
                                  <div className="text-xs">This is an estimated sheet count based on the part's sheet dimensions. Inventory is tracked in square feet (SQFT).</div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          ) : null;
                        })()}
                      </td>
                      <td className="py-2 text-right">
                        {isSheetMaterial && (
                          <div className="flex items-center gap-2 justify-end mb-2">
                            <div className="flex items-center gap-1">
                              <Select
                                value={receiveMode}
                                onValueChange={(value: 'SQFT' | 'SHEETS') => {
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.id === line.id
                                      ? { ...l, receiveMode: value, sheetsReceived: value === 'SHEETS' ? l.qty : undefined }
                                      : l
                                  )
                                );
                              }}
                            >
                              <SelectTrigger className="w-24 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SHEETS">Sheets</SelectItem>
                                <SelectItem value="SQFT">SQFT</SelectItem>
                              </SelectContent>
                            </Select>
                            <HelpTooltip content="Use for metal sheets tracked by width/length and area (sqft)." />
                            </div>
                          </div>
                        )}
                        {showSheetsInput ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 justify-end">
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                className="w-24"
                                value={line.sheetsReceived || line.qty}
                                onChange={(e) => {
                                const sheets = e.target.value;
                                const sqftPerSheet = ((part?.sheet_width_in ?? 0) * (part?.sheet_length_in ?? 0)) / 144;
                                const precision = part?.qty_precision ?? 2;
                                const multiplier = Math.pow(10, precision);
                                const sqft = Math.round(Number(sheets) * sqftPerSheet * multiplier) / multiplier;
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.id === line.id ? { ...l, sheetsReceived: sheets, qty: sqft.toString() } : l
                                  )
                                );
                              }}
                              onFocus={(e) => e.currentTarget.select()}
                              placeholder="Sheets"
                            />
                            <HelpTooltip content="Full sheet count from the vendor. Auto-converts to SQFT based on sheet dimensions." />
                            </div>
                            <div className="text-xs text-muted-foreground text-right flex items-center gap-1 justify-end">
                              = {line.qty} SQFT
                              <HelpTooltip content="Auto-calculated from width × length. Used for consumption and remnants." />
                            </div>
                          </div>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            step={part?.uom === 'EA' ? '1' : '0.01'}
                            className="w-24 ml-auto"
                            value={line.qty}
                            onChange={(e) => updateLineQty(line.id, e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                focusNextQty(line.id, e.shiftKey ? 'backward' : 'forward');
                                return;
                              }
                              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
                                e.preventDefault();
                                if (hasValidLines) handlePost();
                                return;
                              }
                              if (e.key === 'Escape') {
                                e.currentTarget.blur();
                                return;
                              }
                            }}
                            ref={(el) => {
                              qtyRefs.current[line.id] = el;
                            }}
                          />
                        )}
                        {errors.length > 0 && (
                          <p className="text-xs text-destructive mt-1 text-right">{errors.join(' • ')}</p>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-end gap-2 items-start">
          {!hasValidLines && (
            <div className="text-sm text-destructive mr-auto">
              <ul className="list-disc list-inside space-y-1">
                {lines.length === 0 && <li>Add at least one line.</li>}
                {lineErrors.some((l) => l.errors.includes('Part required')) && <li>All lines need a part.</li>}
                {lineErrors.some((l) => l.errors.includes('Qty must be > 0')) && <li>Quantities must be greater than 0.</li>}
              </ul>
            </div>
          )}
          <Button variant="outline" onClick={clearForm}>
            Clear
          </Button>
          <div className="flex items-center gap-1">
            <Button onClick={handlePost} disabled={!hasValidLines}>
              Post Receipt
            </Button>
            <HelpTooltip content="Finalizes the receipt and updates inventory. Use when the slip matches what arrived." />
          </div>
        </div>
      </Card>
    </div>
    </TooltipProvider>
  );
}
