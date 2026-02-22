import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { quickbooksIntegrationHelp } from '@/help/quickbooksIntegrationHelp';
// Roadmap: see docs/accounting/quickbooks_roadmap.md for phased implementation details.
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuickBooksIntegration } from '@/hooks/useQuickBooksIntegration';
import { usePermissions } from '@/security/usePermissions';
import { useAuthStore } from '@/stores/authStore';

const providerName = 'QuickBooks';

export default function QuickBooksIntegration() {
  const { toast } = useToast();
  const { can, role } = usePermissions();
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const ensureActiveTenant = useAuthStore((state) => state.ensureActiveTenant);
  const authUserId = useAuthStore((state) => state.user?.id ?? state.profile?.id ?? '');
  const isAdmin = role === 'ADMIN';
  const canEdit = can('settings.edit') || role === 'ADMIN';
  const {
    connection,
    config,
    loading,
    saving,
    error,
    saveConfig,
    createTestExport,
    listRecentExports,
    getExportPayload,
    retryExport,
  } = useQuickBooksIntegration();
  const [connectedStatus, setConnectedStatus] = useState(connection?.status ?? 'DISCONNECTED');
  const [draft, setDraft] = useState(config);
  const [exports, setExports] = useState<any[]>([]);
  const [payloadDialogOpen, setPayloadDialogOpen] = useState(false);
  const [payloadContent, setPayloadContent] = useState<string>('');
  const [payloadLoading, setPayloadLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [senderRunning, setSenderRunning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectErrorDetails, setConnectErrorDetails] = useState<string | null>(null);
  const [oauthStartAvailable, setOauthStartAvailable] = useState<boolean | null>(null);
  const [checkingOauthStart, setCheckingOauthStart] = useState(false);
  const transferMode = draft?.transfer_mode ?? 'IMPORT_ONLY';
  const isLiveTransfer = transferMode === 'LIVE_TRANSFER';
  const realmMissingWhileConnected = connection?.status === 'CONNECTED' && !connection?.external_realm_id;

  const resolveTenantId = useCallback(async () => {
    let tenantId = String(activeTenantId || '').trim();
    if (!tenantId) {
      const ensuredTenantId = await ensureActiveTenant(authUserId || undefined);
      tenantId = String(ensuredTenantId || '').trim();
    }
    return tenantId;
  }, [activeTenantId, ensureActiveTenant, authUserId]);

  const safeStringify = (value: unknown) => {
    const seen = new WeakSet<object>();
    try {
      return JSON.stringify(
        value,
        (_key, currentValue) => {
          if (typeof currentValue === 'object' && currentValue !== null) {
            if (seen.has(currentValue)) return '[Circular]';
            seen.add(currentValue);
          }
          return currentValue;
        },
        2,
      );
    } catch {
      return String(value);
    }
  };

  const buildConnectErrorDetails = (err: any) => {
    const message = err?.message || 'Unknown error';
    const details: Record<string, unknown> = {};
    if (err?.response !== undefined) details.response = err.response;
    if (err?.body !== undefined) details.body = err.body;
    if (err?.context !== undefined) details.context = err.context;
    if (Object.keys(details).length === 0) return message;
    return `${message} | ${safeStringify(details)}`;
  };

  const handleSave = async () => {
    if (!draft) return;
    const result = await saveConfig(draft);
    if (!result.ok) {
      toast({
        title: 'Save failed',
        description: result.error ?? 'Unable to save QuickBooks integration settings.',
        variant: 'destructive',
      });
      return;
    }
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
        { kind: 'LABOR', amount: 100, account_ref: draft.income_account_labor },
        { kind: 'PARTS', amount: 50, account_ref: draft.income_account_parts },
      ],
      tax: { amount: 0, liability_account_ref: draft.liability_account_sales_tax },
      total: 150,
    };
    const result = await createTestExport(payload);
    if (!result?.success) {
      toast({ title: 'Test export failed', description: result?.error ?? 'Unknown error', variant: 'destructive' });
      return;
    }
    toast({ title: 'Test export queued', description: 'A test export payload was written to accounting_exports.' });
    const rows = await listRecentExports(25);
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
      const rows = await listRecentExports(25);
      setExports(rows);
    };
    void loadExports();
  }, [listRecentExports]);

  useEffect(() => {
    let mounted = true;
    const checkOauthStart = async () => {
      if (!supabase || !isAdmin) {
        if (mounted) setOauthStartAvailable(false);
        return;
      }

      setCheckingOauthStart(true);
      try {
        const tenantId = await resolveTenantId();
        if (!tenantId) {
          if (!mounted) return;
          setOauthStartAvailable(false);
          return;
        }
        const { error } = await supabase.functions.invoke('qb-oauth-start', {
          headers: { 'x-shopflow-tenant-id': tenantId },
          body: {},
        });
        if (!mounted) return;
        if (!error) {
          setOauthStartAvailable(true);
          return;
        }
        const status = (error as any)?.context?.status ?? (error as any)?.status;
        setOauthStartAvailable(status !== 404);
      } catch (err: any) {
        if (!mounted) return;
        const status = err?.context?.status ?? err?.status;
        setOauthStartAvailable(status !== 404);
      } finally {
        if (mounted) setCheckingOauthStart(false);
      }
    };

    void checkOauthStart();
    return () => {
      mounted = false;
    };
  }, [isAdmin, resolveTenantId]);

  const statusBadge = useMemo(() => {
    const status = connectedStatus || 'DISCONNECTED';
    const color =
      status === 'CONNECTED' ? 'bg-green-100 text-green-700' : status === 'EXPIRED' || status === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
    return <span className={`px-2 py-1 rounded-md text-xs font-semibold ${color}`}>{status}</span>;
  }, [connectedStatus]);

  const handleViewPayload = async (exportId: string) => {
    setPayloadLoading(true);
    const payload = await getExportPayload(exportId);
    setPayloadLoading(false);
    setPayloadContent(payload ? JSON.stringify(payload, null, 2) : 'No payload found.');
    setPayloadDialogOpen(true);
  };

  const handleRetry = async (exportId: string) => {
    if (!canEdit) {
      toast({ title: 'Admin required', variant: 'destructive' });
      return;
    }
    const result = await retryExport(exportId);
    if (!result?.success) {
      toast({ title: 'Retry failed', description: result?.error ?? 'Unable to retry', variant: 'destructive' });
      return;
    }
    toast({ title: 'Export reset', description: 'Status set to PENDING.' });
    const rows = await listRecentExports();
    setExports(rows);
  };

  const renderStatus = (status?: string) => {
    if (!status) return '';
    if (status === 'skipped') return 'Skipped (disabled)';
    if (status === 'failed') return 'Failed';
    return status;
  };

  const handleRunSender = async () => {
    setSenderRunning(true);
    try {
      throw new Error(
        [
          'Browser QuickBooks Edge calls are disabled.',
          'Run these edge functions only from server-side OR via a local admin script.',
          'Future endpoint: /api/integrations/quickbooks/*',
        ].join(' '),
      );
    } catch (err: any) {
      toast({ title: 'Live transfer failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSenderRunning(false);
    }
  };

  const handleConnect = async () => {
    if (!supabase) {
      toast({ title: 'Supabase unavailable', description: 'Supabase client is not configured.', variant: 'destructive' });
      return;
    }

    setConnectError(null);
    setConnectErrorDetails(null);
    setConnecting(true);
    try {
      const tenantId = await resolveTenantId();
      if (!tenantId) {
        const message = 'No active tenant selected.';
        setConnectError(message);
        setConnectErrorDetails(message);
        toast({ title: 'Unable to start connect', description: message, variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('qb-oauth-start', {
        headers: { 'x-shopflow-tenant-id': tenantId },
        body: {},
      });
      if (error) {
        const status = (error as any)?.context?.status ?? (error as any)?.status ?? (error as any)?.response?.status;
        if (status === 404) {
          setOauthStartAvailable(false);
        }
        const message = error.message || 'Unknown error';
        const details = buildConnectErrorDetails(error);
        setConnectError(message);
        setConnectErrorDetails(details);
        console.error('qb-oauth-start invoke error', error);
        toast({ title: 'Unable to start connect', description: message, variant: 'destructive' });
        return;
      }

      const returnedUrl = (data as any)?.authorize_url || (data as any)?.url;
      if (!returnedUrl || typeof returnedUrl !== 'string') {
        throw new Error('Missing authorize URL in response.');
      }

      window.location.href = returnedUrl;
    } catch (err: any) {
      const status = err?.context?.status ?? err?.status;
      if (status === 404) {
        setOauthStartAvailable(false);
      }
      const message = err?.message || 'Unknown error';
      const details = buildConnectErrorDetails(err);
      setConnectError(message);
      setConnectErrorDetails(details);
      console.error('qb-oauth-start invoke failed', err);
      toast({ title: 'Unable to start connect', description: message, variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const getDevAuthContext = async () => {
    if (!supabase) {
      toast({ title: 'Supabase unavailable', description: 'Supabase client is not configured.', variant: 'destructive' });
      return null;
    }

    try {
      await supabase.auth.refreshSession();
    } catch {
      // Ignore refresh failures and fall back to the current session.
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      toast({ title: 'Missing session token', description: 'Sign in and try again.', variant: 'destructive' });
      return null;
    }

    const apikey = (supabase as any).supabaseKey as string | undefined;
    if (!apikey) {
      toast({ title: 'Missing anon key', description: 'Supabase anon key is unavailable.', variant: 'destructive' });
      return null;
    }

    return { token, apikey };
  };

  const handleCopyQbSenderCurl = async () => {
    const auth = await getDevAuthContext();
    if (!auth) return;

    const cmd = [
      'curl -sS -X POST "https://qaraqoyqobqzytrnsqje.supabase.co/functions/v1/qb-sender" \\',
      `  -H "apikey: ${auth.apikey}" \\`,
      `  -H "Authorization: Bearer ${auth.token}" \\`,
      '  -H "Content-Type: application/json" \\',
      "  -d '{}'",
    ].join('\n');

    try {
      await navigator.clipboard.writeText(cmd);
      toast({ title: 'Copied', description: 'qb-sender curl command copied.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Unable to write to clipboard.', variant: 'destructive' });
    }
  };

  const handleCopyAuthProbeCurl = async () => {
    const auth = await getDevAuthContext();
    if (!auth) return;

    const cmd = `curl -sS -i "https://qaraqoyqobqzytrnsqje.supabase.co/auth/v1/user" -H "apikey: ${auth.apikey}" -H "Authorization: Bearer ${auth.token}"`;
    try {
      await navigator.clipboard.writeText(cmd);
      toast({ title: 'Copied', description: 'Auth probe curl command copied.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Unable to write to clipboard.', variant: 'destructive' });
    }
  };

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
      <PageHeader
        title="QuickBooks Integration"
        backTo="/settings"
        actions={
          <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
            Help
          </Button>
        }
      />

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
      {realmMissingWhileConnected && (
        <Alert variant="destructive">
          <AlertTitle>Connected but realm missing — reconnect required</AlertTitle>
          <AlertDescription>The QuickBooks connection is missing realm context. Reconnect to repair this integration.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
          <CardContent className="space-y-3">
            {connectError && (
              <Alert variant="destructive">
                <AlertTitle>Unable to start connect</AlertTitle>
                <AlertDescription>
                  <div>{connectError}</div>
                  <div className="mt-1 text-xs">Details: {connectErrorDetails ?? connectError}</div>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{providerName}</div>
                <div className="text-xs text-muted-foreground">Status: {statusBadge}</div>
              </div>
              <div className="flex gap-2">
                {isAdmin && oauthStartAvailable !== false && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleConnect}
                    disabled={saving || connecting || checkingOauthStart}
                  >
                    {checkingOauthStart ? 'Checking OAuth...' : connecting ? 'Connecting...' : 'Connect to QuickBooks'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConnectedStatus('CONNECTED')}
                  disabled={saving || !canEdit}
                >
                  Simulate Connect (Dev)
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
          {!isLiveTransfer && (
            <Alert variant="default" className="text-xs">
              <AlertTitle>Import mode enabled</AlertTitle>
              <AlertDescription>
                Live Transfer is disabled. Exports will be skipped and the sender will not run until you switch back to
                Live Transfer.
              </AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground">
            When an invoice is issued, ShopFlow automatically queues an export (no QuickBooks connection needed).
            Payments queue when recorded if mode is set to Invoice + Payments.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Transfer Mode</Label>
              <RadioGroup
                value={transferMode}
                onValueChange={(val) => setDraft((prev) => (prev ? { ...prev, transfer_mode: val as any } : prev))}
                className="grid gap-2"
                disabled={!canEdit}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="IMPORT_ONLY" id="transfer-import" />
                  <Label htmlFor="transfer-import">Import (manual)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="LIVE_TRANSFER" id="transfer-live" />
                  <Label htmlFor="transfer-live">Live Transfer (automatic)</Label>
                </div>
              </RadioGroup>
              {isLiveTransfer && (
                <p className="text-xs text-muted-foreground">
                  Live Transfer will automatically send invoices and payments to QuickBooks.
                </p>
              )}
            </div>
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
            <Button variant="outline" onClick={handleTestExport} disabled={saving || !canEdit || !isLiveTransfer}>
              Test Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Live Transfer</CardTitle>
          {canEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRunSender}
              disabled={senderRunning || !isLiveTransfer}
            >
              {senderRunning ? 'Running...' : 'Run Live Transfer Now'}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {draft?.is_enabled === false && (
            <Alert variant="default" className="text-xs">
              <AlertTitle>Exports are currently disabled</AlertTitle>
              <AlertDescription>Enable the integration to queue new exports.</AlertDescription>
            </Alert>
          )}
          {exports.length === 0 ? (
            <div className="text-muted-foreground text-sm">No exports yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Status</th>
                  <th className="text-left py-1">Type</th>
                  <th className="text-left py-1">Source</th>
                  <th className="text-left py-1">Attempts</th>
                  <th className="text-left py-1">Created</th>
                  <th className="text-left py-1">Error</th>
                  <th className="text-left py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((exp) => (
                  <tr key={exp.id} className="align-top">
                    <td className="py-1">{renderStatus(exp.status)}</td>
                    <td className="py-1">{exp.export_type}</td>
                    <td className="py-1">
                      {exp.source_entity_type ?? ''} {exp.source_entity_id ?? ''}
                    </td>
                    <td className="py-1">{exp.attempt_count ?? 0}</td>
                    <td className="py-1">{exp.created_at ? new Date(exp.created_at).toLocaleString() : ''}</td>
                    <td className="py-1 max-w-[180px] truncate">{exp.last_error ?? ''}</td>
                    <td className="py-1">
                      <div className="flex justify-end gap-2">
                        <Button size="xs" variant="outline" onClick={() => handleViewPayload(exp.id)}>
                          View JSON
                        </Button>
                        <Button size="xs" variant="secondary" onClick={() => handleRetry(exp.id)} disabled={!canEdit}>
                          Retry
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {import.meta.env.DEV && (
        <Card>
          <CardHeader>
            <CardTitle>Dev Tools</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button size="sm" variant="outline" onClick={handleCopyQbSenderCurl}>
              Copy qb-sender curl
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopyAuthProbeCurl}>
              Copy auth probe curl
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={payloadDialogOpen} onOpenChange={setPayloadDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Export Payload</DialogTitle>
            <DialogDescription>JSON payload saved to accounting_exports</DialogDescription>
          </DialogHeader>
          <div className="flex justify-between items-center pb-2">
            <span className="text-xs text-muted-foreground">{payloadLoading ? 'Loading…' : ''}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (payloadContent) {
                  void navigator.clipboard.writeText(payloadContent);
                  toast({ title: 'Copied' });
                }
              }}
              disabled={!payloadContent}
            >
              Copy
            </Button>
          </div>
          <div className="border rounded-md bg-muted/40 max-h-[400px] overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
            {payloadContent || (payloadLoading ? 'Loading…' : 'No payload')}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{quickbooksIntegrationHelp.title}</DialogTitle>
            <DialogDescription>How to set up and use the offline export queue</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-4 text-sm">
            {quickbooksIntegrationHelp.sections.map((section) => (
              <div key={section.heading} className="space-y-1">
                <div className="font-semibold">{section.heading}</div>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setHelpOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
