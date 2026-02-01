import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsLayout } from '@/components/docs/DocsLayout';

export default function PaymentsDocs() {
  return (
    <DocsLayout moduleKey="payments">
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Payments track money received against Work Orders, Sales Orders, and Invoices. The Payments
            ledger provides a complete history of transactions, including amounts, methods, references,
            and voided records.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Record a new payment at the counter or after a customer remittance.</li>
            <li>Audit historical payments for a specific order or customer.</li>
            <li>Void a payment that was entered in error.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Order type:</strong> Payments can be applied to Work Orders, Sales Orders, or Invoices.</li>
            <li><strong>Method:</strong> Cash, check, card, ACH, or other methods.</li>
            <li><strong>Status:</strong> Active or voided; voided payments remain for audit history.</li>
            <li><strong>Balance due:</strong> Calculated from total order amount and payments applied.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Receive a payment</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Click Receive Payment.</li>
              <li>Select the order type and choose the specific order or invoice.</li>
              <li>Enter amount, method, and optional reference or notes.</li>
              <li>Save to post the payment to the ledger.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Void a payment</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the payment row and select Void.</li>
              <li>Provide a reason in the confirmation dialog.</li>
              <li>Confirm to mark the payment as voided.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Filter the ledger</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Use order type, method, status, and date range filters.</li>
              <li>Search by customer or order number when needed.</li>
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
            <li>Voided payments cannot be edited but remain visible for audit history.</li>
            <li>Recording payments is permission-based (payments.record).</li>
            <li>Invoices must be open to receive payments.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Applying a payment to the wrong order type.</li>
            <li>Forgetting to include reference details for checks or ACH.</li>
            <li>Voiding a payment without recording the replacement payment.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Can I delete a payment instead of voiding?</p>
            <p>No. Payments are voided to preserve audit history.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Why is the Receive Payment button disabled?</p>
            <p>Your role may not include payment recording permissions.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No automated payment reconciliation or bank feeds.</li>
            <li>Export options are limited to the existing ledger view.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
    </DocsLayout>
  );
}
