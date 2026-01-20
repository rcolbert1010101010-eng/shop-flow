export type ImportDelimiter = ',' | '\t';

export const smartSplit = (line: string, delimiter: ImportDelimiter) => {
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

export const parseBoolean = (value: string | undefined, defaultValue = true) => {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (['true', 't', 'yes', 'y', '1', 'active'].includes(normalized)) return true;
  if (['false', 'f', 'no', 'n', '0', 'inactive'].includes(normalized)) return false;
  return null;
};

export const parseNumber = (value: string | undefined) => {
  if (value == null || value.trim() === '') return null;
  const normalized = value.replace(/[$,%]/g, '');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

export const pickDelimiter = (headerLine: string): ImportDelimiter => {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  if (tabCount > commaCount) return '\t';
  return ',' as const;
};

export const normalizeHeader = <T extends string>(
  header: string,
  mapping: Record<string, T | null>
): T | null => {
  const normalized = header.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 _-]/g, '');
  return mapping[normalized] ?? null;
};
