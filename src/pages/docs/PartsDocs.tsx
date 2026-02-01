import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsLayout } from '@/components/docs/DocsLayout';

export default function PartsDocs() {
  return (
    <DocsLayout moduleKey="parts">
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The Parts Catalog is the master list of items you buy, stock, and sell. Each part record can
            store identification details, vendor and category data, costs and prices, and inventory settings.
            These records are used throughout inventory, receiving, sales, and work order flows.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Create a new part before receiving or selling it.</li>
            <li>Update costs, pricing, or vendor assignments.</li>
            <li>Adjust quantity on hand after counts or corrections.</li>
            <li>Configure kits or sheet materials that require special handling.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Part number:</strong> Required identifier; normalized to uppercase in the UI.</li>
            <li><strong>Vendor and category:</strong> Optional but recommended for purchasing and reporting.</li>
            <li><strong>UOM:</strong> Defines how quantities are measured (each, feet, sheet, etc.).</li>
            <li><strong>Costs and pricing:</strong> Base cost, selling price, and suggested price references.</li>
            <li><strong>Inventory controls:</strong> Min/max quantity, bin location, and QOH adjustments.</li>
            <li><strong>Special parts:</strong> Kits, consumables, core charges, and sheet material metadata.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Create a part</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Go to Inventory and select New Part.</li>
              <li>Enter a part number and description.</li>
              <li>Assign vendor, category, UOM, and bin location as needed.</li>
              <li>Set cost and selling price, then save.</li>
              <li>If needed, enter an initial quantity on hand adjustment.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Adjust quantity on hand</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the part and select Adjust QOH.</li>
              <li>Enter the new quantity and provide a reason.</li>
              <li>Save to record the adjustment.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Create a kit or material part</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Enable the kit or material options on the part form.</li>
              <li>Define component parts and quantities for kits.</li>
              <li>For sheet materials, enter dimensions and thickness when applicable.</li>
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
            Access and edit permissions are role-based. If create or edit controls are unavailable,
            contact an administrator to review your permissions.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules / Constraints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Part numbers must be unique; duplicates are blocked in the UI.</li>
            <li>Cost and price fields require valid numbers.</li>
            <li>QOH adjustments should include a reason for auditability.</li>
            <li>Some fields are conditional, such as sheet dimensions for material parts.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Leaving vendor or category blank, which makes purchasing harder.</li>
            <li>Using inconsistent part numbers across similar items.</li>
            <li>Adjusting QOH without documenting the reason.</li>
            <li>Forgetting to update selling price when cost changes.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Do parts automatically consume inventory?</p>
            <p>Inventory changes are driven by receiving, adjustments, and workflow usage. Review each flow for how it affects QOH.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">What are suggested prices?</p>
            <p>Suggested prices are informational references. You can override selling price as needed.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I track kits?</p>
            <p>Yes. Enable the kit option and assign component parts and quantities.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No bulk edit tool for part fields from the catalog list.</li>
            <li>Price rules and automation are limited to the fields on the part form.</li>
            <li>Some advanced inventory behaviors may require external procedures.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
    </DocsLayout>
  );
}
