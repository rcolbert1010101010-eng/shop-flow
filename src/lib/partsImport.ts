import type { Part } from '@/types';

export type ImportablePartRow = {
  part_number: string;
  description: string;
  cost: number;
  selling_price: number;
  quantity_on_hand: number;
  vendor: string;
  category: string;
  is_active: boolean;
};

export type ImportPreviewRow = ImportablePartRow & {
  index: number;
  errors: string[];
  raw: Record<string, string>;
};

export type ImportParseResult = {
  delimiter: ',' | '\t';
  headers: string[];
  rows: ImportPreviewRow[];
  hasErrors: boolean;
};

const NORMALIZED_HEADERS: Record<string, keyof ImportablePartRow> = {
  part_number: 'part_number',
  partnumber: 'part_number',
  'part number': 'part_number',
  description: 'description',
  cost: 'cost',
  selling_price: 'selling_price',
  sellingprice: 'selling_price',
  price: 'selling_price',
  quantity_on_hand: 'quantity_on_hand',
  quantity: 'quantity_on_hand',
  qty: 'quantity_on_hand',
  vendor: 'vendor',
  vendor_name: 'vendor',
  category: 'category',
  category_name: 'category',
  is_active: 'is_active',
  active: 'is_active',
};

const normalizeHeader = (header: string) => {
  const normalized = header.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 _-]/g, '');
  return NORMALIZED_HEADERS[normalized] ?? null;
};

const smartSplit = (line: string, delimiter: ',' | '\t') => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((v) => v.trim());
};

const parseBoolean = (value: string | undefined) => {
  if (value == null) return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (['true', 't', 'yes', 'y', '1', 'active'].includes(normalized)) return true;
  if (['false', 'f', 'no', 'n', '0', 'inactive'].includes(normalized)) return false;
  return null;
};

const parseNumber = (value: string | undefined) => {
  if (value == null || value.trim() === '') return null;
  const normalized = value.replace(/[$,%]/g, '');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const pickDelimiter = (headerLine: string): ',' | '\t' => {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  if (tabCount > commaCount) return '\t';
  return ',' as const;
};

export function parsePartsImport(
  text: string,
  options: {
    existingPartNumbers?: Part[] | string[];
  } = {}
): ImportParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { delimiter: ',', headers: [], rows: [], hasErrors: false };
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0] ?? '';
  const delimiter = pickDelimiter(headerLine);
  const headerTokens = smartSplit(headerLine, delimiter);

  const headerMap: (keyof ImportablePartRow | null)[] = headerTokens.map((h) => normalizeHeader(h));
  const headers = headerMap.filter((h): h is keyof ImportablePartRow => Boolean(h));

  const existingParts = new Set<string>(
    (options.existingPartNumbers ?? []).map((p) => (typeof p === 'string' ? p : (p as Part).part_number).trim().toLowerCase())
  );
  const batchParts = new Set<string>();
  const rows: ImportPreviewRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const tokens = smartSplit(line, delimiter);
    const raw: Record<string, string> = {};
    headerTokens.forEach((header, idx) => {
      raw[header] = tokens[idx] ?? '';
    });

    const entry: ImportablePartRow = {
      part_number: '',
      description: '',
      cost: 0,
      selling_price: 0,
      quantity_on_hand: 0,
      vendor: '',
      category: '',
      is_active: true,
    };
    const errors: string[] = [];

    headerMap.forEach((mapped, idx) => {
      if (!mapped) return;
      const value = tokens[idx] ?? '';
      switch (mapped) {
        case 'part_number':
          entry.part_number = value.trim();
          break;
        case 'description':
          entry.description = value.trim();
          break;
        case 'vendor':
          entry.vendor = value.trim();
          break;
        case 'category':
          entry.category = value.trim();
          break;
        case 'cost':
          entry.cost = parseNumber(value) ?? NaN;
          break;
        case 'selling_price':
          entry.selling_price = parseNumber(value) ?? NaN;
          break;
        case 'quantity_on_hand':
          entry.quantity_on_hand = parseNumber(value) ?? 0;
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

    if (!entry.part_number) {
      errors.push('part_number is required');
    } else {
      const pn = entry.part_number.toLowerCase();
      if (batchParts.has(pn)) {
        errors.push('Duplicate part_number in import');
      } else if (existingParts.has(pn)) {
        errors.push('part_number already exists');
      }
      batchParts.add(pn);
    }
    if (!entry.vendor) errors.push('vendor is required');
    if (!entry.category) errors.push('category is required');
    if (!Number.isFinite(entry.cost)) errors.push('cost must be numeric');
    if (!Number.isFinite(entry.selling_price)) errors.push('selling_price must be numeric');
    if (!Number.isFinite(entry.quantity_on_hand) || entry.quantity_on_hand < 0) {
      errors.push('quantity_on_hand must be zero or positive');
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

const runParserSelfTest = () => {
  const sample = `part_number,description,cost,selling_price,quantity_on_hand,vendor,category,is_active
ABC-1,Test Part,10.5,15,5,Vendor A,Category X,yes
ABC-2,Another,7.25,12,0,Vendor A,Category X,true`;
  const result = parsePartsImport(sample, { existingPartNumbers: ['zzz'] });
  if (result.rows.length !== 2) throw new Error('Expected two rows');
  if (result.rows.some((r) => r.errors.length > 0)) throw new Error('Self-test rows should be valid');
  const dup = parsePartsImport(`${sample}\nABC-1,Duplicate,5,10,1,Vendor A,Category X,true`, {
    existingPartNumbers: ['abc-1'],
  });
  if (!dup.rows.some((r) => r.errors.some((e) => e.includes('already exists')))) {
    throw new Error('Duplicate check failed');
  }
};

if (process.env.NODE_ENV === 'development') {
  try {
    runParserSelfTest();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Import parser self-test failed', err);
  }
}
