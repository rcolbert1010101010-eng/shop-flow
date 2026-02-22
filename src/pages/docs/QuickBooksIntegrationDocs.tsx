import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsLayout } from '@/components/docs/DocsLayout';

export default function QuickBooksIntegrationDocs() {
  return (
    <DocsLayout moduleKey="quickbooks_integration">
      <div className="space-y-6">

        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              The QuickBooks Integration connects ShopFlow to your QuickBooks Online account so that
              invoices are automatically recorded in your accounting system. You can choose between
              two modes: Live Transfer, where invoices post automatically, or Manual Export, where
              you download and review export files before sending them to QuickBooks.
            </p>
            <p>
              Setup takes about five minutes and only needs to be done once. After setup, ShopFlow
              handles the rest automatically.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Before You Begin</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You will need the following before setting up the integration:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>An active QuickBooks Online account (Simple Start or higher).</li>
              <li>Admin access in ShopFlow.</li>
              <li>Three service items created in QuickBooks for Labor, Parts, and Fees/Sublet. Create these in QuickBooks under Sales then Products and Services.</li>
              <li>The item ID numbers for each of those three items.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Step 1 - Connect to QuickBooks</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Go to Settings then Integrations then QuickBooks.</li>
              <li>Click <strong>Connect to QuickBooks</strong>.</li>
              <li>You will be redirected to Intuit to authorize the connection. Sign in with your QuickBooks Online credentials.</li>
              <li>After authorizing, you will be redirected back to ShopFlow. The status will show <strong>Connected</strong> with your Company ID.</li>
            </ol>
            <p className="mt-2">
              The connection uses OAuth 2.0 and tokens are stored securely. You can reconnect at any time if the connection expires.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Step 2 - Map QuickBooks Items</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              ShopFlow needs to know which QuickBooks Products and Services items to use for each type
              of charge on an invoice. This mapping ensures your invoices appear correctly in QuickBooks.
            </p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>In QuickBooks, go to Sales then Products and Services.</li>
              <li>Find or create a service item for Labor. Note its ID number.</li>
              <li>Find or create a service item for Parts. Note its ID number.</li>
              <li>Find or create a service item for Fees and Sublet work. Note its ID number.</li>
              <li>Back in ShopFlow, enter those ID numbers in the Labor, Parts, and Fees/Sublet fields.</li>
              <li>Enter a Default Customer ID to use as a fallback when no QuickBooks customer matches.</li>
              <li>Click <strong>Save Settings</strong>.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Step 3 - Choose How to Send Invoices</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>ShopFlow supports two transfer modes. Choose the one that fits your shop.</p>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-foreground">Manual Export</p>
                <p>
                  Invoices are queued in ShopFlow but not sent automatically. You review the export history,
                  download the JSON payload for any export, and send it to QuickBooks on your own schedule.
                  Good for shops that want to review every invoice before it appears in QuickBooks.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Live Transfer (Automatic)</p>
                <p>
                  Invoices are automatically sent to QuickBooks within five minutes of being finalized.
                  No manual action required. Best for high-volume shops that want real-time sync.
                </p>
              </div>
            </div>
            <p>
              After choosing a mode, toggle <strong>Enable Integration</strong> on and click <strong>Save Settings</strong>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>How Manual Export Works</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-2">
              <li>When an invoice is finalized, it is queued in the Export History table with a <strong>Pending</strong> status.</li>
              <li>Go to the QuickBooks Integration page and scroll to Export History.</li>
              <li>Find the export you want and click the <strong>Download</strong> icon to get the JSON payload.</li>
              <li>Click the <strong>View</strong> icon to inspect the payload before downloading.</li>
              <li>Send the file to your accountant or use it with QuickBooks import tools.</li>
              <li>If an export failed or needs to be resent, click <strong>Retry</strong> to reset it to Pending.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>How Live Transfer Works</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-2">
              <li>When an invoice is finalized, it is automatically queued for export.</li>
              <li>A background job runs every five minutes and posts pending exports to QuickBooks.</li>
              <li>The export status updates to <strong>Sent</strong> once QuickBooks confirms receipt.</li>
              <li>If an export fails, it retries automatically at 5, 15, and 60 minute intervals.</li>
              <li>Monitor all exports in the Export History table.</li>
              <li>If an export is stuck in a failed state, click <strong>Retry</strong> to manually reset it.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Export History</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>The Export History table shows all invoices queued for QuickBooks export.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Pending:</strong> Queued and waiting to be sent.</li>
              <li><strong>Sent:</strong> Successfully posted to QuickBooks.</li>
              <li><strong>Failed:</strong> An error occurred. Check the Error column for details.</li>
            </ul>
            <p className="mt-2">Actions available on each export:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>View:</strong> Inspect the full JSON payload.</li>
              <li><strong>Download:</strong> Download the payload as a JSON file.</li>
              <li><strong>Retry:</strong> Reset a failed export back to Pending.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Permissions</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              <li>Only <strong>Administrators</strong> can connect QuickBooks, change settings, and save configuration.</li>
              <li>Non-admin users can view Export History and connection status but cannot make changes.</li>
              <li>Exports are queued automatically when any user finalizes an invoice, regardless of role.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Common Issues</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Export shows Failed:</strong> Check the Error column. Common causes are expired tokens (reconnect QuickBooks) or invalid item IDs.</li>
              <li><strong>No exports appearing:</strong> Make sure Enable Integration is toggled on and saved.</li>
              <li><strong>Invoice not exporting:</strong> The invoice must have ISSUED status. Draft or voided invoices are not exported.</li>
              <li><strong>Duplicate export warning:</strong> ShopFlow detects duplicates automatically and will not send the same invoice twice.</li>
              <li><strong>Connection expired:</strong> Tokens expire after 100 days of inactivity. Click Reconnect to re-authorize.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>FAQ</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Does ShopFlow support QuickBooks Desktop?</p>
              <p>No. Only QuickBooks Online is supported.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">What happens if QuickBooks is down when an invoice is finalized?</p>
              <p>The export is queued in ShopFlow and will retry automatically when QuickBooks is available again.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Can I pause exports without disconnecting?</p>
              <p>Yes. Toggle Enable Integration off and save. Your settings and connection are preserved.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Will switching modes affect existing pending exports?</p>
              <p>No. Pending exports stay in the queue. The mode change only affects new exports going forward.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Where do I find QuickBooks item IDs?</p>
              <p>In QuickBooks, go to Sales then Products and Services. If IDs are not visible in the UI, ask your accountant to look them up via the QuickBooks API.</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </DocsLayout>
  );
}
