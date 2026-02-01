import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsLayout } from '@/components/docs/DocsLayout';

export default function SchedulingDocs() {
  return (
    <DocsLayout moduleKey="scheduling">
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Scheduling helps plan technician workload across work orders. It provides day/week views,
            technician assignments, and blocks for breaks, PTO, meetings, and fabrication.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Assigning work orders to technicians with specific time blocks.</li>
            <li>Balancing workload and capacity across the week.</li>
            <li>Tracking promised dates and parts readiness.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Schedule item:</strong> A block tied to a work order or a non-work block (break, PTO, etc.).</li>
            <li><strong>Technician assignment:</strong> Schedule items can be assigned to a technician or left unassigned.</li>
            <li><strong>Status:</strong> On track, at risk, late, in progress, waiting approval/parts, QA.</li>
            <li><strong>Priority:</strong> A numeric priority field for ordering and attention.</li>
            <li><strong>Parts ready:</strong> Flag indicating whether parts are ready for the job.</li>
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
              <strong>Create a schedule item:</strong> Use the scheduling dialog to select a work order, time,
              duration, technician, and status.
            </li>
            <li>
              <strong>Create a block:</strong> Switch item type to block for breaks, PTO, meetings, or fabrication.
            </li>
            <li>
              <strong>Adjust view:</strong> Toggle Day/Week and layout options to fit your planning style.
            </li>
            <li>
              <strong>Filter by technician:</strong> Limit view to a specific technician or show unassigned.
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
            <li>Schedule items are tied to work orders or blocks only.</li>
            <li>Start time and duration snap to 15-minute increments.</li>
            <li>Default shop hours influence day layout (from settings).</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Scheduling without assigning a technician, leading to missed work.</li>
            <li>Ignoring parts-ready status before scheduling active work.</li>
            <li>Overloading a day without checking utilization.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">How do I schedule a work order quickly?</p>
            <p>Use the Schedule button in Work Orders or create directly in Scheduling.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">What does “parts ready” do?</p>
            <p>It indicates readiness for work but does not change inventory.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I schedule non-work activities?</p>
            <p>Yes, create blocks for breaks, PTO, meetings, or fabrication.</p>
          </div>
        </CardContent>
      </Card>
    </div>
    </DocsLayout>
  );
}
