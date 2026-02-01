import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReceivingDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Receiving" backTo="/receiving" />

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
            Receiving is the process of logging incoming parts and materials into inventory. It records
            quantities received, costs, and any discrepancies so inventory levels stay accurate and
            purchasing can be reconciled.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>When a vendor shipment arrives and inventory needs to be updated.</li>
            <li>When reconciling items against a purchase order.</li>
            <li>When recording partial or split deliveries.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Receipt:</strong> A record of items received and their quantities.</li>
            <li><strong>Vendor context:</strong> Receipts are often linked to a vendor or purchase order.</li>
            <li><strong>Quantity on hand:</strong> Receiving updates QOH based on quantities entered.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Receive items</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Receiving and select the vendor or purchase order if applicable.</li>
              <li>Add line items and enter quantities received.</li>
              <li>Confirm costs if required and save the receipt.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Handle partial shipments</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Receive only the quantities delivered.</li>
              <li>Leave remaining quantities open until the rest arrives.</li>
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
            <li>Quantities received must be valid numbers.</li>
            <li>Receipts affect inventory counts for the active tenant only.</li>
            <li>Costs should align with purchasing records for accurate margins.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Receiving items into the wrong part number or vendor.</li>
            <li>Over-receiving quantities and inflating QOH.</li>
            <li>Skipping cost updates when vendor pricing changes.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Does receiving automatically close purchase orders?</p>
            <p>Purchasing updates depend on the workflow. Review the purchase order status after receiving.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I edit a receipt after saving?</p>
            <p>Use Receiving History to review existing receipts and adjust if your permissions allow.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No automated vendor notification from the receiving screen.</li>
            <li>Limited bulk editing for receipt lines after creation.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
