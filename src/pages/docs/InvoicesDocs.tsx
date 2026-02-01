import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsLayout } from '@/components/docs/DocsLayout';

export default function InvoicesDocs() {
  return (
    <DocsLayout moduleKey="invoices">
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The Invoices module aggregates Sales Orders and Work Orders that have been invoiced. It is a
            registry view for billed transactions, showing totals, payment status, and actions to receive
            or void payments.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Reviewing invoices across sales and work orders.</li>
            <li>Recording payments against an invoice.</li>
            <li>Voiding invoices that have no payments.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Source:</strong> Invoice originates from a Sales Order or Work Order.</li>
            <li><strong>Payment status:</strong> Unpaid, Partial, Paid, or Overpaid.</li>
            <li><strong>Balance due:</strong> Total minus payments received.</li>
            <li><strong>Voided:</strong> Invoice can be voided only when no payments exist.</li>
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
              <strong>Find an invoice:</strong> Use filters and search by invoice number or customer.
            </li>
            <li>
              <strong>View source:</strong> Click an invoice row to open its source order.
            </li>
            <li>
              <strong>Receive payment:</strong> Use the “Receive Payment” action to record payment.
            </li>
            <li>
              <strong>Void invoice:</strong> Only available when no payments exist and you have permission.
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
            <li>Void is blocked if payments exist; void payments first.</li>
            <li>Permissions may restrict recording payments or voiding.</li>
            <li>Invoices link back to their source order for detail.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Trying to void invoices after payments are recorded.</li>
            <li>Recording payments on the wrong invoice/source order.</li>
            <li>Assuming invoice creation happens here (it occurs in Sales/Work Orders).</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Where do invoices come from?</p>
            <p>Invoices are created when Sales Orders or Work Orders are invoiced.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Why can’t I void an invoice?</p>
            <p>Invoices with payments cannot be voided until payments are voided.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I edit invoice totals here?</p>
            <p>No. Totals come from the source order and its line items.</p>
          </div>
        </CardContent>
      </Card>
    </div>
    </DocsLayout>
  );
}
