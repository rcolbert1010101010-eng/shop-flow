import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuickBooksIntegration } from '@/hooks/useQuickBooksIntegration';
import { usePermissions } from '@/security/usePermissions';
import { useAuthStore } from '@/stores/authStore';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Download, Eye } from 'lucide-react';

export default function QuickBooksIntegration() {
  const { toast } = useToast();
  const { role } = usePermissions();
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const ensureActiveTenant = useAuthStore((state) => state.ensureActiveTenant);
  const authUserId = useAuthStore((state) => state.user?.id ?? state.profile?.id ?? '');
  const isAdmin = role === 'ADMIN';

  const {
    connection, config, loading, saving, error,
    saveConfig, listRecentExports, getExportPayload, retryExport,
  } = useQuickBooksIntegration();

  const [exports, setExports] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [payloadDialogOpen, setPayloadDialogOpen] = useState(false);
  const [payloadContent, setPayloadContent] = useState('');
  const [draft, setDraft] = useState(config);
  const [savingConfig, setSavingConfig] = useState(false);

  const isConnected = connection?.status === 'CONNECTED' || connection?.status === 'ACTIVE';

  useEffect(() => { setDraft(config); }, [config]);

  useEffect(() => {
    listRecentExports(50).then(setExports);
  }, [listRecentExports]);

  const resolveTenantId = useCallback(async () => {
    let tenantId = String(activeTenantId || '').trim();
    if (!tenantId) {
      const ensured = await ensureActiveTenant(authUserId || undefined);
      tenantId = String(ensured || '').trim();
    }
    return tenantId;
  }, [activeTenantId, ensureActiveTenant, authUserId]);

  const handleConnect = async () => {
    if (!supabase) return;
    setConnectError(null);
    setConnecting(true);
    try {
      const tenantId = await resolveTenantId();
      if (!tenantId) { setConnectError('No active tenant found.'); return; }
      const { data, error } = await supabase.functions.invoke('qb-oauth-start', {
        headers: { 'x-shopflow-tenant-id': tenantId },
        body: {},
      });
      if (error) { setConnectError(error.message); return; }
      const url = data?.url;
      if (!url) { setConnectError('No authorization URL returned.'); return; }
      window.location.href = url;
    } catch (err) {
      setConnectError(err?.message || 'Unknown error');
    } finally {
      setConnecting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!draft) return;
    setSavingConfig(true);
    const result = await saveConfig(draft);
    setSavingConfig(false);
    if (!result.ok) {
      toast({ title: 'Save failed', description: result.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Settings saved' });
  };

  const handleViewPayload = async (exportId) => {
    const payload = await getExportPayload(exportId);
    setPayloadContent(payload ? JSON.stringify(payload, null, 2) : 'No payload found.');
    setPayloadDialogOpen(true);
  };

  const handleRetry = async (exportId) => {
    const result = await retryExport(exportId);
    if (!result?.success) {
      toast({ title: 'Retry failed', description: result?.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Export reset to PENDING' });
    listRecentExports(50).then(setExports);
  };

  const handleDownloadExport = async (exportId) => {
    const payload = await getExportPayload(exportId);
    if (!payload) { toast({ title: 'No payload found', variant: 'destructive' }); return; }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopflow-export-' + exportId.slice(0, 8) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'SENT') return <Badge className="bg-green-100 text-green-700 border-0">Sent</Badge>;
    if (s === 'PENDING' || s === 'PROCESSING') return <Badge className="bg-amber-100 text-amber-700 border-0">Pending</Badge>;
    if (s === 'FAILED') return <Badge className="bg-red-100 text-red-700 border-0">Failed</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  if (loading || !draft) {
    return (
      <div className="page-container">
        <PageHeader title="QuickBooks Integration" backTo="/settings" />
        <Card><CardContent className="p-6 text-muted-foreground">Loading...</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <PageHeader title="QuickBooks Integration" backTo="/settings" />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? <CheckCircle className="text-green-500 w-5 h-5" /> : <XCircle className="text-red-500 w-5 h-5" />}
            Step 1 — Connect to QuickBooks
          </CardTitle>
          <CardDescription>Authorize ShopFlow to send invoices to your QuickBookOnline account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectError && <Alert variant="destructive"><AlertDescription>{connectError}</AlertDescription></Alert>}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div>
              <div className="font-medium">QuickBooks Online</div>
              <div className="text-sm text-muted-foreground">
                Status: <span className={isConnected ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{isConnected ? 'Connected' : 'Not Connected'}</span>
              </div>
              {connection?.external_realm_id && <div className="text-xs text-muted-foreground mt-1">Company ID: {connection.external_realm_id}</div>}
            </div>
            {isAdmin && (
              <Button onClick={handleConnect} disabled={connecting} variant={isConnected ? 'outline' : 'default'}>
                {connecting ? 'Connecting...' : isConnected ? 'Reconnect' : 'Connect to QuickBooks'}
              </Button>
            )}
          </div>
          {!isAdmin && <p className="text-sm text-muted-foreground">Only administrators can connect QuickBooks.</p>}
        </CardContent>
      </Card>

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="text-amber-500 w-5 h-5" />
              Step 2 — Map QuickBooks Items
            </CardTitle>
            <CardDescription>
              Tell ShopFlow which QuickBooks Products and Services items to use for each charge type.
              In QuickBooks go to Sal then Products and Services to find item IDs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Labor Item ID</Label>
                <Input placeholder="e.g. 19" value={draft.qb_item_ref_labor ?? ''} onChange={(e) => setDraft((p) => ({ ...p, qb_item_ref_labor: e.target.value }))} disabled={!isAdmin} />
                <p className="text-xs text-muted-foreground">Used for all labor charges</p>
              </div>
              <div className="space-y-1">
                <Label>Parts Item ID</Label>
                <Input placeholder="e.g. 20" value={draft.qb_item_ref_parts ?? ''} onChange={(e) => setDraft((p) => ({ ...p, qb_item_ref_parts: e.target.value }))} disabled={!isAdmin} />
                <p className="text-xs text-muted-foreground">Used for all parts charges</p>
              </div>
              <div className="space-y-1">
                <Label>Fees / Sublet Item ID</Label>
                <Input placeholder="e.g. 21" value={draft.qb_item_ref_fees_sublet ?? ''} onChange={(e) => setDraft((p) => ({ ...p, qb_item_ref_fees_sublet: e.target.value }))} disabled={!isAdmin} />
                <p className="text-xs text-muted-foreground">Used for fees and sublet charges</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Default Customer ID</Label>
              <Input placeholder="e.g. 1" value={draft.qb_customer_ref ?? ''} onChange={(e) => setDraft((p) => ({ ...p, qb_customer_ref: e.target.value }))} disabled={!isAdmin} />
              <p className="text-xs text-muted-foreground">Fallback QuickBooks customer when no match is found.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 — Choose How to Send Invoices</CardTitle>
            <CardDescription>Choose whether ShopFlow sends invoices automatically or you export them manually.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grigrid-cols-1 md:grid-cols-2 gap-4">
              <div
                className={"p-4 border-2 rounded-lg cursor-pointer transition-colors " + (draft.transfer_mode === 'IMPORT_ONLY' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50')}
                onClick={() => isAdmin && setDraft((p) => ({ ...p, transfer_mode: 'IMPORT_ONLY' }))}
              >
                <div className="font-semibold mb-1">Manual Export</div>
                <div className="text-sm text-muted-foreground">You control when invoices are sent. Download and review exports before sending. Best for shops that want full control.</div>
              </div>
              <div
                className={"p-4 border-2 rounded-lg cursor-pointer transition-colors " + (draft.transfer_mode === 'LIVE_TRANSFER' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50')}
                onClick={() => isAdmin && setDraft((p) => ({ ...p, transfer_mode: 'LIVE_TRANSFER' }))}
              >
                <div className="font-semibold mb-1">Live Transfer (Automatic)</div>
                <div className="text-sm text-muted-foreground">Invoices are automatically sent to QuickBooks when finalized. Best for high-volume shops.</div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label className="text-sm font-medium">Enable Integration</Label>
                <p className="text-xs text-muted-foreground">Turn off to pause all exports without losing your settings</p>
              </div>
              <Switch checked={draft.is_enabled} onCheckedChange={(checked) => setDraft((p) => ({ ...p, is_enabled: checked }))} disabled={!isAdmin} />
            </div>
            {isAdmin && (
              <Button onClick={handleSaveConfig} disabled={savingConfig || saving}>
                {savingConfig ? 'Saving...' : 'Save Settings'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Export History</CardTitle>
            <CardDescription>
              Recent invoices queued for QuickBooks.{' '}
              {draft.transfer_mode === 'IMPORT_ONLY' ? 'Download exports to send them manually.' : 'Live Transfer sends these automatically every 5 minutes.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {exports.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No exports yet. Exports appear here when invoices are finalized.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b">
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Type</th>
                      <th className="text-left py-2">Created</th>
                      <th className="text-left py-2">Attempts</th>
                      <th className="text-left py-2">Error</th>
                      <th className="text-right py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {exports.map((exp) => (
                      <tr key={exp.id} className="align-middle">
                        <td className="py-2">{statusBadge(exp.status)}</td>
                        <td className="py-2">{exp.export_type}</td>
                        <td className="py-2 text-muted-foreground text-xs">{exp.created_at ? new Date(exp.created_at).toLocaleString() : ''}</td>
                        <td className="py-2">{exp.attempt_count ?? 0}</td>
                        <td className="py-2 max-w-xs truncate text-xs text-red-600">{exp.last_error ?? ''}</td>
                        <td className="py-2">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleViewPayload(exp.id)}><Eye className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDownloadExport(exp.id)}><Download className="w-4 h-4" /></Button>
                            {isAdmin && exp.status !== 'SENT' && <Button size="sm" variant="ghost" onClick={() => handleRetry(exp.id)}><RefreshCw className="w-4 h-4" /></Button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={payloadDialogOpen} onOpenChange={setPayloadDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Export Payload</DialogTitle>
            <DialogDescription>JSON payload for this export</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pb-2">
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(payloadContent)}>Copy</Button>
          </div>
          <div className="border rounded-md bg-muted/40 max-h-96 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">{payloadContent || 'No payload'}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
