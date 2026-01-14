import { apiClient } from '@/api/client';
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

    let updatedFromServer: SystemSettings | null = null;

    try {
      // Still attempt to sync with the backend
      updatedFromServer = await apiClient.put<SystemSettings>('/settings', settings);
    } catch (error) {
      // On error, keep the client-merged settings so the UI reflects the change
      useShopStore.getState().updateSettings(mergedFromClient);
      // Re-throw so Settings.tsx can handle the error/toast
      throw error;
    }

    // If the server returned something, prefer it but let the payload fields win
    const finalSettings = {
      ...updatedFromServer,
      ...settings,
    } as SystemSettings;

    useShopStore.getState().updateSettings(finalSettings);
  },
};
