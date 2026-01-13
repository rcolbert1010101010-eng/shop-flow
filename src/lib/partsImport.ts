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
  min_qty: number | null;
  max_qty: number | null;
  bin_location: string | null;
  location: string | null;
  has_core: boolean | null;
  core_cost: number | null;
};

export type ImportPreviewRow = ImportablePartRow & {
  index: number;
  errors: string[];
  raw: Record<string, string>;
};

export type ImportParseResult = {
  delimiter: ',' | '\t';
  headers: (keyof ImportablePartRow)[];
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
  bin_location: 'bin_location',
  bin: 'bin_location',
  'bin location': 'bin_location',
  location: 'location',
  loc: 'location',
  min_qty: 'min_qty',
  minqty: 'min_qty',
  min: 'min_qty',
  'min qty': 'min_qty',
  max_qty: 'max_qty',
  maxqty: 'max_qty',
  max: 'max_qty',
  'max qty': 'max_qty',
  has_core: 'has_core',
  'has core': 'has_core',
  core_required: 'has_core',
  'core required': 'has_core',
  core_cost: 'core_cost',
  'core cost': 'core_cost',
  core_charge: 'core_cost',
  'core charge': 'core_cost',
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
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const trimmed = normalizedText.trim();
  if (!trimmed) {
    return { delimiter: ',', headers: [], rows: [], hasErrors: false };
  }

  const lines = trimmed.split(/\n/).filter((line) => line.trim().length > 0);
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
      min_qty: null,
      max_qty: null,
      bin_location: null,
      location: null,
      has_core: null,
      core_cost: null,
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
        case 'bin_location':
          entry.bin_location = value.trim() || null;
          break;
        case 'location':
          entry.location = value.trim() || null;
          break;
        case 'min_qty': {
          const parsed = parseNumber(value);
          if (value.trim() === '') {
            entry.min_qty = null;
          } else if (parsed == null || parsed < 0) {
            errors.push('min_qty must be zero or positive');
          } else {
            entry.min_qty = parsed;
          }
          break;
        }
        case 'max_qty': {
          const parsed = parseNumber(value);
          if (value.trim() === '') {
            entry.max_qty = null;
          } else if (parsed == null || parsed < 0) {
            errors.push('max_qty must be zero or positive');
          } else {
            entry.max_qty = parsed;
          }
          break;
        }
        case 'has_core': {
          const boolVal = parseBoolean(value);
          if (value.trim() === '') {
            entry.has_core = null;
          } else if (boolVal == null) {
            errors.push('has_core must be true/false/yes/no/1/0');
          } else {
            entry.has_core = boolVal;
          }
          break;
        }
        case 'core_cost': {
          const parsed = parseNumber(value);
          if (value.trim() === '') {
            entry.core_cost = null;
          } else if (parsed == null || parsed < 0) {
            errors.push('core_cost must be zero or positive');
          } else {
            entry.core_cost = parsed;
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
    if (
      entry.min_qty != null &&
      entry.max_qty != null &&
      entry.max_qty < entry.min_qty
    ) {
      errors.push('max_qty must be greater than or equal to min_qty');
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
  const sample = `part_number\tdescription\tcost\tselling_price\tquantity_on_hand\tvendor\tcategory\tis_active\tbin_location\tmin_qty\tmax_qty
ABC-1\tTest Part\t10.5\t15\t5\tVendor A\tCategory X\tyes\tA1\t1\t5
ABC-2\tAnother\t7.25\t12\t0\tVendor A\tCategory X\ttrue\tB2\t\t10`;
  const result = parsePartsImport(sample, { existingPartNumbers: ['zzz'] });
  if (result.rows.length !== 2) throw new Error('Expected two rows');
  if (result.rows.some((r) => r.errors.length > 0)) throw new Error('Self-test rows should be valid');
  if (result.delimiter !== '\t') throw new Error('Delimiter detection failed for tabs');
  if (result.rows[0].bin_location !== 'A1') throw new Error('Bin parsing failed');
  if (result.rows[1].max_qty !== 10) throw new Error('Max qty parsing failed');
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
