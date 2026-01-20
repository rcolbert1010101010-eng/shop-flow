import type { Customer } from '@/types';
import { normalizeHeader, parseBoolean, pickDelimiter, smartSplit } from './importUtils';
import type { ImportDelimiter } from './importUtils';

export type ImportableCustomerRow = {
  name: string;
  phone: string | null;
  email: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  is_active: boolean;
  customer_number: string | null;
  account_number: string | null;
};

export type ImportPreviewRow = ImportableCustomerRow & {
  index: number;
  errors: string[];
  raw: Record<string, string>;
};

export type ImportParseResult = {
  delimiter: ImportDelimiter;
  headers: (keyof ImportableCustomerRow)[];
  rows: ImportPreviewRow[];
  hasErrors: boolean;
};

const NORMALIZED_HEADERS: Record<string, keyof ImportableCustomerRow | null> = {
  name: 'name',
  customer: 'name',
  'customer name': 'name',
  customer_name: 'name',
  company: 'name',
  'company name': 'name',
  phone: 'phone',
  'phone number': 'phone',
  telephone: 'phone',
  tel: 'phone',
  email: 'email',
  'email address': 'email',
  address: 'address1',
  address1: 'address1',
  'address 1': 'address1',
  street: 'address1',
  street1: 'address1',
  address2: 'address2',
  'address 2': 'address2',
  street2: 'address2',
  city: 'city',
  town: 'city',
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
  customer_number: 'customer_number',
  'customer number': 'customer_number',
  customer_no: 'customer_number',
  'customer #': 'customer_number',
  account_number: 'account_number',
  'account number': 'account_number',
  account_no: 'account_number',
  'account #': 'account_number',
};

const emailIsValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function parseCustomersImport(input: string, existingCustomers: Customer[] = []): ImportParseResult {
  const normalizedText = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const trimmed = normalizedText.trim();
  if (!trimmed) {
    return { delimiter: ',', headers: [], rows: [], hasErrors: false };
  }

  const lines = trimmed.split(/\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0] ?? '';
  const delimiter = pickDelimiter(headerLine);
  const headerTokens = smartSplit(headerLine, delimiter);

  const headerMap: (keyof ImportableCustomerRow | null)[] = headerTokens.map((h) =>
    normalizeHeader(h, NORMALIZED_HEADERS)
  );
  const headers = headerMap.filter((h): h is keyof ImportableCustomerRow => Boolean(h));

  const batchNames = new Set<string>();
  const existingNames = new Set(
    existingCustomers.map((c) => c.company_name?.trim().toLowerCase()).filter(Boolean) as string[]
  );
  const batchNumbers = new Set<string>();
  const batchAccounts = new Set<string>();

  const rows: ImportPreviewRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const tokens = smartSplit(line, delimiter);
    const raw: Record<string, string> = {};
    headerTokens.forEach((header, idx) => {
      raw[header] = tokens[idx] ?? '';
    });

    const entry: ImportableCustomerRow = {
      name: '',
      phone: null,
      email: null,
      address1: null,
      address2: null,
      city: null,
      state: null,
      zip: null,
      notes: null,
      is_active: true,
      customer_number: null,
      account_number: null,
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
        case 'address2':
          entry.address2 = value.trim() || null;
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
        case 'customer_number':
          entry.customer_number = value.trim() || null;
          break;
        case 'account_number':
          entry.account_number = value.trim() || null;
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
        // Allow updates; no error.
      }
    }

    if (entry.email && !emailIsValid(entry.email)) {
      errors.push('email looks invalid');
    }

    if (entry.customer_number) {
      const numKey = entry.customer_number.toLowerCase();
      if (batchNumbers.has(numKey)) {
        errors.push('Duplicate customer_number in import');
      } else {
        batchNumbers.add(numKey);
      }
    }

    if (entry.account_number) {
      const acctKey = entry.account_number.toLowerCase();
      if (batchAccounts.has(acctKey)) {
        errors.push('Duplicate account_number in import');
      } else {
        batchAccounts.add(acctKey);
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
