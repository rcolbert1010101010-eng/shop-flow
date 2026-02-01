import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsLayout } from '@/components/docs/DocsLayout';

export default function CycleCountsDocs() {
  return (
    <DocsLayout moduleKey="cycle_counts">
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Cycle Counts let you audit inventory by counting subsets of parts and posting the results.
            Each cycle count session tracks expected versus counted quantities and records variances
            before updating inventory.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Routine inventory audits without shutting down the entire warehouse.</li>
            <li>Spot checks after discrepancies or major receiving events.</li>
            <li>Counts scoped by vendor, category, or bin location.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Session:</strong> A cycle count event with a title, status, and timestamps.</li>
            <li><strong>Expected vs counted:</strong> Counts are compared to expected inventory levels.</li>
            <li><strong>Variance:</strong> Differences require reasons before posting.</li>
            <li><strong>Posting:</strong> Finalizes the count and updates inventory quantities.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Start a cycle count</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Cycle Counts and click New Cycle Count.</li>
              <li>Name the session and add parts individually or by scope.</li>
              <li>Enter counted quantities for each line.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Post the count</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Review variances and add reasons where required.</li>
              <li>Resolve any blocked conditions (such as negative QOH policy).</li>
              <li>Post the session to update inventory.</li>
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
            <li>Only draft sessions can be edited; posted or cancelled sessions are read-only.</li>
            <li>Variance reasons are required when counts differ from expected.</li>
            <li>Inventory policy may warn or block if counts result in negative QOH.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Posting without reviewing variances or missing reasons.</li>
            <li>Adding duplicate parts to the session.</li>
            <li>Counting with the wrong scope filters.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Can I cancel a cycle count?</p>
            <p>Yes. Cancelled sessions are kept for history but cannot be posted.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Do cycle counts change inventory immediately?</p>
            <p>Inventory updates only occur when the session is posted.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No automated count import from scanners in the current UI.</li>
            <li>Reporting is limited to session summary and variance totals.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
    </DocsLayout>
  );
}
