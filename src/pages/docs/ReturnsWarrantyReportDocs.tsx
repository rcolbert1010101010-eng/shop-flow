import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReturnsWarrantyReportDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Returns & Warranty Report" backTo="/reports/returns-warranty" />

      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The Returns & Warranty Report summarizes aging, volume, and financial impact for vendor returns
            and warranty claims. It is designed for managers who need visibility into outstanding vendor
            exposure and reimbursement progress.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Review open returns and claims by age bucket.</li>
            <li>Track approved vs reimbursed amounts over time.</li>
            <li>Identify vendors or parts generating high return volume.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Date range:</strong> Filters report calculations to recent periods.</li>
            <li><strong>Vendor filter:</strong> Focus on a single supplier or view all.</li>
            <li><strong>Aging buckets:</strong> Groups open items by days outstanding.</li>
            <li><strong>Financial summary:</strong> Totals for approved, credit, and reimbursed amounts.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Run the report</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the Returns & Warranty Report.</li>
              <li>Select a date range and vendor filter.</li>
              <li>Review summary tiles and detail tables.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Investigate a vendor</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Filter the report to a specific vendor.</li>
              <li>Review aging and top parts lists to identify trends.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules / Constraints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Report visibility requires report permissions (reports.view).</li>
            <li>Totals reflect data for the active tenant only.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Using the wrong date range and missing older outstanding items.</li>
            <li>Assuming report totals include data from another tenant.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Why do some totals look high?</p>
            <p>Check the date range and confirm vendor filters are set correctly.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I export this report?</p>
            <p>Export options are limited to the current UI capabilities.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No scheduled report delivery from within the app.</li>
            <li>Report layout and buckets are fixed to the standard view.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
