import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReturnsWarrantyDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Returns and Warranty" backTo="/returns" />

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
            Returns and Warranty help you track parts sent back to vendors and warranty claims tied to work orders.
            These records centralize vendor communication, claim amounts, and status tracking so you can reconcile
            credits and reimbursements accurately.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Open a return when a vendor requires an RMA or replacement.</li>
            <li>Open a warranty claim when a part or repair is covered by vendor warranty.</li>
            <li>Monitor open items and follow up on approvals or credits.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Vendor association:</strong> Both returns and claims are linked to a vendor.</li>
            <li><strong>Status tracking:</strong> Lists and filters group items by open or closed status.</li>
            <li><strong>Claim amounts:</strong> Warranty claims track requested and approved amounts.</li>
            <li><strong>Work order linkage:</strong> Warranty claims can be tied to a work order.</li>
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
              <li>Open Returns and click New Return.</li>
              <li>Select the vendor and create the return record.</li>
              <li>Add line details and update tracking information as needed.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Create a warranty claim</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Warranty Claims and click New Claim.</li>
              <li>Link the claim to the vendor and the related work order when applicable.</li>
              <li>Enter requested amounts and supporting details.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Track and close items</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Use status filters to focus on open or closed items.</li>
              <li>Update statuses as you receive approvals, credits, or replacements.</li>
              <li>Confirm tracking numbers and vendor responses before closing.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions / Roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Access to returns and warranty modules is role-based. If creation or editing tools are missing,
            confirm your permissions with an administrator.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules / Constraints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Returns require a vendor selection before creation.</li>
            <li>Warranty claims should reference the related work order when applicable.</li>
            <li>Status values are chosen from the options shown in the UI.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Opening a return without capturing a vendor tracking number.</li>
            <li>Forgetting to update claim status after vendor approval or denial.</li>
            <li>Creating a warranty claim without linking the correct work order.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Do returns or claims adjust inventory automatically?</p>
            <p>Inventory adjustments depend on your workflow. Review inventory and receiving processes for stock changes.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I track vendor approvals?</p>
            <p>Yes, update the status as the vendor responds and use filters to track progress.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No automated vendor communication or email generation.</li>
            <li>Status changes and credits require manual updates.</li>
            <li>Reporting is limited to what is visible in the module lists.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
