import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TableDensity = 'compact' | 'comfortable' | 'spacious';

type UiPrefsState = {
  tableDensity: TableDensity;
  setTableDensity: (density: TableDensity) => void;
};

const STORAGE_KEY = 'ui-prefs';

export const useUiPrefsStore = create<UiPrefsState>()(
  persist(
    (set) => ({
      tableDensity: 'comfortable',
      setTableDensity: (density) => set({ tableDensity: density }),
    }),
    { name: STORAGE_KEY }
  )
);
