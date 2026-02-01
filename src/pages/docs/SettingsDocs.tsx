import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsLayout } from '@/components/docs/DocsLayout';

export default function SettingsDocs() {
  return (
    <DocsLayout moduleKey="settings">
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Settings control how ShopFlow behaves for your organization. This includes shop details,
            pricing defaults, inventory policies, and system preferences like theme and units.
            Settings also manage tenant membership and integrations.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Configure default rates, markups, or tax behavior for pricing.</li>
            <li>Update shop profile information used in documents and reports.</li>
            <li>Switch the active tenant or create a new tenant if allowed.</li>
            <li>Manage integrations such as QuickBooks when available.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Edit mode:</strong> Settings changes are staged and saved when you click Save.</li>
            <li><strong>Tenant context:</strong> The active tenant determines which records you see across the app.</li>
            <li><strong>System settings registry:</strong> Settings are validated before they are applied.</li>
            <li><strong>Theme:</strong> Display preferences can be switched without changing data.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Edit system settings</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Settings and click Edit.</li>
              <li>Update values such as shop name, default rates, or pricing rules.</li>
              <li>Click Save to apply changes or Cancel to discard.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Switch active tenant</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>In the Tenants section, choose a tenant from the Active Tenant selector.</li>
              <li>The app refreshes to show records scoped to the selected tenant.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Integrations</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Navigate to the Integrations section.</li>
              <li>Open the integration detail (for example, QuickBooks) and follow the prompts.</li>
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
            Editing settings requires the settings.edit permission. If you do not have access, the page may
            show values in read-only mode or hide editing controls.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules / Constraints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Changes are validated before saving; invalid values will be rejected.</li>
            <li>Settings edits are applied in the context of your active tenant.</li>
            <li>Some fields are numeric and require valid numbers (rates, percentages).</li>
            <li>Switching tenants changes the data you see across the application.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Editing values without clicking Save before navigating away.</li>
            <li>Adjusting settings while the wrong tenant is active.</li>
            <li>Entering percentage values with extra symbols or text.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Why can I not edit Settings?</p>
            <p>You likely lack the settings.edit permission. Ask an admin to grant access.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Which tenant am I editing?</p>
            <p>Settings are tied to your active tenant. Check the Tenants section before saving changes.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Do settings changes apply immediately?</p>
            <p>Yes, once saved they apply right away for the active tenant.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No bulk export or import of settings from the UI.</li>
            <li>Editing requires explicit permission and cannot be delegated per field.</li>
            <li>Settings are applied per active tenant and do not span multiple tenants at once.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
    </DocsLayout>
  );
}
