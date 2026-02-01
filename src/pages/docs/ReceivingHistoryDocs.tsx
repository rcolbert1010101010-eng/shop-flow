import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReceivingHistoryDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Receiving History" backTo="/receiving-history" />

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
            Receiving History is the log of past receipts. It provides a searchable record of inventory
            receipts, including dates, vendors, and line details. Use it for audits, corrections, and
            reconciliation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Review what was received for a specific date range.</li>
            <li>Find a receipt linked to a part or vendor.</li>
            <li>Investigate inventory discrepancies.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Receipt detail:</strong> Each entry contains the received lines and metadata.</li>
            <li><strong>Search and filters:</strong> Use list tools to narrow down receipts.</li>
            <li><strong>Audit trail:</strong> Receipts provide a historical record of inventory changes.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Find a receipt</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Receiving History.</li>
              <li>Use search to filter by vendor, part, or receipt ID.</li>
              <li>Select a receipt to open its detail page.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Audit a discrepancy</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Locate the receipt tied to the time period or vendor.</li>
              <li>Review quantities and costs recorded.</li>
              <li>Compare with purchase orders or invoices as needed.</li>
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
            <li>History reflects receipts for the active tenant only.</li>
            <li>Editing past receipts may be restricted by permissions.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Searching by the wrong identifier (receipt ID vs part number).</li>
            <li>Assuming history includes data from another tenant.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Can I delete a receipt?</p>
            <p>Receipt deletion is typically restricted. Contact an administrator if corrections are needed.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Does history include adjustments?</p>
            <p>Receiving history logs receipt activity. Adjustments are tracked separately in inventory workflows.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No bulk export directly from the history list.</li>
            <li>Filtering options depend on what is available in the list view.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
