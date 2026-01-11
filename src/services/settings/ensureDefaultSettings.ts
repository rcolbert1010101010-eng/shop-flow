import { SYSTEM_SETTINGS_REGISTRY, type SystemSettingKey } from '@/config/systemSettingsRegistry';
import { systemSettingsRepo } from './systemSettingsRepo';

let seeded = false;

export const ensureDefaultSettings = async (upsertDefaults: (missing: Record<SystemSettingKey, any>) => Promise<void> | void) => {
  if (seeded) return;
  seeded = true;

  const missing: Partial<Record<SystemSettingKey, any>> = {};
  (Object.keys(SYSTEM_SETTINGS_REGISTRY) as SystemSettingKey[]).forEach((key) => {
    const resolved = systemSettingsRepo.getResolvedSetting(key);
    if (resolved.source === 'default') {
      missing[key] = resolved.value;
    }
  });

  if (Object.keys(missing).length === 0) return;

  await upsertDefaults(missing as Record<SystemSettingKey, any>);
};
