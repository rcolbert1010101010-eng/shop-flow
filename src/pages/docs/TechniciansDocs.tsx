import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TechniciansDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Technicians" backTo="/technicians" />

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
            The Technicians module is your roster of service staff. Technician records are used for
            assignment, visibility, and reporting across work orders and scheduling. Keeping this list
            accurate helps ensure accountability and workload balance.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Add a technician when a new employee starts.</li>
            <li>Update technician details when a role or contact changes.</li>
            <li>Deactivate or archive technicians who are no longer active.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Technician record:</strong> Represents an individual who can be assigned work.</li>
            <li><strong>Status:</strong> Active technicians appear in assignment lists.</li>
            <li><strong>Contact info:</strong> Optional details for internal coordination.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Create a technician</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Technicians and click Add Technician.</li>
              <li>Enter name and any optional contact details.</li>
              <li>Save to add them to assignment lists.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Edit a technician</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the technician record.</li>
              <li>Update fields as needed.</li>
              <li>Save to apply changes.</li>
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
            <li>Technicians must be active to appear in assignment selectors.</li>
            <li>Names should be unique enough to avoid confusion during scheduling.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Leaving inactive technicians enabled, which clutters assignment lists.</li>
            <li>Creating duplicate technician entries for the same person.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Is a technician the same as a user?</p>
            <p>No. A technician record is a staffing entity. Users are login accounts.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I assign work without a technician?</p>
            <p>Work orders can exist without assignment, but assignments improve tracking.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No automated technician utilization reports from this page.</li>
            <li>No bulk import or export of technician lists in the UI.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
