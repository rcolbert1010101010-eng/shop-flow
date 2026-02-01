type DocMeta = { path: string; title: string; updatedAt: string };

const UPDATED_AT = '2026-02-01';

export const docMetaByModuleKey: Record<string, DocMeta> = {
  dashboard: { path: '/docs/dashboard', title: 'Dashboard', updatedAt: UPDATED_AT },
  units: { path: '/docs/units', title: 'Units', updatedAt: UPDATED_AT },
  technicians: { path: '/docs/technicians', title: 'Technicians', updatedAt: UPDATED_AT },
  receiving: { path: '/docs/receiving', title: 'Receiving', updatedAt: UPDATED_AT },
  receiving_history: { path: '/docs/receiving-history', title: 'Receiving History', updatedAt: UPDATED_AT },
  part_categories: { path: '/docs/part-categories', title: 'Part Categories', updatedAt: UPDATED_AT },
  cycle_counts: { path: '/docs/cycle-counts', title: 'Cycle Counts', updatedAt: UPDATED_AT },
  payments: { path: '/docs/payments', title: 'Payments', updatedAt: UPDATED_AT },
  warranty_returns: { path: '/docs/warranty-returns', title: 'Warranty & Returns', updatedAt: UPDATED_AT },
  returns_warranty_report: {
    path: '/docs/returns-warranty-report',
    title: 'Returns & Warranty Report',
    updatedAt: UPDATED_AT,
  },
  plasma_projects: { path: '/docs/plasma-projects', title: 'Plasma Projects', updatedAt: UPDATED_AT },
  plasma_templates: { path: '/docs/plasma-templates', title: 'Plasma Templates', updatedAt: UPDATED_AT },
  customers: { path: '/docs/customers', title: 'Customers', updatedAt: UPDATED_AT },
  sales_orders: { path: '/docs/sales-orders', title: 'Sales Orders', updatedAt: UPDATED_AT },
  work_orders: { path: '/docs/work-orders', title: 'Work Orders', updatedAt: UPDATED_AT },
  inventory: { path: '/docs/inventory', title: 'Inventory', updatedAt: UPDATED_AT },
  purchase_orders: { path: '/docs/purchase-orders', title: 'Purchase Orders', updatedAt: UPDATED_AT },
  invoices: { path: '/docs/invoices', title: 'Invoices', updatedAt: UPDATED_AT },
  scheduling: { path: '/docs/scheduling', title: 'Scheduling', updatedAt: UPDATED_AT },
  parts: { path: '/docs/parts', title: 'Parts Catalog', updatedAt: UPDATED_AT },
  vendors: { path: '/docs/vendors', title: 'Vendors', updatedAt: UPDATED_AT },
  settings: { path: '/docs/settings', title: 'Settings', updatedAt: UPDATED_AT },
  users: { path: '/docs/users', title: 'Users', updatedAt: UPDATED_AT },
  admin_users: { path: '/docs/users', title: 'Users', updatedAt: UPDATED_AT },
  returns_warranty: { path: '/docs/returns-warranty', title: 'Returns and Warranty', updatedAt: UPDATED_AT },
};

export const getDocMeta = (moduleKey: string) => docMetaByModuleKey[moduleKey] ?? null;

export const allDocMeta = () =>
  Object.entries(docMetaByModuleKey).map(([moduleKey, meta]) => ({
    moduleKey,
    ...meta,
  }));
