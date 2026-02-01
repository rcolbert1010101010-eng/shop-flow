import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VendorsDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Vendors" backTo="/vendors" />

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
            Vendors are the suppliers you buy parts and materials from. Maintaining accurate vendor records
            improves purchasing, receiving, and returns workflows. Vendor data can also be used for reporting
            and analytics across inventory and purchasing.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Add a vendor before creating purchase orders or receiving inventory.</li>
            <li>Update contact details when vendor phone or email changes.</li>
            <li>Track notes and special handling instructions for specific suppliers.</li>
            <li>Import a vendor list when onboarding a new location or system.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Vendor name:</strong> Required for identification and reporting.</li>
            <li><strong>Contact fields:</strong> Phone and email support purchasing and returns.</li>
            <li><strong>Notes:</strong> Store internal guidance such as ordering preferences.</li>
            <li><strong>Import:</strong> Bulk creation from a file using the Import action.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Create a vendor</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Vendors and click Add Vendor.</li>
              <li>Enter a vendor name and optional contact information.</li>
              <li>Save to add the vendor to your catalog.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Import vendors</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Click Import and follow the prompts to upload a vendor list.</li>
              <li>Review the preview and confirm to create vendors in bulk.</li>
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
            Vendor management is role-based. If you cannot add or edit vendors, verify your permissions
            with an administrator.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules / Constraints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Vendor name is required.</li>
            <li>Email and phone are optional but improve communication.</li>
            <li>Duplicate vendors reduce reporting accuracy; search before creating.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Creating duplicate vendors with slightly different names.</li>
            <li>Leaving out contact details needed for returns or purchasing.</li>
            <li>Importing vendors without reviewing the preview first.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Can I merge vendors?</p>
            <p>Vendor merging is not automated. Consolidate data manually if needed.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Why do I need vendors for parts?</p>
            <p>Vendors help organize purchasing, receiving, and return workflows.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No automated vendor deduplication.</li>
            <li>Import formats are limited to the options provided in the Import dialog.</li>
            <li>Vendor history tracking is limited to what appears in related transactions.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
