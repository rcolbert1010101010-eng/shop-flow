import type { Vendor } from '@/types';
import { normalizeHeader, parseBoolean, pickDelimiter, smartSplit } from './importUtils';
import type { ImportDelimiter } from './importUtils';

export type ImportableVendorRow = {
  name: string;
  phone: string | null;
  email: string | null;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  is_active: boolean;
};

export type ImportPreviewRow = ImportableVendorRow & {
  index: number;
  errors: string[];
  raw: Record<string, string>;
};

export type ImportParseResult = {
  delimiter: ImportDelimiter;
  headers: (keyof ImportableVendorRow)[];
  rows: ImportPreviewRow[];
  hasErrors: boolean;
};

const NORMALIZED_HEADERS: Record<string, keyof ImportableVendorRow | null> = {
  name: 'name',
  vendor: 'name',
  vendor_name: 'name',
  'vendor name': 'name',
  company: 'name',
  phone: 'phone',
  telephone: 'phone',
  'phone number': 'phone',
  tel: 'phone',
  email: 'email',
  'email address': 'email',
  address: 'address1',
  address1: 'address1',
  'address 1': 'address1',
  street: 'address1',
  city: 'city',
  state: 'state',
  province: 'state',
  region: 'state',
  zip: 'zip',
  zipcode: 'zip',
  'zip code': 'zip',
  postal: 'zip',
  'postal code': 'zip',
  notes: 'notes',
  note: 'notes',
  is_active: 'is_active',
  active: 'is_active',
  status: 'is_active',
};

const emailIsValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function parseVendorsImport(input: string, existingVendors: Vendor[] = []): ImportParseResult {
  const normalizedText = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const trimmed = normalizedText.trim();
  if (!trimmed) {
    return { delimiter: ',', headers: [], rows: [], hasErrors: false };
  }

  const lines = trimmed.split(/\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0] ?? '';
  const delimiter = pickDelimiter(headerLine);
  const headerTokens = smartSplit(headerLine, delimiter);

  const headerMap: (keyof ImportableVendorRow | null)[] = headerTokens.map((h) =>
    normalizeHeader(h, NORMALIZED_HEADERS)
  );
  const headers = headerMap.filter((h): h is keyof ImportableVendorRow => Boolean(h));

  const batchNames = new Set<string>();
  const existingNames = new Set(
    existingVendors.map((v) => v.vendor_name?.trim().toLowerCase()).filter(Boolean) as string[]
  );

  const rows: ImportPreviewRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const tokens = smartSplit(line, delimiter);
    const raw: Record<string, string> = {};
    headerTokens.forEach((header, idx) => {
      raw[header] = tokens[idx] ?? '';
    });

    const entry: ImportableVendorRow = {
      name: '',
      phone: null,
      email: null,
      address1: null,
      city: null,
      state: null,
      zip: null,
      notes: null,
      is_active: true,
    };
    const errors: string[] = [];

    headerMap.forEach((mapped, idx) => {
      if (!mapped) return;
      const value = tokens[idx] ?? '';
      switch (mapped) {
        case 'name':
          entry.name = value.trim();
          break;
        case 'phone':
          entry.phone = value.trim() || null;
          break;
        case 'email':
          entry.email = value.trim() || null;
          break;
        case 'address1':
          entry.address1 = value.trim() || null;
          break;
        case 'city':
          entry.city = value.trim() || null;
          break;
        case 'state':
          entry.state = value.trim() || null;
          break;
        case 'zip':
          entry.zip = value.trim() || null;
          break;
        case 'notes':
          entry.notes = value.trim() || null;
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

    if (!entry.name) {
      errors.push('name is required');
    } else {
      const key = entry.name.toLowerCase();
      if (batchNames.has(key)) {
        errors.push('Duplicate name in import');
      } else {
        batchNames.add(key);
      }
      if (existingNames.has(key)) {
        // Allowed for updates.
      }
    }

    if (entry.email && !emailIsValid(entry.email)) {
      errors.push('email looks invalid');
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
