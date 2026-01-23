import { inventoryHelp } from './modules/inventory';
import { partsHelp } from './modules/parts';
import { salesOrdersHelp } from './modules/sales_orders';
import { purchaseOrdersHelp } from './modules/purchase_orders';
import { receivingHelp } from './modules/receiving';
import { workOrdersHelp } from './modules/work_orders';
import { invoicesHelp } from './modules/invoices';
import { paymentsHelp } from './modules/payments';
import { schedulingHelp } from './modules/scheduling';
import { warrantyReturnsHelp } from './modules/warranty_returns';
import { customersHelp } from './modules/customers';
import { dashboardHelp } from './modules/dashboard';
import { unitsHelp } from './modules/units';
import { techniciansHelp } from './modules/technicians';
import { plasmaProjectsHelp } from './modules/plasma_projects';
import { plasmaTemplatesHelp } from './modules/plasma_templates';
import { receivingHistoryHelp } from './modules/receiving_history';
import { vendorsHelp } from './modules/vendors';
import { partCategoriesHelp } from './modules/part_categories';
import { cycleCountsHelp } from './modules/cycle_counts';
import { returnsWarrantyReportHelp } from './modules/returns_warranty_report';
import { settingsHelp } from './modules/settings';

export interface ModuleHelpContent {
  title: string;
  tips: { title?: string; items: string[] }[];
  workflows: { title: string; steps: string[] }[];
  definitions: { term: string; meaning: string }[];
}

export const helpByModule: Record<string, ModuleHelpContent> = {
  inventory: inventoryHelp,
  parts: partsHelp,
  sales_orders: salesOrdersHelp,
  purchase_orders: purchaseOrdersHelp,
  receiving: receivingHelp,
  work_orders: workOrdersHelp,
  invoices: invoicesHelp,
  payments: paymentsHelp,
  scheduling: schedulingHelp,
  warranty_returns: warrantyReturnsHelp,
  customers: customersHelp,
  dashboard: dashboardHelp,
  units: unitsHelp,
  technicians: techniciansHelp,
  plasma_projects: plasmaProjectsHelp,
  plasma_templates: plasmaTemplatesHelp,
  receiving_history: receivingHistoryHelp,
  vendors: vendorsHelp,
  part_categories: partCategoriesHelp,
  cycle_counts: cycleCountsHelp,
  returns_warranty_report: returnsWarrantyReportHelp,
  settings: settingsHelp,
};

export function getModuleHelp(moduleKey: string): ModuleHelpContent | null {
  return helpByModule[moduleKey] || null;
}
