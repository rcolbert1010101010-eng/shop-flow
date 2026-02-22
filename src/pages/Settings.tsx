import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useTheme, type ThemeOption } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';

type TenantMembership = {
  tenant_id: string;
  role: string | null;
  created_at: string | null;
  tenants?: { name?: string | null } | null;
};

export default function Settings() {
  const navigate = useNavigate();
  const env = (import.meta as any).env ?? {};
  const settingsPreviewEnabled = import.meta.env.DEV || env.VITE_SETTINGS_PREVIEW === 'true';
  const { settings, updateSettings } = useRepos().settings;
  const { listResolved, set, getResolved, listHistory } = useSystemSettings();
  const { toast } = useToast();
  const { can, loading, role } = usePermissions();
  const { theme, setTheme } = useTheme();
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
  const [tenantMemberships, setTenantMemberships] = useState<TenantMembership[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantCreating, setTenantCreating] = useState(false);
  // TEMP: QuickBooks OAuth start button state for onboarding.
  const [qbTempLoading, setQbTempLoading] = useState(false);
  const [qbTempError, setQbTempError] = useState<string | null>(null);

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
      plasma_material_cost_per_inch:
        settings?.plasma_material_cost_per_inch != null ? String(settings.plasma_material_cost_per_inch) : '',
      plasma_consumable_cost_per_pierce:
        settings?.plasma_consumable_cost_per_pierce != null ? String(settings.plasma_consumable_cost_per_pierce) : '',
      plasma_setup_rate_per_minute:
        settings?.plasma_setup_rate_per_minute != null ? String(settings.plasma_setup_rate_per_minute) : '',
      plasma_machine_rate_per_minute:
        settings?.plasma_machine_rate_per_minute != null ? String(settings.plasma_machine_rate_per_minute) : '',
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

  useEffect(() => {
    const loadTenants = async () => {
      if (!supabase) return;
      setTenantLoading(true);
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        const user = userData?.user;
        if (userError || !user) {
          setTenantMemberships([]);
          setActiveTenantId(null);
          return;
        }

        const [membershipResult, profileResult] = await Promise.all([
          supabase
            .from('tenant_users')
            .select('tenant_id, role, created_at, tenants(name)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true }),
          supabase.from('profiles').select('active_tenant_id').eq('id', user.id).maybeSingle(),
        ]);

        if (membershipResult.error) {
          toast({
            title: 'Unable to load tenants',
            description: membershipResult.error.message,
            variant: 'destructive',
          });
          setTenantMemberships([]);
        } else {
          setTenantMemberships((membershipResult.data as TenantMembership[]) ?? []);
        }

        if (profileResult.error) {
          setActiveTenantId(null);
        } else {
          setActiveTenantId(profileResult.data?.active_tenant_id ?? null);
        }
      } finally {
        setTenantLoading(false);
      }
    };

    void loadTenants();
  }, [toast]);

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

  const handleTempQuickBooksConnect = async () => {
    if (!supabase || qbTempLoading) return;
    setQbTempLoading(true);
    setQbTempError(null);

    try {
      const tenantId = String(activeTenantId ?? (tenantMemberships.length > 0 ? tenantMemberships[0].tenant_id : '')).trim();
      if (!tenantId) {
        throw new Error('No active tenant selected.');
      }

      const { data, error } = await supabase.functions.invoke('qb-oauth-start', {
        headers: { 'x-shopflow-tenant-id': tenantId },
        body: {},
      });
      if (error) throw error;

      const returnedUrl = (data as any)?.authorize_url || (data as any)?.url || (data as any)?.authUrl;
      if (!returnedUrl || typeof returnedUrl !== 'string') {
        throw new Error('Missing authorize URL in response.');
      }

      window.location.href = returnedUrl;
    } catch (err: any) {
      const message = err?.message || 'Unable to start QuickBooks connect.';
      setQbTempError(message);
      console.error('TEMP QuickBooks connect failed', { err });
      toast({
        title: 'QuickBooks connect failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setQbTempLoading(false);
    }
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
      const plasmaMaterialParsed = parseNumberMaybe((draft as any).plasma_material_cost_per_inch);
      const plasmaConsumableParsed = parseNumberMaybe((draft as any).plasma_consumable_cost_per_pierce);
      const plasmaSetupParsed = parseNumberMaybe((draft as any).plasma_setup_rate_per_minute);
      const plasmaMachineParsed = parseNumberMaybe((draft as any).plasma_machine_rate_per_minute);
      const plasmaFields = [
        { label: 'Plasma material cost per inch', value: plasmaMaterialParsed },
        { label: 'Plasma consumable cost per pierce', value: plasmaConsumableParsed },
        { label: 'Plasma setup rate per minute', value: plasmaSetupParsed },
        { label: 'Plasma machine rate per minute', value: plasmaMachineParsed },
      ];
      const invalidPlasma = plasmaFields.find((field) => field.value !== undefined && field.value < 0);
      if (invalidPlasma) {
        toast({
          title: 'Validation Error',
          description: `${invalidPlasma.label} must be a non-negative number`,
          variant: 'destructive',
        });
        return;
      }
      const legacyChanged =
        (draft.shop_name?.trim?.() ?? '') !== (settings?.shop_name ?? '') ||
        (taxRateParsed !== undefined && taxRateParsed !== (settings?.default_tax_rate ?? 0)) ||
        draft.currency !== (settings?.currency ?? 'USD') ||
        draft.units !== (settings?.units ?? 'imperial') ||
        (markupRetailParsed !== undefined && markupRetailParsed !== (settings?.markup_retail_percent ?? 0)) ||
        (markupFleetParsed !== undefined && markupFleetParsed !== (settings?.markup_fleet_percent ?? 0)) ||
        (markupWholesaleParsed !== undefined && markupWholesaleParsed !== (settings?.markup_wholesale_percent ?? 0)) ||
        ((draft as any).session_user_name?.trim?.() ?? '') !== (settings?.session_user_name ?? '') ||
        (draft as any).inventory_negative_qoh_policy !== (settings?.inventory_negative_qoh_policy ?? 'WARN') ||
        (plasmaMaterialParsed !== undefined && plasmaMaterialParsed !== (settings?.plasma_material_cost_per_inch ?? 0)) ||
        (plasmaConsumableParsed !== undefined && plasmaConsumableParsed !== (settings?.plasma_consumable_cost_per_pierce ?? 0)) ||
        (plasmaSetupParsed !== undefined && plasmaSetupParsed !== (settings?.plasma_setup_rate_per_minute ?? 0)) ||
        (plasmaMachineParsed !== undefined && plasmaMachineParsed !== (settings?.plasma_machine_rate_per_minute ?? 0));

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

      // plasma pricing fields
      if (plasmaMaterialParsed !== undefined && plasmaMaterialParsed !== (settings?.plasma_material_cost_per_inch ?? 0)) {
        legacyPayload.plasma_material_cost_per_inch = plasmaMaterialParsed;
      }
      if (plasmaConsumableParsed !== undefined && plasmaConsumableParsed !== (settings?.plasma_consumable_cost_per_pierce ?? 0)) {
        legacyPayload.plasma_consumable_cost_per_pierce = plasmaConsumableParsed;
      }
      if (plasmaSetupParsed !== undefined && plasmaSetupParsed !== (settings?.plasma_setup_rate_per_minute ?? 0)) {
        legacyPayload.plasma_setup_rate_per_minute = plasmaSetupParsed;
      }
      if (plasmaMachineParsed !== undefined && plasmaMachineParsed !== (settings?.plasma_machine_rate_per_minute ?? 0)) {
        legacyPayload.plasma_machine_rate_per_minute = plasmaMachineParsed;
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

  const effectiveActiveTenantId =
    activeTenantId ?? (tenantMemberships.length > 0 ? tenantMemberships[0].tenant_id : null);

  const handleActiveTenantChange = async (tenantId: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.rpc('set_active_tenant', { p_tenant_id: tenantId });
      if (error) {
        toast({
          title: 'Unable to set active tenant',
          description: error.message || 'Permission denied',
          variant: 'destructive',
        });
        return;
      }
      window.location.reload();
    } catch (err: any) {
      toast({
        title: 'Unable to set active tenant',
        description: err?.message || 'Permission denied',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTenant = async () => {
    if (!supabase) return;
    const name = tenantName.trim();
    if (!name) {
      toast({
        title: 'Validation Error',
        description: 'Tenant name is required',
        variant: 'destructive',
      });
      return;
    }
    if (name.length > 120) {
      toast({
        title: 'Validation Error',
        description: 'Tenant name is too long',
        variant: 'destructive',
      });
      return;
    }
    setTenantCreating(true);
    try {
      const sqlSafeName = name.replace(/'/g, "''");
      throw new Error(
        [
          'Browser tenant-create is disabled.',
          `Provided tenant name: "${name}".`,
          `Run in SQL editor: insert into public.tenants (name) values ('${sqlSafeName}') returning id;`,
          'Then attach your admin user to the new tenant via public.tenant_users and update public.profiles.active_tenant_id.',
        ].join(' '),
      );
    } catch (err: any) {
      toast({
        title: 'Unable to create tenant',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setTenantCreating(false);
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
        <h2 className="text-lg font-semibold mb-4">Appearance</h2>
        <div className="space-y-2">
          <Label>Theme</Label>
          <Select value={theme} onValueChange={(val) => setTheme(val as ThemeOption)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Choose your preferred theme or follow your system setting.</p>
        </div>
      </div>

      <div className="form-section max-w-xl mt-6">
        <h2 className="text-lg font-semibold mb-4">Tenants</h2>
        {!supabase ? (
          <p className="text-sm text-muted-foreground">Supabase is not configured.</p>
        ) : tenantLoading ? (
          <p className="text-sm text-muted-foreground">Loading tenants…</p>
        ) : tenantMemberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tenant memberships found. Create a tenant to get started.
          </p>
        ) : (
          <div className="space-y-2">
            <Label>Active tenant</Label>
            <Select
              value={effectiveActiveTenantId ?? ''}
              onValueChange={(value) => handleActiveTenantChange(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenantMemberships.map((membership) => (
                  <SelectItem key={membership.tenant_id} value={membership.tenant_id}>
                    {membership.tenants?.name || membership.tenant_id}
                    {membership.role ? ` (${membership.role})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!activeTenantId && tenantMemberships.length > 0 && (
              <p className="text-xs text-muted-foreground">
                No active tenant selected. Defaulting to your oldest membership.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <Label htmlFor="tenant_name">Create tenant</Label>
          <div className="flex gap-2">
            <Input
              id="tenant_name"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="New tenant name"
            />
            <Button
              variant="outline"
              onClick={handleCreateTenant}
              disabled={tenantCreating || !supabase}
            >
              {tenantCreating ? 'Creating...' : 'Create tenant'}
            </Button>
          </div>
        </div>
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

      {canEditSettings && (
        <div className="form-section max-w-xl mt-6">
          <h2 className="text-lg font-semibold mb-4">Plasma Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="plasma_material_cost_per_inch">Material Cost per Inch</Label>
              <Input
                id="plasma_material_cost_per_inch"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={(draft as any).plasma_material_cost_per_inch ?? ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, plasma_material_cost_per_inch: e.target.value }))
                }
                disabled={!editing || !canEditSettings}
              />
            </div>
            <div>
              <Label htmlFor="plasma_consumable_cost_per_pierce">Consumable Cost per Pierce</Label>
              <Input
                id="plasma_consumable_cost_per_pierce"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={(draft as any).plasma_consumable_cost_per_pierce ?? ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, plasma_consumable_cost_per_pierce: e.target.value }))
                }
                disabled={!editing || !canEditSettings}
              />
            </div>
            <div>
              <Label htmlFor="plasma_setup_rate_per_minute">Setup Rate per Minute</Label>
              <Input
                id="plasma_setup_rate_per_minute"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={(draft as any).plasma_setup_rate_per_minute ?? ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, plasma_setup_rate_per_minute: e.target.value }))
                }
                disabled={!editing || !canEditSettings}
              />
            </div>
            <div>
              <Label htmlFor="plasma_machine_rate_per_minute">Machine Rate per Minute</Label>
              <Input
                id="plasma_machine_rate_per_minute"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={(draft as any).plasma_machine_rate_per_minute ?? ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, plasma_machine_rate_per_minute: e.target.value }))
                }
                disabled={!editing || !canEditSettings}
              />
            </div>
          </div>
        </div>
      )}

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

      <div className="form-section max-w-xl mt-6">
        <h2 className="text-lg font-semibold mb-4">Integrations</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="font-medium">QuickBooks</p>
              <p className="text-xs text-muted-foreground">Configure accounting export settings.</p>
              {qbTempError && <p className="text-xs text-destructive mt-1">TEMP connect error: {qbTempError}</p>}
            </div>
            <div className="flex items-center gap-2">
              {/* TEMP: remove after OAuth flow is fully wired. */}
              <Button variant="outline" size="sm" onClick={handleTempQuickBooksConnect} disabled={qbTempLoading}>
                {qbTempLoading ? 'Connecting QuickBooks (TEMP)...' : 'Connect QuickBooks (TEMP)'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/settings/integrations/quickbooks')}>
                Open
              </Button>
            </div>
          </div>
        </div>
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
