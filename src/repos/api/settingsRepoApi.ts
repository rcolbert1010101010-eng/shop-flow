import { apiClient } from '@/api/client';
import { useShopStore } from '@/stores/shopStore';

import type { SettingsRepo } from '../repos';
import type { SystemSettings } from '@/types';

export const settingsRepoApi: SettingsRepo = {
  get settings() {
    return useShopStore.getState().settings;
  },
  async updateSettings(settings: Partial<SystemSettings>) {
    // Optimistically update local store first
    useShopStore.getState().updateSettings(settings);

    // Fire-and-forget server sync; do not block or throw on failure
    void apiClient
      .put<SystemSettings>('/settings', settings)
      .then((updated) => {
        useShopStore.getState().updateSettings(updated);
      })
      .catch((err) => {
        console.warn('Settings sync failed; will keep local version', err);
      });
  },

  async logSettingHistory(payload: any) {
    // Best-effort; ignore failures
    void apiClient.post('/settings/history', payload).catch((err) => {
      console.warn('Settings history sync failed', err);
    });
  },

  async listSettingHistory(args?: { key?: string; limit?: number }): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (args?.key) params.set('key', args.key);
      if (args?.limit) params.set('limit', String(args.limit));
      const queryString = params.toString();
      const res = await apiClient.get<any[]>(`/settings/history${queryString ? `?${queryString}` : ''}`);
      return res || [];
    } catch (err) {
      console.warn('Settings history fetch failed', err);
      return [];
    }
  },
};
