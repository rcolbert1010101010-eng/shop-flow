import { supabase } from '@/integrations/supabase/client';

export const invoicesRepoApi = {
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

  async createFromWorkOrder(_input: { workOrderId: string }): Promise<{ invoiceId: string }> {
    throw new Error('createFromWorkOrder not yet implemented in Supabase repo');
  },

  async createFromSalesOrder(_input: { salesOrderId: string }): Promise<{ invoiceId: string }> {
    throw new Error('createFromSalesOrder not yet implemented in Supabase repo');
  },
};
