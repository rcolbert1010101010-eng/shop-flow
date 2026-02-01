import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function UsersDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Users" backTo="/users" />

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
            Users are staff accounts that can sign in to ShopFlow. A user record represents a person,
            while tenant membership determines which shop they can access and what role they have.
            The Users page is where administrators create accounts, assign roles, and control access.
          </p>
          <p>
            This module does not send invitation emails. Users authenticate with a username and password
            that your admin sets during creation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Onboard a new employee or contractor who needs access to ShopFlow.</li>
            <li>Change a team member's role when responsibilities shift.</li>
            <li>Deactivate or remove access when someone leaves the organization.</li>
            <li>Update display names so reports and audit entries are accurate.</li>
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
              <strong>User vs tenant membership:</strong> A user can exist in the system, but they only
              appear in your Users list when they are a member of your active tenant.
            </li>
            <li>
              <strong>Username login:</strong> Usernames are normalized to lowercase and are used to build
              an internal email for authentication. There are no email invites in this flow.
            </li>
            <li>
              <strong>Roles:</strong> The Users page assigns one of the supported roles:
              ADMIN, MANAGER, SERVICE_WRITER, TECHNICIAN, PARTS_MANAGER, SALES_COUNTER, GUEST.
            </li>
            <li>
              <strong>Active status:</strong> Inactive users are effectively disabled for the tenant.
            </li>
            <li>
              <strong>Idempotent creation:</strong> Creating a user with an existing username reuses the
              account and resets password and metadata, then reattaches the tenant membership.
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
            <p className="font-medium text-foreground">Create a user</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Users and select Create User (username/password).</li>
              <li>Enter a username (lowercase letters and numbers with . _ - only, no spaces).</li>
              <li>Optionally add a full name for display in lists and reports.</li>
              <li>Set a password and confirm it, then choose a role.</li>
              <li>Click Create User. If the username already exists, the account is reused and updated.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Edit a user</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Click Edit on the user row to enter edit mode.</li>
              <li>Update full name, role, or active status.</li>
              <li>Click Save to apply changes or Cancel to discard.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Remove a user from the tenant</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Click Remove and confirm the dialog.</li>
              <li>The user is deactivated and the tenant membership is removed.</li>
              <li>To re-enable later, create the same username again to reattach the membership.</li>
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
            Access to the Users page is restricted. Only admins or roles with the settings.edit permission
            can create, edit, or remove users. If you do not see the page or actions, contact an administrator.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules / Constraints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Usernames are normalized to lowercase and must be letters/numbers with . _ - only.</li>
            <li>Usernames are unique system-wide; duplicates reuse the existing account.</li>
            <li>Passwords are required and must match the confirmation field.</li>
            <li>Roles must be one of the supported values listed in the role selector.</li>
            <li>Removing a user deactivates them and removes tenant membership.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Using uppercase letters or spaces in usernames, which causes validation errors.</li>
            <li>Forgetting to click Save after entering edit mode.</li>
            <li>Assigning a role that does not match the user's job responsibilities.</li>
            <li>Expecting invitation emails for new users (none are sent).</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Can I change a username?</p>
            <p>Usernames are not editable in the Users page. Create a new user with the new username and remove the old one if needed.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">What happens if I create a user with an existing username?</p>
            <p>The system reuses the existing account, updates the password and metadata, and restores tenant membership.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Why is there no email field?</p>
            <p>Authentication is username-based. The system generates an internal email behind the scenes.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">How do I reset a password?</p>
            <p>Create the same username again with a new password to reset it.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No invitation emails or self-service onboarding flows.</li>
            <li>No bulk user import from the Users screen.</li>
            <li>Usernames cannot be edited after creation.</li>
            <li>Password reset is handled by recreating the user, not by a dedicated reset flow.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
