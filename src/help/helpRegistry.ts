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
import { manufacturingHelp } from './modules/manufacturing';

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
  manufacturing: manufacturingHelp,
};

export function getModuleHelp(moduleKey: string): ModuleHelpContent | null {
  return helpByModule[moduleKey] || null;
}
