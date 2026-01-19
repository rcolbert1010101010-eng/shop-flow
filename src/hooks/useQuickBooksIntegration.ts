import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type IntegrationConnection = {
  provider: string;
  status: string;
  display_name?: string | null;
  updated_at?: string | null;
};

export type AccountingConfig = {
  id?: string;
  provider: string;
  is_enabled: boolean;
  mode: string;
  calculation_source: string;
  auto_create_customers: boolean;
  export_trigger: string;
  start_export_from_date?: string | null;
  default_terms_name?: string | null;
  default_deposit_item_name?: string | null;
  class_tracking_enabled: boolean;
  default_class_name?: string | null;
  income_account_labor?: string | null;
  income_account_parts?: string | null;
  income_account_fees?: string | null;
  income_account_sublet?: string | null;
  liability_account_sales_tax?: string | null;
  clearing_account_undeposited_funds?: string | null;
  line_item_strategy: string;
  customer_match_strategy: string;
  customer_name_format: string;
};

const PROVIDER = 'quickbooks';

const stableStringify = (value: any): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
};

const hashSha256 = async (input: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback: not cryptographically strong, but keeps flow moving
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash)}`;
};

const uuid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function useQuickBooksIntegration() {
  const [connection, setConnection] = useState<IntegrationConnection | null>(null);
  const [config, setConfig] = useState<AccountingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [{ data: connectionRows }, { data: configRows }] = await Promise.all([
      supabase.from('integration_connections').select('*').eq('provider', PROVIDER).maybeSingle(),
      supabase.from('accounting_integration_config').select('*').eq('provider', PROVIDER).maybeSingle(),
    ]);
    setConnection(connectionRows ? (connectionRows as IntegrationConnection) : null);
    setConfig(
      configRows
        ? (configRows as AccountingConfig)
        : {
            provider: PROVIDER,
            is_enabled: false,
            mode: 'INVOICE_ONLY',
            calculation_source: 'SHOPFLOW',
            auto_create_customers: true,
            export_trigger: 'ON_INVOICE_FINALIZED',
            start_export_from_date: null,
            default_terms_name: null,
            default_deposit_item_name: null,
            class_tracking_enabled: false,
            default_class_name: null,
            income_account_labor: null,
            income_account_parts: null,
            income_account_fees: null,
            income_account_sublet: null,
            liability_account_sales_tax: null,
            clearing_account_undeposited_funds: null,
            line_item_strategy: 'ROLLUP',
            customer_match_strategy: 'DISPLAY_NAME',
            customer_name_format: '{{companyName}}',
          }
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConfig = useCallback(
    async (next: AccountingConfig) => {
      if (!supabase) return;
      setSaving(true);
      setError(null);
      const { data, error: upsertError } = await supabase
        .from('accounting_integration_config')
        .upsert({ ...next, provider: PROVIDER })
        .select()
        .maybeSingle();
      if (upsertError) {
        setError(upsertError.message);
      } else if (data) {
        setConfig(data as AccountingConfig);
      }
      setSaving(false);
    },
    []
  );

  const createTestExport = useCallback(
    async (payload: any) => {
      if (!supabase) return { success: false, error: 'Supabase not configured' };
      const payloadString = stableStringify(payload);
      const payloadHash = await hashSha256(payloadString);
      const { error: insertError } = await supabase.from('accounting_exports').insert({
        provider: PROVIDER,
        export_type: 'INVOICE',
        source_entity_type: payload?.source?.type?.toLowerCase() || 'invoice',
        source_entity_id: uuid(),
        payload_json: payload,
        payload_hash: payloadHash,
      });
      if (insertError) {
        return { success: false, error: insertError.message };
      }
      return { success: true };
    },
    []
  );

  const getConfig = useCallback(async (): Promise<AccountingConfig | null> => {
    if (config) return config;
    const { data } = await supabase
      .from('accounting_integration_config')
      .select('*')
      .eq('provider', PROVIDER)
      .maybeSingle();
    if (data) {
      setConfig(data as AccountingConfig);
      return data as AccountingConfig;
    }
    return null;
  }, [config]);

  const createInvoiceExport = useCallback(
    async (invoice: any, invoiceLines: any[] = []) => {
      if (!supabase) return { success: false, error: 'Supabase not configured' };
      if (!invoice?.id) return { success: false, error: 'Invoice not found' };

      const cfg = await getConfig();
      const toNumber = (value: any) => {
        const n = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
        return Number.isFinite(n) ? n : 0;
      };

      const classify = (line: any) => {
        const type = (line?.line_type || line?.type || '').toString().toUpperCase();
        if (type === 'LABOR') return 'LABOR';
        if (type === 'PART') return 'PARTS';
        if (type === 'FEE' || type === 'SUBLET' || type === 'CHARGE') return 'FEES_SUBLET';
        const desc = (line?.description || '').toLowerCase();
        if (desc.includes('labor')) return 'LABOR';
        if (desc.includes('fee') || desc.includes('sublet') || desc.includes('charge')) return 'FEES_SUBLET';
        return 'PARTS';
      };

      const rollups = invoiceLines?.reduce(
        (acc, line) => {
          const bucket = classify(line);
          const amt = toNumber(line?.amount);
          if (bucket === 'LABOR') acc.labor += amt;
          else if (bucket === 'FEES_SUBLET') acc.fees += amt;
          else acc.parts += amt;
          return acc;
        },
        { labor: 0, parts: 0, fees: 0 }
      ) ?? { labor: 0, parts: 0, fees: 0 };

      const payload = {
        schema_version: 1,
        provider: PROVIDER,
        source: {
          type: 'INVOICE',
          id: invoice.id,
          number: invoice.invoice_number || invoice.id,
          date: (invoice as any).invoice_date || (invoice as any).created_at || new Date().toISOString(),
        },
        customer: {
          shopflow_customer_id: invoice.customer_id || invoice.customer?.id || null,
          display_name: invoice.customer?.company_name || invoice.customer?.name || 'Unknown Customer',
        },
        lines: [
          {
            kind: 'LABOR',
            amount: rollups.labor,
            account_ref: cfg?.income_account_labor ?? null,
          },
          {
            kind: 'PARTS',
            amount: rollups.parts,
            account_ref: cfg?.income_account_parts ?? null,
          },
          {
            kind: 'FEES_SUBLET',
            amount: rollups.fees,
            account_ref: cfg?.income_account_fees ?? cfg?.income_account_sublet ?? null,
          },
        ],
        tax: {
          amount: toNumber(invoice.tax_total ?? invoice.tax_amount ?? 0),
          liability_account_ref: cfg?.liability_account_sales_tax ?? null,
        },
        total: toNumber(
          invoice.total ??
            rollups.labor + rollups.parts + rollups.fees + toNumber(invoice.tax_total ?? invoice.tax_amount ?? 0)
        ),
      };

      const payloadHash = await hashSha256(stableStringify(payload));
      const { error: insertError } = await supabase.from('accounting_exports').insert({
        provider: PROVIDER,
        export_type: 'INVOICE',
        source_entity_type: 'invoice',
        source_entity_id: invoice.id,
        payload_json: payload,
        payload_hash: payloadHash,
        status: 'PENDING',
      });
      if (insertError) {
        if (insertError.code === '23505') {
          return { success: false, error: 'duplicate' };
        }
        return { success: false, error: insertError.message };
      }
      return { success: true };
    },
    [getConfig]
  );

  const listRecentExports = useCallback(async () => {
    if (!supabase) return [];
    const { data } = await supabase
      .from('accounting_exports')
      .select('id,status,created_at,export_type,source_entity_type,source_entity_id,attempt_count,last_error')
      .eq('provider', PROVIDER)
      .order('created_at', { ascending: false })
      .limit(10);
    return data ?? [];
  }, []);

  const getExportPayload = useCallback(async (exportId: string) => {
    if (!supabase) return null;
    const { data } = await supabase
      .from('accounting_exports')
      .select('payload_json')
      .eq('provider', PROVIDER)
      .eq('id', exportId)
      .maybeSingle();
    return data?.payload_json ?? null;
  }, []);

  const retryExport = useCallback(
    async (exportId: string) => {
      if (!supabase) return { success: false, error: 'Supabase not configured' };
      const { data: existing, error: fetchError } = await supabase
        .from('accounting_exports')
        .select('attempt_count')
        .eq('provider', PROVIDER)
        .eq('id', exportId)
        .maybeSingle();
      if (fetchError) return { success: false, error: fetchError.message };
      const nextAttempt = (existing?.attempt_count ?? 0) + 1;

      const { error: updateError } = await supabase
        .from('accounting_exports')
        .update({
          status: 'PENDING',
          attempt_count: nextAttempt,
          last_attempt_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('provider', PROVIDER)
        .eq('id', exportId);

      // attempt_count++ without RPC: read current value and update
      if (updateError) {
        return { success: false, error: updateError.message };
      }
      return { success: true };
    },
    []
  );

  return {
    connection,
    config,
    loading,
    saving,
    error,
    reload: load,
    saveConfig,
    createTestExport,
    createInvoiceExport,
    listRecentExports,
    getExportPayload,
    retryExport,
  };
}
