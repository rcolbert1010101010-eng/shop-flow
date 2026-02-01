import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function WorkOrdersDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Work Orders" backTo="/work-orders" />

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
            Work Orders are the primary record for repair and service jobs in ShopFlow. They capture the
            customer, unit/asset, job scopes, labor, parts, and status progression from estimate to invoicing.
            Work Orders are designed for multi-step workflows where technicians, parts availability, and
            job progress need to be tracked over time.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What a Work Order is in ShopFlow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            A Work Order is a repair job record. It includes a customer, a specific unit/asset, job lines
            (diagnosis/repair tasks), labor entries, parts usage, and charges. It is the operational source
            of truth for service work and is the basis for invoicing and payment tracking.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it differs from Sales Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Work Orders</strong> are for repair workflows (diagnosis, jobs, labor, parts, time).</li>
            <li><strong>Sales Orders</strong> are for counter sales or parts-only transactions.</li>
            <li>Use Work Orders when you need technician workflows or job-level tracking.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use Work Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Diagnostic and repair jobs.</li>
            <li>Fleet or asset maintenance with recurring service history.</li>
            <li>Multi-step jobs that require technician workflows and status updates.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts &amp; Terminology</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Customer:</strong> The account billed for the work.</li>
            <li><strong>Unit / Asset:</strong> The vehicle or equipment being serviced (required).</li>
            <li><strong>Job lines:</strong> Individual tasks with their own status and notes.</li>
            <li><strong>CCC notes:</strong> Complaint, Cause, Correction fields on job lines when used.</li>
            <li><strong>Labor lines:</strong> Time/effort entries with hours and rate.</li>
            <li><strong>Part lines:</strong> Parts issued to the job, affecting inventory immediately.</li>
            <li><strong>Charge lines:</strong> Additional charges (manual, fabrication, plasma) that roll into totals.</li>
            <li><strong>Tenant isolation:</strong> Work Orders are tenant-scoped; you won’t see records from other tenants.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work Order Lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Work Orders generally move through a typical flow: creation (estimate) → active work (open/in progress)
            → completion → invoicing. The app uses explicit statuses such as Estimate, Open, In Progress, and
            Invoiced. Invoiced orders are locked from editing.
          </p>
          <p>
            Closing a Work Order means the work is finalized and billing is complete. Once invoiced, changes to
            labor or parts are blocked to preserve financial accuracy.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creating a Work Order (Step-by-Step)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Go to <strong>Work Orders</strong> and click <strong>New Work Order</strong>.</li>
            <li>Select a customer.</li>
            <li>Select a unit/asset (required). Use quick-add if the unit does not exist.</li>
            <li>Add initial notes or job details if available.</li>
            <li>Save to create the Work Order (starts as an estimate).</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operations / Tasks / Lines (Core Work Execution)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Use the <strong>Jobs</strong> tab to manage job lines and update job statuses.</li>
            <li>Add parts from the <strong>Parts</strong> tab; each part line belongs to the work order or a job line.</li>
            <li>Add labor entries from the <strong>Labor</strong> tab with hours, rate, and technician.</li>
            <li>The <strong>Activity</strong> tab logs job and status changes.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing &amp; Guardrails (Very Detailed)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Suggested price:</strong> Part line pricing can display a suggested unit price based on
              the customer price level.
            </li>
            <li>
              <strong>Below-cost warning:</strong> If a part is priced below cost basis, a warning appears in
              the UI. This is informational and does not block saving.
            </li>
            <li>
              <strong>Overrides:</strong> Editing unit price directly updates the line. The UI does not display
              an explicit audit log; follow internal policy if approvals are required.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Interaction (Very Detailed)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Adding parts to a Work Order issues inventory immediately.</li>
            <li>Updating quantity adjusts inventory by the difference (issue or return).</li>
            <li>Removing a part line returns inventory to stock.</li>
            <li>Work Orders do not reserve inventory; they directly consume/return it.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relationship to Purchasing / Receiving</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Parts readiness is tracked at the job level. If parts are missing or at risk, the job can show
            a readiness indicator and may be placed in a waiting status. Purchase Orders and receiving are
            managed in their own modules; Work Orders reference those parts but do not automate receiving.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technician Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Assign technicians on labor lines and track hours.</li>
            <li>Use job statuses (Intake, Diagnosing, Waiting on Parts, etc.) to communicate progress.</li>
            <li>Use time tracking if enabled; time entries appear in the Time tab when recorded.</li>
            <li>Send a work order to Scheduling to create a schedule item.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer Communication / Approvals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Job statuses include a “Waiting Approval” option for internal tracking. The app does not provide
            built-in customer approval capture or electronic signatures in the Work Order screen.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Closing / Invoicing / Accounting Touchpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Invoicing locks the Work Order and prevents further edits.</li>
            <li>Invoicing creates an Invoice record and redirects to the Invoices module.</li>
            <li>Payments can be recorded in the Work Order before or after invoicing.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents &amp; Communication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Tech Print:</strong> Printable technician sheet from the Work Order header.</li>
            <li><strong>Pick List:</strong> Printable parts pick list.</li>
            <li><strong>Print Overview:</strong> Summary printout from the Overview tab.</li>
            <li>Email/export is not currently supported directly from the Work Order screen.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Workflows (Examples)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Diagnostic + repair:</strong> Create WO → diagnose → add parts/labor → invoice.</li>
            <li><strong>Maintenance service:</strong> Create WO → add routine tasks → record labor → invoice.</li>
            <li><strong>Fleet repair:</strong> Create WO → assign unit → track parts readiness → complete/invoice.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting &amp; Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Totals seem off: check parts, labor, fabrication, plasma, and other charge lines.</li>
            <li>Pricing confusion: suggested price is informational; it does not auto-update once edited.</li>
            <li>Missing customer/unit: Work Orders require both.</li>
            <li>Can’t edit: invoiced orders are locked.</li>
            <li>Missing records: tenant isolation may hide orders from another tenant.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Why can’t I edit this work order?</p>
            <p>If it is invoiced, edits are locked to preserve financial history.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Why doesn’t the order show for me?</p>
            <p>Work Orders are tenant-scoped. Confirm you are in the correct tenant.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">How do I send a work order to scheduling?</p>
            <p>Use the “Send to Schedule” button in the Work Order header (when available).</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Do parts get reserved or consumed?</p>
            <p>Parts are issued when added and returned when removed or reduced.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
