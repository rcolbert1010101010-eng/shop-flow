import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhone(input?: string | null): string {
  if (!input) return '';
  return input.replace(/\D/g, '');
}

export function moneySafe(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function moneyRound(value: unknown): number {
  const safe = moneySafe(value);
  return Number(Math.round((safe + Number.EPSILON) * 100) / 100);
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

/**
 * Checks if a part is a sheet material (SQFT with dimensions, not a remnant).
 */
export function isSheetMaterialPart(part: { uom?: 'EA' | 'FT' | 'SQFT' | null; sheet_width_in?: number | null; sheet_length_in?: number | null; is_remnant?: boolean | null } | null | undefined): boolean {
  if (!part) return false;
  if (part.is_remnant) return false;
  if (part.uom !== 'SQFT') return false;
  const width = part.sheet_width_in ?? 0;
  const length = part.sheet_length_in ?? 0;
  return width > 0 && length > 0;
}

/**
 * Gets the square feet per sheet for a sheet material part.
 */
export function getSqftPerSheet(part: { sheet_width_in?: number | null; sheet_length_in?: number | null } | null | undefined): number | null {
  if (!part) return null;
  const width = part.sheet_width_in ?? 0;
  const length = part.sheet_length_in ?? 0;
  if (width <= 0 || length <= 0) return null;
  return (width * length) / 144;
}

/**
 * Formats a quantity in SQFT as an equivalent number of sheets.
 * Returns null if the part is not a sheet material.
 */
export function formatSheetsEquivalent(qtySqft: number, part: { uom?: 'EA' | 'FT' | 'SQFT' | null; sheet_width_in?: number | null; sheet_length_in?: number | null; is_remnant?: boolean } | null | undefined): string | null {
  if (!isSheetMaterialPart(part)) return null;
  
  const sqftPerSheet = getSqftPerSheet(part);
  if (!sqftPerSheet) return null;
  
  const sheets = qtySqft / sqftPerSheet;
  const width = part?.sheet_width_in ?? 0;
  const length = part?.sheet_length_in ?? 0;
  
  return `≈ ${sheets.toFixed(2)} sheets (${width}×${length})`;
}