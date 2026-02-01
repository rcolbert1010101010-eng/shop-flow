import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsLayout } from '@/components/docs/DocsLayout';

export default function PurchaseOrdersDocs() {
  return (
    <DocsLayout moduleKey="purchase_orders">
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Purchase Orders track vendor purchases and receiving. They capture ordered parts, quantities,
            and receiving progress, and can be linked to Sales Orders or Work Orders to document demand.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Ordering parts from vendors.</li>
            <li>Receiving inventory into stock with traceability.</li>
            <li>Linking purchases to a Sales Order or Work Order.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>PO number:</strong> Unique identifier for the vendor order.</li>
            <li><strong>Derived status:</strong> Open, partially received, or received based on line receipts.</li>
            <li><strong>Receiving:</strong> Updates inventory when quantities are received.</li>
            <li><strong>Links:</strong> Optional association to Sales Orders or Work Orders.</li>
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
              <strong>Create PO:</strong> Click <strong>New PO</strong>, select a vendor, then save.
            </li>
            <li>
              <strong>Add lines:</strong> Add parts and quantities to the order.
            </li>
            <li>
              <strong>Receive items:</strong> Enter received quantities; inventory updates immediately.
            </li>
            <li>
              <strong>Close PO:</strong> Once all items are received, close the PO.
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
            <li>Vendor selection is required to create a PO.</li>
            <li>Receiving requires inventory receive permission.</li>
            <li>Derived status is computed from line receipt progress.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Receiving the wrong quantity, which can inflate inventory.</li>
            <li>Forgetting to close a PO after full receipt.</li>
            <li>Creating a PO without linking to the related order when required.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">What does “Derived Status” mean?</p>
            <p>It reflects receipt progress: open, partially received, or received.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Does receiving update inventory?</p>
            <p>Yes. Received quantities increase QOH immediately.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can a PO be linked to multiple orders?</p>
            <p>In the UI, a PO can link to a single Sales Order or Work Order at a time.</p>
          </div>
        </CardContent>
      </Card>
    </div>
    </DocsLayout>
  );
}
