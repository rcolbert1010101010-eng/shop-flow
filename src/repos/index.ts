import { useSyncExternalStore } from 'react';
import { useShopStore } from '@/stores/shopStore';
import type { Repos } from './repos';
import { zustandRepos } from './zustandRepos';
import { settingsRepoApi } from './api/settingsRepoApi';
import { unitsRepoApi } from './api/unitsRepoApi';
import { vendorsRepoApi } from './api/vendorsRepoApi';
import { categoriesRepoApi } from './api/categoriesRepoApi';
import { partsRepoApi } from './api/partsRepoApi';
import { techniciansRepoApi } from './api/techniciansRepoApi';
import { invoicesRepoApi } from './api/invoicesRepoApi';

const apiBackedRepos: Repos = {
  ...zustandRepos,
  settings: settingsRepoApi,
  customers: zustandRepos.customers,
  customerContacts: zustandRepos.customerContacts,
  units: unitsRepoApi,
  unitAttachments: zustandRepos.unitAttachments,
  vendors: vendorsRepoApi,
  categories: categoriesRepoApi,
  parts: partsRepoApi,
  technicians: techniciansRepoApi,
  invoices: invoicesRepoApi,
};

const repos: Repos = apiBackedRepos;

function subscribe(callback: () => void) {
  return useShopStore.subscribe(() => callback());
}

function getSnapshot(): Repos {
  return repos;
}

export function useRepos(): Repos {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export { repos };
