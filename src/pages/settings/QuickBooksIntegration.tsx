import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { useQuickBooksIntegration } from '@/hooks/useQuickBooksIntegration';
import { usePermissions } from '@/security/usePermissions';

const providerName = 'QuickBooks';

export default function QuickBooksIntegration() {
  const { toast } = useToast();
  const { can, role } = usePermissions();
  const canEdit = can('settings.edit') || role === 'ADMIN';
  const { connection, config, loading, saving, error, saveConfig, createTestExport, listRecentExports } = useQuickBooksIntegration();
  const [connectedStatus, setConnectedStatus] = useState(connection?.status ?? 'DISCONNECTED');
  const [draft, setDraft] = useState(config);
  const [exports, setExports] = useState<any[]>([]);

  const handleSave = async () => {
    if (!draft) return;
    await saveConfig(draft);
    toast({ title: 'Settings saved', description: 'QuickBooks integration settings updated.' });
  };

  const handleTestExport = async () => {
    if (!draft) return;
    const payload = {
      schema_version: 1,
      source: { type: 'WORK_ORDER', id: 'TEST', number: 'TEST' },
      customer: { shopflow_customer_id: 'TEST', display_name: 'Test Customer' },
      invoice: { invoice_number: 'TEST-001', invoice_date: new Date().toISOString() },
      lines: [
        { kind: 'LABOR', amount: 0, account_ref: draft.income_account_labor },
        { kind: 'PARTS', amount: 0, account_ref: draft.income_account_parts },
      ],
      tax: { amount: 0, liability_account_ref: draft.liability_account_sales_tax },
      total: 0,
    };
    const result = await createTestExport(payload);
    if (!result?.success) {
      toast({ title: 'Test export failed', description: result?.error ?? 'Unknown error', variant: 'destructive' });
      return;
    }
    toast({ title: 'Test export queued', description: 'A test export payload was written to accounting_exports.' });
    const rows = await listRecentExports();
    setExports(rows);
  };

  useEffect(() => {
    setConnectedStatus(connection?.status ?? 'DISCONNECTED');
  }, [connection?.status]);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  useEffect(() => {
    const loadExports = async () => {
      const rows = await listRecentExports();
      setExports(rows);
    };
    void loadExports();
  }, [listRecentExports]);

  const statusBadge = useMemo(() => {
    const status = connectedStatus || 'DISCONNECTED';
    const color =
      status === 'CONNECTED' ? 'bg-green-100 text-green-700' : status === 'EXPIRED' || status === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
    return <span className={`px-2 py-1 rounded-md text-xs font-semibold ${color}`}>{status}</span>;
  }, [connectedStatus]);

  if (loading || !draft) {
    return (
      <div className="page-container">
        <PageHeader title="QuickBooks Integration" backTo="/settings" />
        <Card>
          <CardContent className="p-6 text-muted-foreground">Loading…</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container space-y-4">
      <PageHeader title="QuickBooks Integration" backTo="/settings" />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!canEdit && (
        <Alert variant="default">
          <AlertTitle>Admin required</AlertTitle>
          <AlertDescription>Contact an administrator to configure QuickBooks integration.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{providerName}</div>
              <div className="text-xs text-muted-foreground">Status: {statusBadge}</div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConnectedStatus('CONNECTED')}
                disabled={saving || !canEdit}
              >
                Simulate Connect
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConnectedStatus('DISCONNECTED')}
                disabled={saving || !canEdit}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mode</Label>
                <Select
                  value={draft.mode}
                  onValueChange={(val) => setDraft((prev) => (prev ? { ...prev, mode: val } : prev))}
                  disabled={!canEdit}
                >
                <SelectTrigger>
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INVOICE_ONLY">Invoice only</SelectItem>
                  <SelectItem value="INVOICE_AND_PAYMENTS">Invoice + payments</SelectItem>
                  <SelectItem value="EXPORT_ONLY">Export-only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Calculation source</Label>
                <Select
                  value={draft.calculation_source}
                  onValueChange={(val) => setDraft((prev) => (prev ? { ...prev, calculation_source: val } : prev))}
                  disabled={!canEdit}
                >
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHOPFLOW">ShopFlow</SelectItem>
                  <SelectItem value="QUICKBOOKS">QuickBooks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Line item strategy</Label>
                <Select
                  value={draft.line_item_strategy}
                  onValueChange={(val) => setDraft((prev) => (prev ? { ...prev, line_item_strategy: val } : prev))}
                  disabled={!canEdit}
                >
                <SelectTrigger>
                  <SelectValue placeholder="Strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROLLUP">Roll-up</SelectItem>
                  <SelectItem value="DETAILED">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Customer match strategy</Label>
                <Select
                  value={draft.customer_match_strategy}
                  onValueChange={(val) => setDraft((prev) => (prev ? { ...prev, customer_match_strategy: val } : prev))}
                  disabled={!canEdit}
                >
                <SelectTrigger>
                  <SelectValue placeholder="Strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DISPLAY_NAME">Display Name</SelectItem>
                  <SelectItem value="NAME_PLUS_PHONE">Name + Phone</SelectItem>
                  <SelectItem value="EXTERNAL_REF_ONLY">External Ref Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Income Account (Labor)</Label>
              <Input
                value={draft.income_account_labor ?? ''}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, income_account_labor: e.target.value } : prev))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Income Account (Parts)</Label>
              <Input
                value={draft.income_account_parts ?? ''}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, income_account_parts: e.target.value } : prev))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Income Account (Fees/Sublet)</Label>
              <Input
                value={draft.income_account_fees ?? ''}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, income_account_fees: e.target.value } : prev))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Liability Account (Sales Tax)</Label>
              <Input
                value={draft.liability_account_sales_tax ?? ''}
                onChange={(e) =>
                  setDraft((prev) => (prev ? { ...prev, liability_account_sales_tax: e.target.value } : prev))
                }
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Clearing Account (Undeposited Funds)</Label>
              <Input
                value={draft.clearing_account_undeposited_funds ?? ''}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev ? { ...prev, clearing_account_undeposited_funds: e.target.value } : prev
                  )
                }
                disabled={!canEdit}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm">Enable Integration</Label>
              <p className="text-xs text-muted-foreground">Toggle to enable QuickBooks export</p>
            </div>
            <Switch
              checked={draft.is_enabled}
              onCheckedChange={(checked) => setDraft((prev) => (prev ? { ...prev, is_enabled: checked } : prev))}
              disabled={!canEdit}
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving || !canEdit}>
              Save
            </Button>
            <Button variant="outline" onClick={handleTestExport} disabled={saving || !canEdit}>
              Test Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Exports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {exports.length === 0 ? (
            <div className="text-muted-foreground text-sm">No exports yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Status</th>
                  <th className="text-left py-1">Type</th>
                  <th className="text-left py-1">Created</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((exp) => (
                  <tr key={exp.id}>
                    <td className="py-1">{exp.status}</td>
                    <td className="py-1">{exp.export_type}</td>
                    <td className="py-1">{exp.created_at ? new Date(exp.created_at).toLocaleString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
