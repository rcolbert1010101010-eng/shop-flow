import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SalesOrdersDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Sales Orders" backTo="/sales-orders" />

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
            Sales Orders represent parts and non-repair transactions in ShopFlow. They capture the customer,
            line items, pricing, taxes, and totals for counter sales, parts-only orders, and similar transactions.
            Sales Orders provide a clean separation from repair workflows, keeping billing and inventory actions
            aligned to simple sales rather than technician labor.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use Sales Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Counter sales or walk-in parts purchases.</li>
            <li>Parts-only sales without a repair workflow.</li>
            <li>Plasma billing or other non-repair, parts-focused transactions.</li>
            <li>Quotes or estimates for parts that may convert into a sale.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When NOT to Use Sales Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Repair work that requires technician time tracking or labor operations.</li>
            <li>Jobs that should be tied to a Work Order for workflow, inspection, or repair status.</li>
            <li>Multi-step service tasks where parts are only one component of the job.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts &amp; Terminology</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Sales Order:</strong> A parts-focused transaction record.</li>
            <li><strong>Customer:</strong> The account associated with billing and history.</li>
            <li><strong>Line item:</strong> A part/charge with quantity and price.</li>
            <li><strong>Estimate:</strong> A draft/quote state before commitment.</li>
            <li><strong>Invoice:</strong> Final billing step that locks the order.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales Order vs Work Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Sales Orders</strong> are for parts and non-repair transactions.</li>
            <li><strong>Work Orders</strong> are for repairs and service workflows, including labor tracking.</li>
            <li>If a job requires technician time, diagnostics, or repair status, use a Work Order instead.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items, Quantities, and Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Each line item represents a part (or charge) with a quantity and unit price.</li>
            <li>Line totals are quantity × unit price and roll into the order subtotal.</li>
            <li>Core charges are shown separately when applicable and included in the total.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status / Lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Sales Orders typically follow this flow: <strong>Estimate → Open → Partial/Completed → Invoiced</strong>.
            You can also cancel an order. In the list, deleted orders are shown when the order is inactive.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Estimate:</strong> Draft/quote state; convert to open when committing.</li>
            <li><strong>Open:</strong> Active order ready for fulfillment and invoicing.</li>
            <li><strong>Partial:</strong> Manually marked when only some items are fulfilled.</li>
            <li><strong>Completed:</strong> Manually marked when all items are fulfilled.</li>
            <li><strong>Invoiced:</strong> Locks the order and posts inventory consumption.</li>
            <li><strong>Cancelled:</strong> Locks the order and preserves history without fulfillment.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer Association</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Every Sales Order must be linked to a customer. The customer selection drives price level,
            tax calculation, and reporting. You can pick an existing customer or add a new one during creation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxes, Fees, and Sublet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Tax is calculated using the customer’s tax settings and displayed in totals.</li>
            <li>Core charges are supported and appear as separate totals when applicable.</li>
            <li>Plasma-related charges can appear as charge lines when linked to plasma projects.</li>
            <li>There is no dedicated sublet/third-party service line type in Sales Orders.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creating a Sales Order (Step-by-Step)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Go to <strong>Sales Orders</strong> and select <strong>New Sales Order</strong>.</li>
            <li>Select an existing customer or create a new customer.</li>
            <li>Set unit (optional), notes, and any reference information.</li>
            <li>Save to create the order (starts as an estimate).</li>
            <li>Add parts and verify pricing and quantities.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Managing Line Items (Step-by-Step)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Click <strong>Add Part</strong> to search and add a line item.</li>
            <li>Update quantity directly in the line; quantities follow the part’s unit of measure.</li>
            <li>Edit unit price using the pencil icon; Save/Cancel controls apply to that line.</li>
            <li>Remove a line item using the remove action.</li>
            <li>Invoiced or cancelled orders are locked and cannot be edited.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing &amp; Guardrails (Very Detailed)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Suggested price:</strong> The UI displays a suggested unit price based on the customer’s
              price level. When shown, it appears as “Suggested (LEVEL): $X.XX”.
            </li>
            <li>
              <strong>Reset behavior:</strong> While editing a price, the <strong>Reset</strong> button fills the
              draft price with the suggested value.
            </li>
            <li>
              <strong>Below-cost warning:</strong> If the unit price is below the cost basis, a warning appears
              under the price (“Warning: below cost …”). This is informational; it does not block saving.
            </li>
            <li>
              <strong>Overrides:</strong> Price changes update the line directly. The Sales Order screen does not
              display an override/audit log, so document approval workflows outside this screen if required.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Interaction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Sales Orders do not reserve inventory when created.</li>
            <li>Inventory is consumed when the order is invoiced.</li>
            <li>Inventory movements are recorded at invoice time for traceability.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receiving / Fulfillment Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Sales Orders do not have a dedicated fulfillment workflow beyond status updates. You can mark
            orders as partial or completed manually and print a Pick List for parts prep.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents &amp; Communication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Print:</strong> Print the Sales Order or a Pick List from the order header.</li>
            <li><strong>Email/export:</strong> Not currently supported directly from the Sales Order screen.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Workflows (Examples)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Counter sale:</strong> Create order → add parts → invoice → record payment.</li>
            <li><strong>Parts quote:</strong> Create order (estimate) → share quote → convert to open when approved.</li>
            <li><strong>Call-in request:</strong> Create order → add parts → mark partial/completed → invoice.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting &amp; Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Wrong module: If the job needs labor or repair tracking, use a Work Order instead.</li>
            <li>Pricing confusion: Suggested price is informational; use Reset to align with price level.</li>
            <li>Missing customer: Sales Orders require a customer before creation.</li>
            <li>Locked order: Invoiced or cancelled orders cannot be edited.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Can I invoice an estimate directly?</p>
            <p>Convert the estimate to an open order first, then invoice.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Do Sales Orders update inventory immediately?</p>
            <p>No. Inventory is consumed when the order is invoiced.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">How do I record payments?</p>
            <p>Use the Payment section within the Sales Order to record amounts and methods.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
