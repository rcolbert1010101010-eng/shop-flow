import { useUiPrefsStore } from '@/stores/uiPrefsStore';

export function useUiPrefs() {
  return useUiPrefsStore((state) => ({
    tableDensity: state.tableDensity,
    setTableDensity: state.setTableDensity,
  }));
}
