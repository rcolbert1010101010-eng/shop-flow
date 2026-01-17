import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRepos } from '@/repos';
import { computeReturnsWarrantyReport } from '@/services/returnsWarrantyReporting';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';
import { usePermissions } from '@/security/usePermissions';
import { useToast } from '@/hooks/use-toast';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};
const formatMoney = (value: number | string | null | undefined) => `$${toNumber(value).toFixed(2)}`;

const DATE_OPTIONS = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'all', label: 'All' },
] as const;

export default function ReturnsWarrantyReport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can, isReady } = usePermissions();
  const canViewReports = can('reports.view');
  const repos = useRepos();
  const { returns, returnLines } = repos.returns;
  const { warrantyClaims, warrantyClaimLines } = repos.warranty;
  const { vendors } = repos.vendors;
  const { parts } = repos.parts;
  const [range, setRange] = useState<(typeof DATE_OPTIONS)[number]['value']>('90');
  const [vendorFilter, setVendorFilter] = useState('__ALL__');

  useEffect(() => {
    if (!isReady) return;
    if (!canViewReports) {
      toast({
        title: "You don't have permission to view reports.",
        variant: 'destructive',
      });
      navigate('/', { replace: true });
    }
  }, [canViewReports, isReady, navigate, toast]);

  const report = useMemo(() => {
    return computeReturnsWarrantyReport({
      returns,
      returnLines,
      claims: warrantyClaims,
      claimLines: warrantyClaimLines,
      vendors,
      parts,
      range: range as '30' | '90' | '365' | 'all',
      vendorId: vendorFilter === '__ALL__' ? undefined : vendorFilter,
    });
  }, [returns, returnLines, warrantyClaims, warrantyClaimLines, vendors, parts, range, vendorFilter]);
  const hasAnyReturns = returns.length > 0 || warrantyClaims.length > 0;

  if (!isReady) return null;
  if (isReady && !canViewReports) return null;

  return (
    <div className="page-container space-y-4">
      <PageHeader
        title="Returns & Warranty Report"
        subtitle="Aging, financials, and top vendors/parts"
        actions={<ModuleHelpButton moduleKey="returns_warranty_report" context={{ isEmpty: !hasAnyReturns }} />}
      />

      <div className="flex flex-wrap gap-3">
        <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All vendors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">All vendors</SelectItem>
            {vendors
              .filter((v) => v.id && v.id.trim() !== '')
              .map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.vendor_name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Open Returns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{report.totals.returns.open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Open Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{report.totals.claims.open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Approved / Credit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoney(report.financial.approved + report.financial.credit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Reimbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoney(report.financial.reimbursed)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Aging - Returns</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(report.aging.returns).map(([bucket, count]) => (
                  <TableRow key={bucket}>
                    <TableCell>{bucket} days</TableCell>
                    <TableCell className="text-right">{count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Aging - Claims</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(report.aging.claims).map(([bucket, count]) => (
                  <TableRow key={bucket}>
                    <TableCell>{bucket} days</TableCell>
                    <TableCell className="text-right">{count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Vendors</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.topVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  report.topVendors.map((v) => (
                    <TableRow key={v.vendor_id}>
                      <TableCell>{v.name}</TableCell>
                      <TableCell className="text-right">{v.count}</TableCell>
                      <TableCell className="text-right">${formatMoney(v.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Parts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.topParts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  report.topParts.map((p) => (
                    <TableRow key={p.part_id}>
                      <TableCell>{p.part_number}</TableCell>
                      <TableCell className="text-right">{p.count}</TableCell>
                      <TableCell className="text-right">${formatMoney(p.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
