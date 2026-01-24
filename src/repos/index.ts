import { useSyncExternalStore } from 'react';

import { useShopStore } from '@/stores/shopStore';
import { moneyRound, moneySafe } from '@/lib/utils';

import type { Repos } from './repos';
import { zustandRepos } from './zustandRepos';
import { settingsRepoApi } from './api/settingsRepoApi';
import { unitsRepoApi } from './api/unitsRepoApi';
import { vendorsRepoApi } from './api/vendorsRepoApi';
import { categoriesRepoApi } from './api/categoriesRepoApi';
import { partsRepoApi } from './api/partsRepoApi';
import { techniciansRepoApi } from './api/techniciansRepoApi';

// In-memory storage for invoices
const invoicesStore = new Map<string, import('@/types').Invoice>();
const invoiceLinesStore = new Map<string, import('@/types').InvoiceLine[]>();
let invoiceCounter = 0;

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
  invoices: {
    createFromSalesOrder: async (input: { salesOrderId: string }) => {
      const order = zustandRepos.salesOrders.salesOrders.find((so) => so.id === input.salesOrderId);
      if (!order) {
        throw new Error(`Sales order not found: ${input.salesOrderId}`);
      }

      const lines = zustandRepos.salesOrders.getSalesOrderLines(input.salesOrderId);
      const partLines = lines.filter((line) => !line.is_core_refund_line);

      const subtotal_parts = moneyRound(
        partLines.reduce((sum, line) => sum + moneySafe(line.line_total), 0)
      );
      const tax_rate = moneySafe(order.tax_rate);
      const tax_amount = moneyRound(subtotal_parts * (tax_rate / 100));
      const total = moneyRound(subtotal_parts + tax_amount);

      invoiceCounter += 1;
      const invoice_number = `INV-${String(invoiceCounter).padStart(6, '0')}`;
      const invoiceId = `inv_${Date.now()}_${invoiceCounter}`;

      const invoice: import('@/types').Invoice = {
        id: invoiceId,
        invoice_number,
        source_type: 'SALES_ORDER',
        source_id: input.salesOrderId,
        customer_id: order.customer_id,
        unit_id: order.unit_id ?? null,
        status: 'DRAFT',
        issued_at: null,
        due_at: null,
        subtotal_parts,
        subtotal_labor: 0,
        subtotal_fees: 0,
        tax_amount,
        total,
        balance_due: total,
        snapshot_json: undefined,
        voided_at: null,
        void_reason: null,
      };

      const invoiceLines: import('@/types').InvoiceLine[] = partLines.map((line, idx) => ({
        id: `inv_line_${Date.now()}_${invoiceCounter}_${idx}`,
        invoice_id: invoiceId,
        line_type: 'PART',
        ref_type: 'sales_order_line',
        ref_id: line.id,
        description: line.description ?? (line.part as { name?: string } | undefined)?.name ?? 'Part',
        qty: line.quantity,
        unit_price: line.unit_price,
        amount: line.line_total,
        taxable: true,
        tax_rate: order.tax_rate,
      }));

      invoicesStore.set(invoiceId, invoice);
      invoiceLinesStore.set(invoiceId, invoiceLines);


      return { invoiceId };
    },
    createFromWorkOrder: async (input: { workOrderId: string }) => {
      const workOrder = zustandRepos.workOrders.workOrders.find((wo) => wo.id === input.workOrderId);
      if (!workOrder) {
        throw new Error(`Work order not found: ${input.workOrderId}`);
      }

      const partLines = zustandRepos.workOrders.getWorkOrderPartLines(input.workOrderId);
      const laborLines = zustandRepos.workOrders.getWorkOrderLaborLines(input.workOrderId);
      const chargeLines = zustandRepos.workOrders.getWorkOrderChargeLines(input.workOrderId);

      const validPartLines = partLines.filter((line) => !line.is_core_refund_line);
      const validLaborLines = laborLines;
      const validChargeLines = chargeLines;

      const subtotal_parts = moneyRound(
        validPartLines.reduce((sum, line) => sum + moneySafe(line.line_total), 0)
      );
      const subtotal_labor = moneyRound(
        validLaborLines.reduce((sum, line) => sum + moneySafe(line.line_total), 0)
      );
      const subtotal_fees = moneyRound(
        validChargeLines.reduce((sum, line) => sum + moneySafe(line.total_price), 0)
      );

      const tax_base = subtotal_parts + subtotal_labor + subtotal_fees;
      const tax_rate = moneySafe(workOrder.tax_rate);
      const tax_amount = tax_rate ? moneyRound(tax_base * (tax_rate / 100)) : 0;
      const total = moneyRound(subtotal_parts + subtotal_labor + subtotal_fees + tax_amount);

      invoiceCounter += 1;
      const invoice_number = `INV-${String(invoiceCounter).padStart(6, '0')}`;
      const invoiceId = `inv_${Date.now()}_${invoiceCounter}`;

      const invoice: import('@/types').Invoice = {
        id: invoiceId,
        invoice_number,
        source_type: 'WORK_ORDER',
        source_id: input.workOrderId,
        customer_id: workOrder.customer_id,
        unit_id: workOrder.unit_id ?? null,
        status: 'DRAFT',
        issued_at: null,
        due_at: null,
        subtotal_parts,
        subtotal_labor,
        subtotal_fees,
        tax_amount,
        total,
        balance_due: total,
        snapshot_json: undefined,
        voided_at: null,
        void_reason: null,
      };

      const invoiceLines: import('@/types').InvoiceLine[] = [];

      let lineIdx = 0;
      for (const line of validPartLines) {
        invoiceLines.push({
          id: `inv_line_${Date.now()}_${invoiceCounter}_${lineIdx}`,
          invoice_id: invoiceId,
          line_type: 'PART',
          ref_type: 'work_order_line',
          ref_id: line.id,
          description: line.description ?? (line.part as { part_number?: string } | undefined)?.part_number ?? 'Part',
          qty: line.quantity,
          unit_price: line.unit_price,
          amount: line.line_total,
          taxable: true,
          tax_rate: workOrder.tax_rate,
        });
        lineIdx += 1;
      }

      for (const line of validLaborLines) {
        invoiceLines.push({
          id: `inv_line_${Date.now()}_${invoiceCounter}_${lineIdx}`,
          invoice_id: invoiceId,
          line_type: 'LABOR',
          ref_type: 'work_order_line',
          ref_id: line.id,
          description: line.description,
          qty: line.hours,
          unit_price: line.rate,
          amount: line.line_total,
          taxable: true,
          tax_rate: workOrder.tax_rate,
        });
        lineIdx += 1;
      }

      for (const line of validChargeLines) {
        invoiceLines.push({
          id: `inv_line_${Date.now()}_${invoiceCounter}_${lineIdx}`,
          invoice_id: invoiceId,
          line_type: 'FEE',
          ref_type: 'work_order_line',
          ref_id: line.id,
          description: line.description,
          qty: line.qty,
          unit_price: line.unit_price,
          amount: line.total_price,
          taxable: true,
          tax_rate: workOrder.tax_rate,
        });
        lineIdx += 1;
      }

      invoicesStore.set(invoiceId, invoice);
      invoiceLinesStore.set(invoiceId, invoiceLines);

      return { invoiceId };
    },
    voidInvoice: async (input: { invoiceId: string; reason: string }) => {
      const reason = input.reason?.trim();
      if (!reason) {
        throw new Error('Void reason is required');
      }
      const current = invoicesStore.get(input.invoiceId);
      if (!current) throw new Error('Invoice not found');
      if (current.voided_at) throw new Error('Invoice already voided');

      const paid = Math.max(0, (current.total ?? 0) - (current.balance_due ?? 0));
      if (paid > 0.01) {
        throw new Error('Invoice has payments; void payments first.');
      }

      const updated: import('@/types').Invoice = {
        ...current,
        voided_at: new Date().toISOString(),
        void_reason: reason,
        status: 'VOIDED',
        balance_due: 0,
      };
      invoicesStore.set(input.invoiceId, updated);
      return updated;
    },
    getById: async (input: { invoiceId: string }) => {
      const invoice = invoicesStore.get(input.invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${input.invoiceId}`);
      }
      return invoice;
    },
    listLines: async (input: { invoiceId: string }) => {
      return invoiceLinesStore.get(input.invoiceId) ?? [];
    },
    listAll: async () => {
      return Array.from(invoicesStore.values());
    },
  },
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
