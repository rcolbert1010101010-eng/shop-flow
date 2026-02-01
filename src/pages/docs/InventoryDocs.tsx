import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function InventoryDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Inventory" backTo="/inventory" />

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
            The Inventory module manages parts, quantities on hand (QOH), vendors, categories, and pricing.
            It is the operational source of truth for parts availability and is used by Sales Orders,
            Work Orders, and Purchase Orders.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Adding new parts and managing part metadata.</li>
            <li>Adjusting QOH through cycle counts or inventory corrections.</li>
            <li>Bulk edits for categories, vendors, active state, or pricing.</li>
            <li>Importing parts in bulk via spreadsheet.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>QOH (Quantity on Hand):</strong> Current stock available for issue.</li>
            <li><strong>UOM rules:</strong> Quantities validate based on unit of measure (e.g., EA vs fractional).</li>
            <li><strong>Cycle count:</strong> Fast QOH updates using a dedicated mode.</li>
            <li><strong>Inventory movements:</strong> Audit trail of issues, returns, and counts.</li>
            <li><strong>Tenant isolation:</strong> Inventory is tenant-scoped; switching tenants resets caches.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-Step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <strong>Add a new part:</strong> Click <strong>Add Part</strong>, fill part number, vendor, category,
              cost, and selling price, then save.
            </li>
            <li>
              <strong>Adjust QOH:</strong> Select a part → choose <strong>Adjust QOH</strong> → enter the new
              quantity and a reason → save. Adjustments validate by UOM rules.
            </li>
            <li>
              <strong>Quick cycle count:</strong> Enable <strong>Quick Cycle Count</strong>, enter counts,
              provide a reason, and apply in batch.
            </li>
            <li>
              <strong>Bulk edits:</strong> Enable <strong>Bulk Select</strong>, choose a bulk action (vendor,
              category, active state, price adjustment), then apply to selected parts.
            </li>
            <li>
              <strong>Import parts:</strong> Use <strong>Import Parts</strong> to upload a spreadsheet and review
              import results.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules / Constraints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>QOH changes are blocked in bulk edit; use Adjust QOH or Receiving instead.</li>
            <li>Quantity validations follow the part’s UOM rules.</li>
            <li>Inventory movements are recorded for auditability.</li>
            <li>Permissions may restrict who can adjust QOH.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Trying to update QOH via bulk edits instead of Adjust QOH.</li>
            <li>Ignoring UOM validation errors when counting or adjusting quantities.</li>
            <li>Creating duplicate parts with slightly different part numbers.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Why can’t I edit QOH in bulk?</p>
            <p>Bulk edits only update metadata and pricing. Use Adjust QOH or Receiving for quantities.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">What causes a QOH validation error?</p>
            <p>Quantities must comply with unit-of-measure rules (e.g., whole units for EA).</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Where do inventory changes show up?</p>
            <p>Inventory movements and adjustments are recorded in the inventory history.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
