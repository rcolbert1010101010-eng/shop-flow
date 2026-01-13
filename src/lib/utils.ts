import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhone(input?: string | null): string {
  if (!input) return '';
  return input.replace(/\D/g, '');
}

export type NormalizeQtyResult = { ok: true; qty: number } | { ok: false; error: string };

/**
 * Normalizes a quantity input based on part UOM rules.
 * - EA: must be integer
 * - FT/SQFT: allows decimals, rounds to qty_precision
 */
export function normalizeQty(
  part: { uom?: 'EA' | 'FT' | 'SQFT' | null; qty_precision?: number | null } | null | undefined,
  rawInput: string | number
): NormalizeQtyResult {
  const parsed = typeof rawInput === 'number' ? rawInput : parseFloat(String(rawInput));
  
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: 'Quantity must be a number' };
  }
  
  if (parsed <= 0) {
    return { ok: false, error: 'Quantity must be greater than 0' };
  }
  
  const uom = part?.uom ?? 'EA';
  const precision = part?.qty_precision ?? (uom === 'EA' ? 0 : 2);
  
  // EA must be integer
  if (uom === 'EA' && !Number.isInteger(parsed)) {
    return { ok: false, error: 'EA quantities must be whole numbers' };
  }
  
  // FT/SQFT: round to precision
  let normalizedQty = parsed;
  if (uom === 'FT' || uom === 'SQFT') {
    const multiplier = Math.pow(10, precision);
    normalizedQty = Math.round(parsed * multiplier) / multiplier;
  } else {
    // EA: ensure integer
    normalizedQty = Math.round(parsed);
  }
  
  return { ok: true, qty: normalizedQty };
}

/**
 * Formats a quantity with UOM for display.
 */
export function formatQtyWithUom(qty: number, part: { uom?: 'EA' | 'FT' | 'SQFT' | null; qty_precision?: number | null } | null | undefined): string {
  const uom = part?.uom ?? 'EA';
  const precision = part?.qty_precision ?? (uom === 'EA' ? 0 : 2);
  
  if (uom === 'EA') {
    return `${Math.round(qty)} ${uom}`;
  }
  
  const formatted = qty.toFixed(precision).replace(/\.?0+$/, '');
  return `${formatted} ${uom}`;
}