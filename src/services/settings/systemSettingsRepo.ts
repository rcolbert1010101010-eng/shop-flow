import { SYSTEM_SETTINGS_REGISTRY, type SystemSettingKey } from '@/config/systemSettingsRegistry';
import { useRepos } from '@/repos';
import { useShopStore } from '@/stores/shopStore';
import type { SystemSettings } from '@/types';

type ResolvedSetting = {
  key: SystemSettingKey;
  value: any;
  source: 'db' | 'default';
  valueType: (typeof SYSTEM_SETTINGS_REGISTRY)[SystemSettingKey]['valueType'];
  category: (typeof SYSTEM_SETTINGS_REGISTRY)[SystemSettingKey]['category'];
  label: string;
  description?: string;
};

const mapKeyToStoreField = (key: SystemSettingKey): keyof SystemSettings => {
  switch (key) {
    case 'labor_rate':
      return 'default_labor_rate';
    case 'negative_inventory_policy':
      return 'negative_inventory_policy';
    case 'default_price_level':
      return 'default_price_level';
    case 'minimum_margin_percent':
      return 'minimum_margin_percent';
    case 'ai_enabled':
      return 'ai_enabled';
    case 'ai_confirm_risky_actions':
      return 'ai_confirm_risky_actions';
    default:
      return key as keyof SystemSettings;
  }
};

const coerceValue = (key: SystemSettingKey, raw: any) => {
  const def = SYSTEM_SETTINGS_REGISTRY[key];
  const { valueType, constraints } = def;
  let val = raw;
  if (val === undefined || val === null) return def.defaultValue;
  try {
    if (valueType === 'number') {
      val = Number(val);
      if (!Number.isFinite(val)) throw new Error('invalid number');
      if (constraints?.min !== undefined && val < constraints.min) throw new Error('below min');
      if (constraints?.max !== undefined && val > constraints.max) throw new Error('above max');
      return val;
    }
    if (valueType === 'boolean') {
      return Boolean(val);
    }
    if (valueType === 'string') {
      const str = String(val);
      if (constraints?.allowedValues && !constraints.allowedValues.includes(str)) {
        throw new Error('not allowed');
      }
      return str;
    }
    return val;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`Invalid value for setting ${key}, using default`, err);
    }
    return def.defaultValue;
  }
};

const serializeValue = (key: SystemSettingKey, value: any) => {
  const { valueType, constraints } = SYSTEM_SETTINGS_REGISTRY[key];
  const base = {
    value_type: valueType,
    value_number: null as number | null,
    value_bool: null as boolean | null,
    value_text: null as string | null,
    value_json: null as any | null,
  };
  if (valueType === 'number') {
    const num = Number(value);
    if (!Number.isFinite(num)) throw new Error('Invalid number');
    if (constraints?.min !== undefined && num < constraints.min) throw new Error(`Value below min ${constraints.min}`);
    if (constraints?.max !== undefined && num > constraints.max) throw new Error(`Value above max ${constraints.max}`);
    return { ...base, value_number: num };
  }
  if (valueType === 'boolean') {
    return { ...base, value_bool: Boolean(value) };
  }
  if (valueType === 'string') {
    const str = String(value);
    const allowed = constraints?.allowed ?? constraints?.allowedValues;
    if (allowed && !allowed.includes(str)) throw new Error('Value not allowed');
    return { ...base, value_text: str };
  }
  return { ...base, value_json: value };
};

export const systemSettingsRepo = {
  getResolvedSetting(key: SystemSettingKey): ResolvedSetting {
    const registryEntry = SYSTEM_SETTINGS_REGISTRY[key];
    const storeSettings = useShopStore.getState().settings;
    const storeField = mapKeyToStoreField(key);
    const raw = (storeSettings as any)[storeField];
    const value = coerceValue(key, raw);
    const source = raw === undefined || raw === null ? 'default' : 'db';
    return {
      key,
      value,
      source,
      valueType: registryEntry.valueType,
      category: registryEntry.category,
      label: registryEntry.label,
      description: registryEntry.description,
    };
  },

  listResolvedSettings(): ResolvedSetting[] {
    return (Object.keys(SYSTEM_SETTINGS_REGISTRY) as SystemSettingKey[]).map((key) =>
      this.getResolvedSetting(key)
    );
  },

  async setSetting(
    key: SystemSettingKey,
    value: any,
    opts?: { reason?: string; source?: 'ui' | 'ai' | 'import'; actorLabel?: string }
  ) {
    const { updateSettings } = useRepos().settings;
    const storeField = mapKeyToStoreField(key);
    const oldResolved = this.getResolvedSetting(key);
    const serialized = serializeValue(key, value);
    const coerced = coerceValue(key, value);

    // Offline-first: update local store immediately
    updateSettings({ [storeField]: coerced } as Partial<SystemSettings>);

    const actorLabel =
      opts?.actorLabel ??
      (useShopStore.getState().settings.session_user_name || null);
    const source = opts?.source ?? 'ui';
    const reason = opts?.reason ?? null;

    // Best-effort background sync for setting + history
    const payload: any = { [storeField]: coerced };
    const historyPayload = {
      setting_key: key,
      scope_type: 'GLOBAL',
      scope_id: null,
      old_value_type: oldResolved.valueType,
      old_value_number: oldResolved.valueType === 'number' ? Number(oldResolved.value) : null,
      old_value_bool: oldResolved.valueType === 'boolean' ? Boolean(oldResolved.value) : null,
      old_value_text: oldResolved.valueType === 'string' ? String(oldResolved.value) : null,
      old_value_json: oldResolved.valueType === 'json' ? oldResolved.value : null,
      new_value_type: serialized.value_type,
      new_value_number: serialized.value_number,
      new_value_bool: serialized.value_bool,
      new_value_text: serialized.value_text,
      new_value_json: serialized.value_json,
      reason,
      source,
      actor_label: actorLabel,
    };

    void useRepos()
      .settings.updateSettings(payload)
      .catch((err) => {
        console.warn('Setting sync failed; keeping local version', err);
      });

    void useRepos()
      .settings.logSettingHistory(historyPayload)
      .catch((err) => {
        console.warn('History sync failed; will keep local only', err);
      });
  },

  async listSettingHistory(args?: { key?: SystemSettingKey; limit?: number }) {
    const repo = useRepos().settings;
    if (!repo.listSettingHistory) return [];
    try {
      const rows = await repo.listSettingHistory(args);
      return rows || [];
    } catch (err) {
      console.warn('Failed to load settings history', err);
      return [];
    }
  },
};
