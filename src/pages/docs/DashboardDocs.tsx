import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsLayout } from '@/components/docs/DocsLayout';

export default function DashboardDocs() {
  return (
    <DocsLayout moduleKey="dashboard">
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The Dashboard provides a high-level view of shop activity and performance. It summarizes key
            indicators, highlights items that need attention, and links to the most common operational areas.
            Use it to orient your day and confirm the current state of work.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>At the start of a shift to see what is pending or overdue.</li>
            <li>When a manager needs a snapshot of sales, work orders, or inventory health.</li>
            <li>To navigate quickly to problem areas highlighted by the system.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>KPIs:</strong> Summary values for operational metrics and activity totals.</li>
            <li><strong>Alerts:</strong> Items needing attention, such as aging work or inventory warnings.</li>
            <li><strong>Shortcuts:</strong> Links to priority modules and reports.</li>
            <li><strong>Tenant context:</strong> All dashboard data reflects the active tenant.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Daily review</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the Dashboard and scan the KPI tiles.</li>
              <li>Review alert sections for anything overdue or blocked.</li>
              <li>Use shortcuts to open the relevant module and resolve the issue.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Management check-in</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Confirm sales and work volume metrics.</li>
              <li>Open linked reports for deeper detail if needed.</li>
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
            <li>Metrics are read-only and reflect the current tenant context.</li>
            <li>Some tiles depend on data volume; empty modules may show zero values.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Assuming dashboard totals include another tenant’s data.</li>
            <li>Ignoring alert sections that require operational follow-up.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Why are some metrics zero?</p>
            <p>They depend on data for the active tenant. If there are no records, the totals will be empty.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I edit data from the Dashboard?</p>
            <p>No. Use the linked modules to create or update records.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No custom dashboard layout or user-defined tiles.</li>
            <li>Limited filtering beyond the active tenant context.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
    </DocsLayout>
  );
}
