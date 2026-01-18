import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRepos } from '@/repos';
import { useToast } from '@/hooks/use-toast';
import { Save, Edit, X } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { SYSTEM_SETTINGS_REGISTRY, type SystemSettingKey } from '@/config/systemSettingsRegistry';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';
import { usePermissions } from '@/security/usePermissions';

export default function Settings() {
  const env = (import.meta as any).env ?? {};
  const settingsPreviewEnabled = import.meta.env.DEV || env.VITE_SETTINGS_PREVIEW === 'true';
  const { settings, updateSettings } = useRepos().settings;
  const { listResolved, set, getResolved, listHistory } = useSystemSettings();
  const { toast } = useToast();
  const { can, loading, role } = usePermissions();
  const isReady = !loading;
  const isPrivileged = role === 'ADMIN' || role === 'MANAGER';
  const canEditSettings = can('settings.edit');
  const [editing, setEditing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending'>('synced');
  const resolvedSettings = useMemo(() => listResolved(), [listResolved]);
  const [formData, setFormData] = useState<Record<SystemSettingKey | string, any>>({});
  const [draft, setDraft] = useState<Record<SystemSettingKey | string, any>>({});
  // Snapshot of initial state when entering edit mode (for dirty detection)
  const [snapshot, setSnapshot] = useState<Record<SystemSettingKey | string, any> | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const hasSettings = resolvedSettings.length > 0;
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | SystemSettingKey>('all');

  useEffect(() => {
    if (!isReady) return;
    if (!canEditSettings) {
      toast({
        title: "You don't have permission to edit settings.",
        variant: 'destructive',
      });
    }
  }, [canEditSettings, isReady, toast]);

  const hydrateForm = useCallback(() => {
    const fromResolved = listResolved().reduce<Record<string, any>>((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
    const next = {
      ...fromResolved,
      shop_name: settings?.shop_name ?? '',
      default_labor_rate: (settings?.default_labor_rate ?? 0).toString(),
      default_tax_rate: (settings?.default_tax_rate ?? 0).toString(),
      currency: settings?.currency ?? 'USD',
      units: settings?.units ?? 'imperial',
      markup_retail_percent: (settings?.markup_retail_percent ?? 0).toString(),
      markup_fleet_percent: (settings?.markup_fleet_percent ?? 0).toString(),
      markup_wholesale_percent: (settings?.markup_wholesale_percent ?? 0).toString(),
      session_user_name: settings?.session_user_name || '',
      inventory_negative_qoh_policy: settings?.inventory_negative_qoh_policy || 'WARN',
      minimum_margin_percent: (fromResolved.minimum_margin_percent ?? 0).toString(),
      labor_rate: (fromResolved.labor_rate ?? 0).toString(),
    };
    setFormData(next);
    setDraft(next);
    return next;
  }, [listResolved, settings]);

  useEffect(() => {
    if (!editing) {
      hydrateForm();
      setSnapshot(null);
    }
  }, [settings, editing, hydrateForm, resolvedSettings]);

  useEffect(() => {
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const rows = await listHistory({
          key: historyFilter === 'all' ? undefined : historyFilter,
          limit: 20,
        });
        setHistoryItems(rows || []);
      } catch (err) {
        setHistoryItems([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    void loadHistory();
  }, [historyFilter, listHistory]);

  const applySetting = async (key: SystemSettingKey, newValue: any, reason?: string) => {
    const actorLabel = (draft as any).session_user_name || undefined;
    try {
      await set(key, newValue, { reason, source: 'ui', actorLabel });
    } catch (err: any) {
      toast({
        title: 'Validation Error',
        description: err?.message || 'Unable to update setting',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleFieldChange = (key: SystemSettingKey, newValue: any) => {
    setDraft((prev) => ({ ...prev, [key]: newValue }));
  };

  const parseNumberMaybe = (v: any): number | undefined => {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  // Stable comparison helper: JSON stringify with sorted keys for consistent comparison
  const stableStringify = useCallback((obj: Record<string, any>): string => {
    const sorted = Object.keys(obj).sort().reduce<Record<string, any>>((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
    return JSON.stringify(sorted);
  }, []);

  // Compute isDirty by comparing current draft to snapshot
  const isDirty = useMemo(() => {
    if (!editing || !snapshot) return false;
    return stableStringify(draft) !== stableStringify(snapshot);
  }, [draft, snapshot, editing, stableStringify]);

  const handleSave = async () => {
    if (!canEditSettings) {
      toast({
        title: 'Permission Denied',
        description: "You don't have permission to edit settings.",
        variant: 'destructive',
      });
      return;
    }
    if (!draft.shop_name?.trim?.()) {
      toast({
        title: 'Validation Error',
        description: 'Shop name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSyncStatus('pending');

      // Diff settings vs resolved to find changes
      const entries = Object.keys(SYSTEM_SETTINGS_REGISTRY) as SystemSettingKey[];
      const changes: { key: SystemSettingKey; oldValue: any; newValue: any; sensitivity?: string; requiresReason?: boolean }[] = [];
      for (const key of entries) {
        const entry = SYSTEM_SETTINGS_REGISTRY[key];
        const oldValue = getResolved(key).value;
        const newValueRaw = draft[key];
        const newValue =
          entry.valueType === 'number' ? (newValueRaw === '' ? null : Number(newValueRaw)) : newValueRaw;

        if (newValue === undefined || newValue === null || (entry.valueType === 'number' && Number.isNaN(newValue))) continue;
        if (newValue === oldValue) continue;

        changes.push({ key, oldValue, newValue, sensitivity: entry.sensitivity, requiresReason: (entry as any).requiresReason });
      }

      // Check for legacy field changes
      const taxRateParsed = parseNumberMaybe(draft.default_tax_rate);
      const markupRetailParsed = parseNumberMaybe((draft as any).markup_retail_percent);
      const markupFleetParsed = parseNumberMaybe((draft as any).markup_fleet_percent);
      const markupWholesaleParsed = parseNumberMaybe((draft as any).markup_wholesale_percent);
      const legacyChanged =
        (draft.shop_name?.trim?.() ?? '') !== (settings?.shop_name ?? '') ||
        (taxRateParsed !== undefined && taxRateParsed !== (settings?.default_tax_rate ?? 0)) ||
        draft.currency !== (settings?.currency ?? 'USD') ||
        draft.units !== (settings?.units ?? 'imperial') ||
        (markupRetailParsed !== undefined && markupRetailParsed !== (settings?.markup_retail_percent ?? 0)) ||
        (markupFleetParsed !== undefined && markupFleetParsed !== (settings?.markup_fleet_percent ?? 0)) ||
        (markupWholesaleParsed !== undefined && markupWholesaleParsed !== (settings?.markup_wholesale_percent ?? 0)) ||
        ((draft as any).session_user_name?.trim?.() ?? '') !== (settings?.session_user_name ?? '') ||
        (draft as any).inventory_negative_qoh_policy !== (settings?.inventory_negative_qoh_policy ?? 'WARN');

      if (changes.length === 0 && !legacyChanged) {
        toast({ title: 'No changes', description: 'Nothing to save.' });
        return;
      }

      // Apply changes
      for (const change of changes) {
        if (change.newValue === null || Number.isNaN(change.newValue)) {
          toast({ title: 'Validation Error', description: 'Invalid numeric value', variant: 'destructive' });
          return;
        }
        const ok = await applySetting(change.key, change.newValue);
        if (!ok) {
          return;
        }
      }

      // Build patch-only legacy payload with only changed fields
      const legacyPayload: Record<string, any> = {};

      // shop_name (trim string)
      const shopName = draft.shop_name?.trim?.();
      if (shopName !== undefined && shopName !== (settings?.shop_name ?? '')) {
        legacyPayload.shop_name = shopName;
      }

      // default_tax_rate (number via parseNumberMaybe)
      const taxRate = parseNumberMaybe(draft.default_tax_rate);
      if (taxRate !== undefined && taxRate !== (settings?.default_tax_rate ?? 0)) {
        legacyPayload.default_tax_rate = taxRate;
      }

      // currency
      if (draft.currency !== undefined && draft.currency !== (settings?.currency ?? 'USD')) {
        legacyPayload.currency = draft.currency;
      }

      // units
      if (draft.units !== undefined && draft.units !== (settings?.units ?? 'imperial')) {
        legacyPayload.units = draft.units;
      }

      // markup_retail_percent (number via parseNumberMaybe)
      const markupRetail = parseNumberMaybe((draft as any).markup_retail_percent);
      if (markupRetail !== undefined && markupRetail !== (settings?.markup_retail_percent ?? 0)) {
        legacyPayload.markup_retail_percent = markupRetail;
      }

      // markup_fleet_percent (number via parseNumberMaybe)
      const markupFleet = parseNumberMaybe((draft as any).markup_fleet_percent);
      if (markupFleet !== undefined && markupFleet !== (settings?.markup_fleet_percent ?? 0)) {
        legacyPayload.markup_fleet_percent = markupFleet;
      }

      // markup_wholesale_percent (number via parseNumberMaybe)
      const markupWholesale = parseNumberMaybe((draft as any).markup_wholesale_percent);
      if (markupWholesale !== undefined && markupWholesale !== (settings?.markup_wholesale_percent ?? 0)) {
        legacyPayload.markup_wholesale_percent = markupWholesale;
      }

      // session_user_name (trim string)
      const sessionUserName = (draft as any).session_user_name?.trim?.();
      if (sessionUserName !== undefined && sessionUserName !== (settings?.session_user_name ?? '')) {
        legacyPayload.session_user_name = sessionUserName;
      }

      // inventory_negative_qoh_policy
      if ((draft as any).inventory_negative_qoh_policy !== undefined && 
          (draft as any).inventory_negative_qoh_policy !== (settings?.inventory_negative_qoh_policy ?? 'WARN')) {
        legacyPayload.inventory_negative_qoh_policy = (draft as any).inventory_negative_qoh_policy;
      }

      // Only persist if there are changes
      if (Object.keys(legacyPayload).length > 0) {
        await updateSettings(legacyPayload);
      }

      toast({
        title: 'Settings Updated',
        description: 'Your changes have been saved',
      });
      // Clear snapshot after successful save
      setSnapshot(null);
    } catch (err) {
      toast({
        title: 'Save failed',
        description: (err as any)?.message ?? 'Unable to save settings',
        variant: 'destructive',
      });
    } finally {
      setEditing(false);
      setSyncStatus('synced');
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelDialog(true);
    } else {
      handleCancelConfirm();
    }
  };

  const handleCancelConfirm = () => {
    // Revert draft to snapshot
    if (snapshot) {
      const reverted = { ...snapshot };
      setDraft(reverted);
      setFormData(reverted);
    } else {
      hydrateForm();
    }
    setEditing(false);
    setSnapshot(null);
    setShowCancelDialog(false);
  };

  const formatHistoryValue = (row: any, prefix: 'old' | 'new') => {
    const type = row[`${prefix}_value_type`];
    if (type === 'number') return row[`${prefix}_value_number`];
    if (type === 'boolean') return String(row[`${prefix}_value_bool`]);
    if (type === 'string') return row[`${prefix}_value_text`];
    return row[`${prefix}_value_json`] ?? '';
  };

  // beforeunload warning when dirty
  useEffect(() => {
    if (!editing || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editing, isDirty]);

  // Back/forward navigation guard (popstate)
  useEffect(() => {
    if (!editing || !isDirty) return;
    const handlePopState = (e: PopStateEvent) => {
      const shouldProceed = window.confirm('You have unsaved changes. Leave without saving?');
      if (!shouldProceed) {
        // Push user back to current path
        window.history.pushState(null, '', window.location.pathname + window.location.search + window.location.hash);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [editing, isDirty]);

  // Link click navigation guard (capture phase)
  useEffect(() => {
    if (!editing || !isDirty) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      // Check if it's a same-origin internal link
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin === window.location.origin && href.startsWith('/')) {
          const shouldProceed = window.confirm('You have unsaved changes. Leave without saving?');
          if (!shouldProceed) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      } catch {
        // Invalid URL, ignore
      }
    };
    document.addEventListener('click', handleClick, true); // Capture phase
    return () => document.removeEventListener('click', handleClick, true);
  }, [editing, isDirty]);

  if (!isReady) {
    return (
      <div className="page-container">
        <PageHeader
          title="Settings"
          subtitle="Configure shop settings and defaults"
        />
        <div className="text-sm text-muted-foreground">Loading permissions...</div>
      </div>
    );
  }

  if (!canEditSettings) {
    return (
      <div className="page-container">
        <PageHeader
          title="Settings"
          subtitle="Configure shop settings and defaults"
        />
        <div className="flex items-center justify-center py-10">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Access denied</h2>
            <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
            {isPrivileged && (
              <p className="text-xs text-muted-foreground">Missing capability: settings.edit</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Settings"
        subtitle="Configure shop settings and defaults"
        actions={
          <div className="flex gap-2 items-center">
            {editing ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!isDirty || !canEditSettings}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                aria-disabled={!canEditSettings}
                className={!canEditSettings ? 'opacity-50 cursor-not-allowed' : ''}
                onClick={() => {
                  if (!canEditSettings) {
                    toast({
                      title: 'Permission Denied',
                      description: "You don't have permission to edit settings.",
                      variant: 'destructive',
                    });
                    return;
                  }
                  const initial = hydrateForm();
                  setSnapshot({ ...initial });
                  setEditing(true);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            <ModuleHelpButton moduleKey="settings" context={{ isEmpty: !hasSettings }} />
          </div>
        }
      />
      <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
        <span>Status: {syncStatus === 'synced' ? 'Synced' : 'Pending sync'}</span>
        <span className="text-xs">Values update immediately; background sync is offline-friendly.</span>
      </div>

      <div className="form-section max-w-xl">
        <h2 className="text-lg font-semibold mb-4">Shop Information</h2>
        <div className="space-y-4">
          {(['labor_rate', 'negative_inventory_policy', 'default_price_level', 'minimum_margin_percent', 'ai_enabled', 'ai_confirm_risky_actions'] as SystemSettingKey[]).map((key) => {
            const entry = SYSTEM_SETTINGS_REGISTRY[key];
            const value = draft[key] ?? '';
            if (entry.valueType === 'number') {
              return (
                <div key={key}>
                  <Label>{entry.label}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    disabled={!editing || !canEditSettings}
                  />
                  <p className="text-xs text-muted-foreground">{entry.description}</p>
                </div>
              );
            }
            if (entry.valueType === 'boolean') {
              return (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={Boolean(value)}
                    disabled={!editing || !canEditSettings}
                    onChange={(e) => handleFieldChange(key, e.target.checked)}
                  />
                  <div>
                    <p className="font-medium">{entry.label}</p>
                    <p className="text-xs text-muted-foreground">{entry.description}</p>
                  </div>
                </div>
              );
            }
            if (entry.valueType === 'string' && entry.constraints?.allowedValues) {
              return (
                <div key={key}>
                  <Label>{entry.label}</Label>
                  <Select
                    value={String(value)}
                    onValueChange={(v) => handleFieldChange(key, v)}
                    disabled={!editing || !canEditSettings}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={entry.label} />
                    </SelectTrigger>
                    <SelectContent>
                      {entry.constraints.allowedValues.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{entry.description}</p>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>

      <div className="form-section max-w-xl mt-6">
        <h2 className="text-lg font-semibold mb-4">Pricing &amp; Markups</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="markup_retail_percent">Default Parts Markup (Retail %)</Label>
            <Input
              id="markup_retail_percent"
              type="number"
              step="0.01"
              value={(draft as any).markup_retail_percent ?? ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, markup_retail_percent: e.target.value }))
              }
              disabled={!editing || !canEditSettings}
            />
          </div>
          <div>
            <Label htmlFor="markup_fleet_percent">Default Parts Markup (Fleet %)</Label>
            <Input
              id="markup_fleet_percent"
              type="number"
              step="0.01"
              value={(draft as any).markup_fleet_percent ?? ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, markup_fleet_percent: e.target.value }))
              }
              disabled={!editing || !canEditSettings}
            />
          </div>
          <div>
            <Label htmlFor="markup_wholesale_percent">Default Parts Markup (Wholesale %)</Label>
            <Input
              id="markup_wholesale_percent"
              type="number"
              step="0.01"
              value={(draft as any).markup_wholesale_percent ?? ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, markup_wholesale_percent: e.target.value }))
              }
              disabled={!editing || !canEditSettings}
            />
          </div>
          <div>
            <Label htmlFor="minimum_margin_percent">Minimum Margin %</Label>
            <Input
              id="minimum_margin_percent"
              type="number"
              step="0.01"
              value={(draft as any).minimum_margin_percent ?? ''}
              onChange={(e) => handleFieldChange('minimum_margin_percent', e.target.value)}
              disabled={!editing || !canEditSettings}
            />
          </div>
        </div>
      </div>

      <div className="form-section max-w-xl mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Change History</h2>
          <Select value={historyFilter} onValueChange={(v) => setHistoryFilter(v as any)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Filter by setting" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All settings</SelectItem>
              {(Object.keys(SYSTEM_SETTINGS_REGISTRY) as SystemSettingKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SYSTEM_SETTINGS_REGISTRY[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {historyLoading ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : historyItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history available.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {historyItems.map((row, idx) => {
              const label =
                SYSTEM_SETTINGS_REGISTRY[(row.setting_key as SystemSettingKey) ?? '']?.label ||
                row.setting_key;
              const oldVal = formatHistoryValue(row, 'old');
              const newVal = formatHistoryValue(row, 'new');
              return (
                <div key={`${row.id || idx}`} className="border rounded-md px-3 py-2 flex justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {label}{' '}
                      <span className="text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {oldVal} → {newVal} · source: {row.source || 'ui'}
                      {row.reason ? ` · reason: ${row.reason}` : ''}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    Actor: {row.actor_label || '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {settingsPreviewEnabled && (
        <div className="form-section max-w-xl mt-6">
          <h2 className="text-lg font-semibold mb-4">Diagnostics (DEV)</h2>
          <div className="text-sm space-y-2">
            {resolvedSettings.map((r) => (
              <div key={r.key} className="flex justify-between border rounded-md px-3 py-2">
                <div>
                  <div className="font-medium">{r.key}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.label} · {r.category} · {r.valueType}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{String(r.value)}</div>
                  <div className="text-xs text-muted-foreground">{r.source}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
