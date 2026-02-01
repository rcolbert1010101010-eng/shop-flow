import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsLayout } from '@/components/docs/DocsLayout';

export default function WarrantyReturnsDocs() {
  return (
    <DocsLayout moduleKey="warranty_returns">
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The Warranty & Returns module tracks vendor returns and warranty claims. It provides a single
            place to manage RMAs, claim status, and vendor follow-ups so credits and reimbursements are not lost.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Create a return when you need to send parts back to a vendor.</li>
            <li>Create a warranty claim when a part or repair is covered by vendor warranty.</li>
            <li>Use the list filters to track open vs closed items.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Returns:</strong> Records of parts sent back to vendors.</li>
            <li><strong>Warranty claims:</strong> Requests for reimbursement or replacement.</li>
            <li><strong>Status tracking:</strong> Each item has a status shown in the list view.</li>
            <li><strong>Vendor linkage:</strong> Returns and claims are tied to a vendor.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Create a return</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Returns and select New Return.</li>
              <li>Choose a vendor and create the return record.</li>
              <li>Add lines and update tracking information as needed.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Create a warranty claim</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Warranty Claims and select New Claim.</li>
              <li>Link the claim to a vendor and the related work order when applicable.</li>
              <li>Enter requested and approved amounts as the claim progresses.</li>
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
            <li>Returns require a vendor selection before creation.</li>
            <li>Claims should reference the correct work order when applicable.</li>
            <li>Statuses are limited to the values shown in the UI.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Opening a return without capturing tracking details.</li>
            <li>Forgetting to update claim status after vendor response.</li>
            <li>Linking a claim to the wrong work order.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Can I combine returns and claims?</p>
            <p>Returns and claims are tracked separately, but both appear in related reports.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Do warranty claims affect inventory?</p>
            <p>Inventory impacts depend on your returns workflow. Review inventory records separately.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No automated vendor communication from the module.</li>
            <li>Limited reporting beyond the list views and report module.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
    </DocsLayout>
  );
}
