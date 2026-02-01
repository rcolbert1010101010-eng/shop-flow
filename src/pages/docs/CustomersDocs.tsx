import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CustomersDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Customers" backTo="/customers" />

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
            The Customers module is the central record of people and organizations you do business with.
            It stores contact details, addresses, notes, and account preferences that flow into sales orders,
            work orders, and reporting. Maintaining clean customer data improves communication, billing accuracy,
            and historical traceability.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>When a new person or company requests a quote, job, or parts order.</li>
            <li>When you need to update contact or billing details for an existing customer.</li>
            <li>When you want to review customer history, open orders, or service activity.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Customer record:</strong> The primary profile with contact info and preferences.</li>
            <li><strong>Primary contact:</strong> The best person to reach for approvals and updates.</li>
            <li><strong>Billing details:</strong> Address, tax settings, and payment terms used on orders.</li>
            <li><strong>Notes:</strong> Internal-only context such as preferred contact method.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creating a Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Navigate to <strong>Customers</strong> and click <strong>New Customer</strong>.</li>
            <li>Enter the customer name and primary contact details.</li>
            <li>Add phone/email and billing address if known.</li>
            <li>Save to create the record and unlock order linking.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editing / Updating</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Open the customer from the list.</li>
            <li>Update contact, billing, or notes as needed.</li>
            <li>Save changes to keep downstream orders consistent.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Searching / Filtering</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Use the search box to find by name, phone, or email.</li>
            <li>Filter lists to focus on recent or active customers.</li>
            <li>Sort by last updated to find customers that need attention.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linking Customers to Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Sales Orders and Work Orders can be linked to a customer record. This connection ensures accurate
            billing, consolidated history, and consistent contact information. When creating an order, select
            the correct customer to inherit the latest details and keep reporting aligned.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Standardize naming (e.g., “Acme Corp” vs “ACME”).</li>
            <li>Keep primary contact and billing address current.</li>
            <li>Use notes for internal context, not customer-facing data.</li>
            <li>Verify customer selection on every order.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Creating duplicates instead of updating existing records.</li>
            <li>Leaving contact fields blank when the information is known.</li>
            <li>Linking orders to the wrong customer due to similar names.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Can I merge duplicate customers?</p>
            <p>Deduplication is a manual process. Update one record and reassign orders if needed.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">What if a customer has multiple locations?</p>
            <p>Use notes for secondary addresses or create separate customer records if billing differs.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Do customer updates affect existing orders?</p>
            <p>Orders typically store a snapshot of billing details. Review order settings if accuracy matters.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
