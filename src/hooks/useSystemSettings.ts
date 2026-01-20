import { useMemo, useEffect, useRef } from 'react';
import { SYSTEM_SETTINGS_REGISTRY, type SystemSettingKey } from '@/config/systemSettingsRegistry';
import { systemSettingsRepo } from '@/services/settings/systemSettingsRepo';
import { ensureDefaultSettings } from '@/services/settings/ensureDefaultSettings';
import { useRepos } from '@/repos';

export function useSystemSettings() {
  const { settings: settingsRepo } = useRepos();
  const env = (import.meta as any).env || {};
  const settingsPreviewEnabled = import.meta.env.DEV || env.VITE_SETTINGS_PREVIEW === 'true';
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const runSeed = async () => {
      try {
        await ensureDefaultSettings((missing) => settingsRepo.updateSettings(missing));
      } catch (err) {
        if (settingsPreviewEnabled) {
          console.warn('ensureDefaultSettings failed', err);
        }
      }
    };
    void runSeed();
  }, [settingsRepo, settingsPreviewEnabled]);

  const get = (key: SystemSettingKey) => systemSettingsRepo.getResolvedSetting(key).value;
  const getResolved = (key: SystemSettingKey) => systemSettingsRepo.getResolvedSetting(key);
  const listResolved = () => systemSettingsRepo.listResolvedSettings();
  const set = (key: SystemSettingKey, value: any, opts?: { reason?: string; source?: 'ui' | 'ai' | 'import'; actorLabel?: string }) =>
    systemSettingsRepo.setSetting(key, value, opts);
  const listHistory = (args?: { key?: SystemSettingKey; limit?: number }) =>
    systemSettingsRepo.listSettingHistory(args);

  return useMemo(
    () => ({
      registry: SYSTEM_SETTINGS_REGISTRY,
      get,
      getResolved,
      listResolved,
      set,
      listHistory,
    }),
    []
  );
}
