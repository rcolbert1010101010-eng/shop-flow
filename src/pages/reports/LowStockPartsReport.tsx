import { useMemo, useState } from 'react';
import { ReportLayout } from '@/components/reports/ReportLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useRepos } from '@/repos';

type LowStockRow = {
  id: string;
  part_number: string;
  description: string;
  vendorName: string;
  categoryName: string;
  quantity_on_hand: number;
  min_qty: number;
  selling_price: number;
  shortage: number;
};

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatMoney = (value: number | string | null | undefined) => `$${toNumber(value).toFixed(2)}`;

export default function LowStockPartsReport() {
  const repos = useRepos();
  const { parts } = repos.parts;
  const { vendors } = repos.vendors;
  const { categories } = repos.categories;

  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [includeZero, setIncludeZero] = useState(false);

  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.id, v.vendor_name])), [vendors]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.category_name])), [categories]);

  const lowStockRows = useMemo<LowStockRow[]>(() => {
    return parts
      .filter((part) => {
        const isLowStock = part.min_qty !== null && part.quantity_on_hand <= (part.min_qty ?? 0);
        const isZeroOrNegative = includeZero && part.quantity_on_hand <= 0;
        return part.is_active && (isLowStock || isZeroOrNegative);
      })
      .map((part) => {
        const vendorName = vendorMap.get(part.vendor_id) || 'Unassigned';
        const categoryName = categoryMap.get(part.category_id) || 'Uncategorized';
        const shortage = Math.max((part.min_qty ?? 0) - toNumber(part.quantity_on_hand), 0);
        return {
          id: part.id,
          part_number: part.part_number,
          description: part.description || '',
          vendorName,
          categoryName,
          quantity_on_hand: toNumber(part.quantity_on_hand),
          min_qty: toNumber(part.min_qty ?? 0),
          selling_price: toNumber(part.selling_price),
          shortage,
        };
      });
  }, [categoryMap, includeZero, parts, vendorMap]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return lowStockRows.filter((row) => {
      const matchesVendor = vendorFilter === 'all' || row.vendorName === vendorFilter;
      const matchesQuery =
        query.length === 0 ||
        row.part_number.toLowerCase().includes(query) ||
        row.description.toLowerCase().includes(query) ||
        row.vendorName.toLowerCase().includes(query) ||
        row.categoryName.toLowerCase().includes(query);
      return matchesVendor && matchesQuery;
    });
  }, [lowStockRows, search, vendorFilter]);

  const summary = useMemo(() => {
    const totalShortage = filteredRows.reduce((sum, row) => sum + row.shortage, 0);
    const reorderValue = filteredRows.reduce(
      (sum, row) => sum + row.shortage * toNumber(row.selling_price),
      0
    );
    const vendorCount = new Set(filteredRows.map((row) => row.vendorName)).size;
    return {
      totalShortage,
      reorderValue,
      vendorCount,
    };
  }, [filteredRows]);

  const vendorOptions = useMemo(() => {
    const unique = Array.from(new Set(lowStockRows.map((row) => row.vendorName))).sort();
    return unique;
  }, [lowStockRows]);

  return (
    <ReportLayout
      title="Low Stock Parts"
      description="Active parts that are at or below their minimum quantity."
      exportConfig={{
        filename: 'low-stock-parts',
        columns: [
          { key: 'part_number', header: 'Part #' },
          { key: 'description', header: 'Description' },
          { key: 'vendorName', header: 'Vendor' },
          { key: 'categoryName', header: 'Category' },
          { key: 'quantity_on_hand', header: 'QOH' },
          { key: 'min_qty', header: 'Min Qty' },
          { key: 'selling_price', header: 'Price', format: (val) => formatMoney(Number(val)) },
        ],
        rows: filteredRows,
      }}
      filters={
        <>
          <Select value={vendorFilter} onValueChange={(val) => setVendorFilter(val)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vendors</SelectItem>
              {vendorOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch checked={includeZero} onCheckedChange={setIncludeZero} id="include-zero" />
            <Label htmlFor="include-zero" className="text-sm text-muted-foreground">
              Include zero / negative
            </Label>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parts..."
            className="w-64"
          />
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{filteredRows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Vendors Impacted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.vendorCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Reorder Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoney(summary.reorderValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Based on shortage x sell price
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Low Stock Parts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">QOH</TableHead>
                <TableHead className="text-right">Min Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    All set. No parts are below minimums.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.part_number}</TableCell>
                    <TableCell>{row.description || '-'}</TableCell>
                    <TableCell>{row.vendorName}</TableCell>
                    <TableCell>{row.categoryName}</TableCell>
                    <TableCell className="text-right">{row.quantity_on_hand}</TableCell>
                    <TableCell className="text-right">{row.min_qty}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.selling_price)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </ReportLayout>
  );
}
