import { useShopStore } from '@/stores/shopStore';

import type { SettingsRepo } from '../repos';
import type { SystemSettings } from '@/types';

export const settingsRepoApi: SettingsRepo = {
  get settings() {
    return useShopStore.getState().settings;
  },

  async updateSettings(settings: Partial<SystemSettings>) {
    const current = useShopStore.getState().settings;

    // Merge current settings with the payload (payload wins)
    const mergedFromClient = { ...current, ...settings } as SystemSettings;

    // Offline-first: immediately update local Zustand store
    // No network calls, no throwing
    useShopStore.getState().updateSettings(mergedFromClient);
  },
};
