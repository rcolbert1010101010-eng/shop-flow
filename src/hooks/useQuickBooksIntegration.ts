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

  const listRecentExports = useCallback(async () => {
    if (!supabase) return [];
    const { data } = await supabase
      .from('accounting_exports')
      .select('id,status,created_at,export_type,source_entity_type')
      .eq('provider', PROVIDER)
      .order('created_at', { ascending: false })
      .limit(10);
    return data ?? [];
  }, []);

  return {
    connection,
    config,
    loading,
    saving,
    error,
    reload: load,
    saveConfig,
    createTestExport,
    listRecentExports,
  };
}
