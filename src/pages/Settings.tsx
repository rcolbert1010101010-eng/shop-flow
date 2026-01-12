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
import { useRepos } from '@/repos';
import { useToast } from '@/hooks/use-toast';
import { Save, Edit, X } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { SYSTEM_SETTINGS_REGISTRY, type SystemSettingKey } from '@/config/systemSettingsRegistry';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export default function Settings() {
  const env = (import.meta as any).env ?? {};
  const settingsPreviewEnabled = import.meta.env.DEV || env.VITE_SETTINGS_PREVIEW === 'true';
  const { settings, updateSettings } = useRepos().settings;
  const { listResolved, set, getResolved, listHistory } = useSystemSettings();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending'>('synced');
  const resolvedSettings = useMemo(() => listResolved(), [listResolved]);
  const [formData, setFormData] = useState<Record<SystemSettingKey | string, any>>({});
  const [draft, setDraft] = useState<Record<SystemSettingKey | string, any>>({});
  const [pendingChanges, setPendingChanges] = useState<
    { key: SystemSettingKey; oldValue: any; newValue: any; sensitivity?: string; requiresReason?: boolean }[]
  >([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmReason, setConfirmReason] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | SystemSettingKey>('all');

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
  }, [listResolved, settings]);

  useEffect(() => {
    if (!editing) {
      hydrateForm();
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

  const handleSave = async () => {
    if (!draft.shop_name?.trim?.()) {
      toast({
        title: 'Validation Error',
        description: 'Shop name is required',
        variant: 'destructive',
      });
      return;
    }

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

    if (changes.length === 0) {
      toast({ title: 'No changes', description: 'Nothing to save.' });
      setEditing(false);
      setSyncStatus('synced');
      return;
    }

    const protectedChanges = changes.filter(
      (c) => c.sensitivity === 'protected' || c.sensitivity === 'critical'
    );
    if (protectedChanges.length > 0) {
      setPendingChanges(protectedChanges);
      setConfirmReason('');
      setConfirmOpen(true);
      setSyncStatus('synced');
      return;
    }

    // Apply non-protected changes immediately
    for (const change of changes) {
      if (change.newValue === null || Number.isNaN(change.newValue)) {
        toast({ title: 'Validation Error', description: 'Invalid numeric value', variant: 'destructive' });
        setSyncStatus('synced');
        return;
      }
      await applySetting(change.key, change.newValue);
    }

    // Persist legacy settings fields
    const legacyPayload = {
      shop_name: draft.shop_name?.trim?.() ?? draft.shop_name,
      default_labor_rate: Number(draft.default_labor_rate) || 0,
      default_tax_rate: Number(draft.default_tax_rate) || 0,
      currency: draft.currency,
      units: draft.units,
      markup_retail_percent: Number((draft as any).markup_retail_percent ?? 0),
      markup_fleet_percent: Number((draft as any).markup_fleet_percent ?? 0),
      markup_wholesale_percent: Number((draft as any).markup_wholesale_percent ?? 0),
      session_user_name: (draft as any).session_user_name?.trim?.() ?? '',
      inventory_negative_qoh_policy: (draft as any).inventory_negative_qoh_policy,
      minimum_margin_percent: Number(draft.minimum_margin_percent) || 0,
      labor_rate: Number(draft.labor_rate) || 0,
    };

    await updateSettings(legacyPayload);

    toast({
      title: 'Settings Updated',
      description: 'Your changes have been saved',
    });
    setEditing(false);
    setSyncStatus('synced');
  };

  const resetConfirmation = () => {
    setPendingChanges([]);
    setConfirmReason('');
    setConfirmOpen(false);
  };

  const confirmPending = async () => {
    if (pendingChanges.length === 0) return;
    const requiresReason = pendingChanges.some((c) => c.requiresReason);
    if (requiresReason && confirmReason.trim().length < 5) {
      toast({
        title: 'Reason required',
        description: 'Please provide at least 5 characters.',
        variant: 'destructive',
      });
      return;
    }
    setIsApplying(true);
    await Promise.allSettled(
      pendingChanges.map((change) =>
        applySetting(
          change.key,
          change.newValue,
          change.requiresReason ? confirmReason.trim() : confirmReason.trim() || undefined
        )
      )
    );
    setIsApplying(false);
    setEditing(false);
    hydrateForm();
    resetConfirmation();
    toast({
      title: 'Settings Updated',
      description: 'Protected changes saved',
    });
  };

  const formatHistoryValue = (row: any, prefix: 'old' | 'new') => {
    const type = row[`${prefix}_value_type`];
    if (type === 'number') return row[`${prefix}_value_number`];
    if (type === 'boolean') return String(row[`${prefix}_value_bool`]);
    if (type === 'string') return row[`${prefix}_value_text`];
    return row[`${prefix}_value_json`] ?? '';
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Settings"
        subtitle="Configure shop settings and defaults"
        actions={
          editing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  hydrateForm();
                  setEditing(false);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={confirmOpen || isApplying}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                hydrateForm();
                setEditing(true);
              }}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )
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
                    disabled={!editing}
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
                    disabled={!editing}
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
                    disabled={!editing}
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

      <Dialog open={confirmOpen} onOpenChange={(open) => !open && resetConfirmation()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm changes</DialogTitle>
          </DialogHeader>
          {pendingChanges.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-2">
                {pendingChanges.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{SYSTEM_SETTINGS_REGISTRY[c.key].label}</div>
                      <div className="text-xs text-muted-foreground">
                        {String(c.oldValue)} → {String(c.newValue)}
                      </div>
                    </div>
                    <Badge variant={c.sensitivity === 'critical' ? 'destructive' : 'secondary'}>
                      {c.sensitivity?.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
              {pendingChanges.some((c) => c.requiresReason) && (
                <div className="space-y-1">
                  <Label>Reason (required)</Label>
                  <Textarea
                    value={confirmReason}
                    onChange={(e) => setConfirmReason(e.target.value)}
                    placeholder="Provide context for these changes"
                  />
                  <p className="text-xs text-muted-foreground">At least 5 characters.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={resetConfirmation}>
              Cancel
            </Button>
            <Button onClick={confirmPending} disabled={isApplying}>
              {isApplying ? 'Saving…' : 'Confirm Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
