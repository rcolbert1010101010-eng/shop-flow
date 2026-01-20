import type { Unit } from '@/types';
import { normalizeHeader, parseBoolean, parseNumber, pickDelimiter, smartSplit } from './importUtils';
import type { ImportDelimiter } from './importUtils';

export type ImportableUnitRow = {
  unit_number: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  plate: string | null;
  notes: string | null;
  is_active: boolean;
  customer: string | null;
};

export type ImportPreviewRow = ImportableUnitRow & {
  index: number;
  errors: string[];
  raw: Record<string, string>;
};

export type ImportParseResult = {
  delimiter: ImportDelimiter;
  headers: (keyof ImportableUnitRow)[];
  rows: ImportPreviewRow[];
  hasErrors: boolean;
};

const NORMALIZED_HEADERS: Record<string, keyof ImportableUnitRow | null> = {
  unit: 'unit_number',
  'unit number': 'unit_number',
  unit_number: 'unit_number',
  unitname: 'unit_number',
  'unit name': 'unit_number',
  identifier: 'unit_number',
  vin: 'vin',
  year: 'year',
  make: 'make',
  manufacturer: 'make',
  model: 'model',
  plate: 'plate',
  'license plate': 'plate',
  license_plate: 'plate',
  notes: 'notes',
  note: 'notes',
  is_active: 'is_active',
  active: 'is_active',
  status: 'is_active',
  customer: 'customer',
  customer_name: 'customer',
  'customer name': 'customer',
};

export function parseUnitsImport(input: string, existingUnits: Unit[] = []): ImportParseResult {
  const normalizedText = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const trimmed = normalizedText.trim();
  if (!trimmed) {
    return { delimiter: ',', headers: [], rows: [], hasErrors: false };
  }

  const lines = trimmed.split(/\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0] ?? '';
  const delimiter = pickDelimiter(headerLine);
  const headerTokens = smartSplit(headerLine, delimiter);

  const headerMap: (keyof ImportableUnitRow | null)[] = headerTokens.map((h) =>
    normalizeHeader(h, NORMALIZED_HEADERS)
  );
  const headers = headerMap.filter((h): h is keyof ImportableUnitRow => Boolean(h));

  const batchUnitNumbers = new Set<string>();
  const batchVins = new Set<string>();
  const rows: ImportPreviewRow[] = [];

  // Keep sets for displaying update intent (no validation).
  const existingUnitNumbers = new Set(
    existingUnits.map((u) => u.unit_name?.trim().toLowerCase()).filter(Boolean) as string[]
  );
  const existingVins = new Set(
    existingUnits.map((u) => u.vin?.trim().toLowerCase()).filter(Boolean) as string[]
  );

  const currentYear = new Date().getFullYear();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const tokens = smartSplit(line, delimiter);
    const raw: Record<string, string> = {};
    headerTokens.forEach((header, idx) => {
      raw[header] = tokens[idx] ?? '';
    });

    const entry: ImportableUnitRow = {
      unit_number: '',
      vin: null,
      year: null,
      make: null,
      model: null,
      plate: null,
      notes: null,
      is_active: true,
      customer: null,
    };
    const errors: string[] = [];

    headerMap.forEach((mapped, idx) => {
      if (!mapped) return;
      const value = tokens[idx] ?? '';
      switch (mapped) {
        case 'unit_number':
          entry.unit_number = value.trim();
          break;
        case 'vin':
          entry.vin = value.trim() || null;
          break;
        case 'year': {
          const parsed = parseNumber(value);
          if (value.trim() === '') {
            entry.year = null;
          } else if (parsed == null || !Number.isInteger(parsed) || parsed < 1900 || parsed > currentYear + 1) {
            errors.push('year must be a 4-digit number');
          } else {
            entry.year = parsed;
          }
          break;
        }
        case 'make':
          entry.make = value.trim() || null;
          break;
        case 'model':
          entry.model = value.trim() || null;
          break;
        case 'plate':
          entry.plate = value.trim() || null;
          break;
        case 'notes':
          entry.notes = value.trim() || null;
          break;
        case 'customer':
          entry.customer = value.trim() || null;
          break;
        case 'is_active': {
          const boolVal = parseBoolean(value);
          if (boolVal == null) {
            errors.push('is_active must be true/false/yes/no/1/0');
          } else {
            entry.is_active = boolVal;
          }
          break;
        }
        default:
          break;
      }
    });

    const hasIdentifier = Boolean(entry.unit_number || entry.vin);
    if (!hasIdentifier) {
      errors.push('unit_number or vin is required');
    }

    if (entry.unit_number) {
      const key = entry.unit_number.toLowerCase();
      if (batchUnitNumbers.has(key)) {
        errors.push('Duplicate unit_number in import');
      } else {
        batchUnitNumbers.add(key);
      }
      if (existingUnitNumbers.has(key)) {
        // Indicates update; not an error.
      }
    }

    if (entry.vin) {
      const key = entry.vin.toLowerCase();
      if (batchVins.has(key)) {
        errors.push('Duplicate vin in import');
      } else {
        batchVins.add(key);
      }
      if (existingVins.has(key)) {
        // Indicates update; not an error.
      }
    }

    rows.push({
      ...entry,
      index: i,
      errors,
      raw,
    });
  }

  const hasErrors = rows.some((row) => row.errors.length > 0);
  return { delimiter, headers, rows, hasErrors };
}
