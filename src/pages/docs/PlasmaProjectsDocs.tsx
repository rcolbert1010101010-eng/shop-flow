import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PlasmaProjectsDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Plasma Projects" backTo="/plasma" />

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
            A Plasma Project is a complete job/work package for plasma cutting. It groups the cut lines,
            material attributes, and operational inputs needed to execute a cut and track its outcome. Projects
            can be run standalone or linked to Sales Orders for quoting and invoicing.
          </p>
          <p>
            Each project contains line items that represent material and cut parameters. Pricing totals are
            calculated from those line inputs and can be posted into a Sales Order as a charge line.
          </p>
          <p>
            Typical lifecycle: create the project → define line inputs → execute work on the floor → post or
            complete the project. The current status is always shown in the project header and list view.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>When you need to scope, price, and execute a plasma cutting job.</li>
            <li>When the work requires detailed cut parameters and machine time inputs.</li>
            <li>When you want to post plasma work to a Sales Order for billing.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Project header:</strong> Title, status, and optional Sales Order link.
            </li>
            <li>
              <strong>Line items:</strong> Each line captures material type, thickness, quantity, cut length,
              pierces, setup minutes, and machine minutes.
            </li>
            <li>
              <strong>Derived vs override:</strong> Machine minutes may be derived from inputs; overrides are tracked
              when values are manually adjusted.
            </li>
            <li>
              <strong>Pricing totals:</strong> Line totals roll up to a project total using the sell price per unit.
            </li>
            <li>
              <strong>Recalculate:</strong> Rebuilds pricing based on the latest line inputs.
            </li>
            <li>
              <strong>Posting:</strong> Posting to a Sales Order creates/updates a charge line and locks pricing.
            </li>
            <li>
              <strong>Attachments:</strong> Files (DXF, PDFs, images) are stored for reference. DXF parsing/nesting is
              not enabled.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Create a project</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Plasma Projects and click New Plasma Project.</li>
              <li>Enter a project name and review the status field.</li>
              <li>Add line items for each material/cut definition.</li>
              <li>Recalculate to update pricing totals.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Link to a Sales Order</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Select a Sales Order in the project header.</li>
              <li>If none exists, create one from the selector (if available).</li>
              <li>Use Post to Sales Order to lock pricing and write the charge line.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Apply a template</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Use Add from Template in the header.</li>
              <li>Select a template to insert its cut lines into the project.</li>
              <li>Adjust quantities or inputs as needed, then recalculate.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Print a cut sheet</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the project and click Cut Sheet.</li>
              <li>Use the print dialog to produce a shop-floor copy.</li>
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
            <li>Editing is disabled when a project is posted or its Sales Order is invoiced.</li>
            <li>Edits require enabling Edit mode.</li>
            <li>Recalculate is required to update pricing after input changes.</li>
            <li>Attachments are stored for reference only; no DXF processing is available.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Forgetting to recalculate:</strong> If totals look wrong, click Recalculate to rebuild pricing.
            </li>
            <li>
              <strong>Edits not saving:</strong> Ensure Edit mode is enabled before changing lines or header fields.
            </li>
            <li>
              <strong>Posting too early:</strong> Once posted, editing is locked. If changes are needed,
              create a new project or duplicate the lines before posting again.
            </li>
            <li>
              <strong>Unlinked Sales Order:</strong> If billing is required, ensure a Sales Order is linked before posting.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Where do totals come from?</p>
            <p>Totals are calculated from each line’s sell price and quantity after recalculation.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I edit after posting?</p>
            <p>Posting locks the project. If edits are required, create a new project or update the Sales Order separately.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Does the project consume inventory?</p>
            <p>Inventory consumption is not automatically handled in the plasma project workflow.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No automated DXF parsing or nesting in-app.</li>
            <li>Limited reporting outside of project lists and linked Sales Orders.</li>
            <li>No automated workflow statuses beyond what the UI exposes.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
