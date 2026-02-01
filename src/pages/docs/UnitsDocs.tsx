import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function UnitsDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Units" backTo="/units" />

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
            Units represent the assets you service. A unit can be a vehicle, machine, or equipment item
            associated with a customer. Units help link service history, work orders, and identifying
            information such as model and serial numbers.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>When tracking service history for a specific asset.</li>
            <li>When a customer owns multiple units and you need clear identification.</li>
            <li>When work orders should reference equipment details.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Unit record:</strong> The primary asset profile with identifiers.</li>
            <li><strong>Customer association:</strong> A unit is typically owned by a customer.</li>
            <li><strong>Unit type:</strong> Classification that helps group assets by category.</li>
            <li><strong>Service history:</strong> Work orders linked to the unit provide a timeline of activity.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Create a unit</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Units and click New Unit.</li>
              <li>Select the customer who owns the unit.</li>
              <li>Enter identifying details (model, serial, etc.).</li>
              <li>Save to add the unit to the catalog.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Edit a unit</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the unit record from the list.</li>
              <li>Update the fields that changed.</li>
              <li>Save to keep work orders accurate.</li>
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
            <li>Units should be linked to the correct customer to maintain service history.</li>
            <li>Identifiers like serial numbers should be consistent for searching.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Creating duplicate units instead of updating an existing record.</li>
            <li>Assigning a unit to the wrong customer.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Do I need a unit for every work order?</p>
            <p>Use units when asset tracking is important. Some work orders may be created without a unit.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I move a unit to a different customer?</p>
            <p>Yes. Update the customer field on the unit record if ownership changes.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No bulk import or export of units from the UI.</li>
            <li>Unit history is derived from linked work orders only.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
