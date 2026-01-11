export type CsvColumn<T> = {
  key: keyof T | string;
  header: string;
  format?: (value: unknown, row: T) => string | number | null | undefined;
};

type CsvOptions<T> = {
  filename: string;
  columns: CsvColumn<T>[];
  rows: T[];
};

const escapeCsvValue = (value: unknown) => {
  if (value === null || value === undefined) return '""';
  const str = typeof value === 'string' ? value : String(value);
  const escaped = str.replace(/"/g, '""').replace(/\r?\n/g, '\n');
  return `"${escaped}"`;
};

export function exportCsv<T>({ filename, columns, rows }: CsvOptions<T>) {
  if (typeof window === 'undefined') return;
  const safeName = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;

  const header = columns.map((col) => escapeCsvValue(col.header)).join(',');
  const data = rows.map((row) =>
    columns
      .map((col) => {
        const raw = col.format ? col.format((row as any)[col.key as keyof T], row) : (row as any)[col.key as keyof T];
        return escapeCsvValue(raw ?? '');
      })
      .join(',')
  );

  const csvContent = [header, ...data].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
