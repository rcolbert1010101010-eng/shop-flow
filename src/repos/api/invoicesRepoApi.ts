import { supabase } from '@/integrations/supabase/client';
import { zustandRepos } from '../zustandRepos';
import { moneyRound, moneySafe } from '@/lib/utils';

function generateInvoiceNumber(): string {
  return 'INV-' + Date.now().toString().slice(-8);
}

export const invoicesRepoApi = {
  async createFromWorkOrder({ workOrderId }: { workOrderId: string }): Promise<{ invoiceId: string }> {
    const workOrder = zustandRepos.workOrders.workOrders.find((wo) => wo.id === workOrderId);
    if (!workOrder) throw new Error('Work order not found: ' + workOrderId);

    const partLines = zustandRepos.workOrders.getWorkOrderPartLines(workOrderId);
    const laborLines = zustandRepos.workOrders.getWorkOrderLaborLines(workOrderId);
    const chargeLines = zustandRepos.workOrders.getWorkOrderChargeLines(workOrderId);

    const validPartLines = partLines.filter((l) => !l.is_core_refund_line);

    const subtotal_parts = moneyRound(validPartLines.reduce((s, l) => s + moneySafe(l.line_total), 0));
    const subtotal_labor = moneyRound(laborLines.reduce((s, l) => s + moneySafe(l.line_total), 0));
    const subtotal_fees = moneyRound(chargeLines.reduce((s, l) => s + moneySafe(l.total_price), 0));
    const tax_base = subtotal_parts + subtotal_labor + subtotal_fees;
    const tax_rate = moneySafe(workOrder.tax_rate);
    const tax_amount = tax_rate ? moneyRound(tax_base * (tax_rate / 100)) : 0;
    const total = moneyRound(subtotal_parts + subtotal_labor + subtotal_fees + tax_amount);

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: generateInvoiceNumber(),
        source_type: 'WORK_ORDER',
        source_id: workOrderId,
        customer_id: workOrder.customer_id,
        status: 'ISSUED',
        subtotal_parts,
        subtotal_labor,
        subtotal_fees,
        tax_amount,
        total,
        balance_due: total,
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (invoiceError) throw new Error(invoiceError.message);
    if (!invoice) throw new Error('Invoice not created');

    const invoiceLines = [];
    for (const line of validPartLines) {
      invoiceLines.push({
        invoice_id: invoice.id,
        line_type: 'PART',
        description: line.description ?? 'Part',
        qty: line.quantity,
        unit_price: line.unit_price,
        amount: line.line_total,
      });
    }
    for (const line of laborLines) {
      invoiceLines.push({
        invoice_id: invoice.id,
        line_type: 'LABOR',
        description: line.description,
        qty: line.hours,
        unit_price: line.rate,
        amount: line.line_total,
      });
    }
    for (const line of chargeLines) {
      invoiceLines.push({
        invoice_id: invoice.id,
        line_type: 'FEE',
        description: line.description,
        qty: line.qty,
        unit_price: line.unit_price,
        amount: line.total_price,
      });
    }

    if (invoiceLines.length > 0) {
      const { error: linesError } = await supabase.from('invoice_lines').insert(invoiceLines);
      if (linesError) throw new Error(linesError.message);
    }

    return { invoiceId: invoice.id };
  },

  async createFromSalesOrder({ salesOrderId }: { salesOrderId: string }): Promise<{ invoiceId: string }> {
    const order = zustandRepos.salesOrders.salesOrders.find((so) => so.id === salesOrderId);
    if (!order) throw new Error('Sales order not found: ' + salesOrderId);

    const lines = zustandRepos.salesOrders.getSalesOrderLines(salesOrderId);
    const partLines = lines.filter((l) => !l.is_core_refund_line);

    const subtotal_parts = moneyRound(partLines.reduce((s, l) => s + moneySafe(l.line_total), 0));
    const tax_rate = moneySafe(order.tax_rate);
    const tax_amount = moneyRound(subtotal_parts * (tax_rate / 100));
    const total = moneyRound(subtotal_parts + tax_amount);

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: generateInvoiceNumber(),
        source_type: 'SALES_ORDER',
        source_id: salesOrderId,
        customer_id: order.customer_id,
        status: 'ISSUED',
        subtotal_parts,
        subtotal_labor: 0,
        subtotal_fees: 0,
        tax_amount,
        total,
        balance_due: total,
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (invoiceError) throw new Error(invoiceError.message);
    if (!invoice) throw new Error('Invoice not created');

    const invoiceLines = partLines.map((line) => ({
      invoice_id: invoice.id,
      line_type: 'PART',
      description: line.description ?? 'Part',
      qty: line.quantity,
      unit_price: line.unit_price,
      amount: line.line_total,
    }));

    if (invoiceLines.length > 0) {
      const { error: linesError } = await supabase.from('invoice_lines').insert(invoiceLines);
      if (linesError) throw new Error(linesError.message);
    }

    return { invoiceId: invoice.id };
  },

  async getById({ invoiceId }: { invoiceId: string }) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Invoice not found');
    return data;
  },

  async listLines({ invoiceId }: { invoiceId: string }) {
    const { data, error } = await supabase
      .from('invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async list() {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async voidInvoice({ invoiceId, reason }: { invoiceId: string; reason: string }) {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        voided_at: new Date().toISOString(),
        void_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async listAll() {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
