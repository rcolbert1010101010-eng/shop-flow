import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PlasmaTemplatesDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Plasma Templates" backTo="/plasma/templates" />

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
            Plasma Templates are reusable cut line definitions. They help you standardize repeat work,
            reduce setup time, and keep pricing consistent across similar jobs. Templates can be applied
            to new or existing Plasma Projects.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>When you cut the same parts frequently.</li>
            <li>When you need consistent cut line inputs across operators.</li>
            <li>When you want faster project creation with prebuilt lines.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Template header:</strong> Name and description for quick recognition.</li>
            <li><strong>Template lines:</strong> Default quantity, cut length, pierce count, and notes.</li>
            <li><strong>Application:</strong> Applying a template inserts its lines into a project.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Create a template</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Plasma Templates and click Create.</li>
              <li>Enter a name and optional description.</li>
              <li>Add cut lines with default quantities, cut length, and pierce counts.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Edit a template</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the template detail page.</li>
              <li>Update the header or add/remove lines.</li>
              <li>Save changes to apply them to future uses.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Apply to a project</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open a Plasma Project and select Add from Template.</li>
              <li>Choose a template to insert its lines.</li>
              <li>Adjust quantities or inputs as needed, then recalculate pricing.</li>
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
            <li>Template names should be unique and descriptive for easy selection.</li>
            <li>Deleting a template does not remove lines already applied to projects.</li>
            <li>Template lines are defaults; project lines can be edited after applying.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Using generic names that make templates hard to identify.</li>
            <li>Forgetting to update templates after process changes.</li>
            <li>Assuming template edits will retroactively change existing projects.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Is there versioning?</p>
            <p>Templates update in place. If you need a new version, duplicate the template with a new name.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I apply multiple templates?</p>
            <p>Yes. Each application inserts its lines; review totals and recalculate pricing afterward.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No explicit version history or change log for templates.</li>
            <li>Template fields are limited to the line defaults shown in the UI.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
