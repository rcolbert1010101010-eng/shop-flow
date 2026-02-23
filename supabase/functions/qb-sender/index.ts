// QuickBooks sender worker: claims accounting_exports and posts invoices
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, QUICKBOOKS_ENVIRONMENT, QUICKBOOKS_TOKEN_ENC_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, SHOPFLOW_SERVICE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getQboApiBase } from '../_shared/qb_env.ts';
import { refreshQuickBooksAccessToken } from '../_shared/qb_refresh.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const shopflowServiceKey = (Deno.env.get('SHOPFLOW_SERVICE_KEY') ?? '').trim();
const qbApiBase = getQboApiBase();

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-shopflow-service-key',
};

const backoffMs = (attempt: number) => {
  if (attempt <= 1) return 5 * 60 * 1000;
  if (attempt === 2) return 15 * 60 * 1000;
  return 60 * 60 * 1000;
};

type ExportRow = {
  id: string;
  tenant_id: string | null;
  export_type: string;
  payload_json: any;
  status: string | null;
  external_id?: string | null;
  attempt_count?: number | null;
  sent_at?: string | null;
};

type SendResult = {
  claimed: number;
  sent: number;
  failed: number;
  retried: number;
};

type IntegrationConfig = {
  id: string;
  tenant_id: string;
  provider: string;
  qb_customer_ref?: string | null;
  qb_item_ref_parts?: string | null;
  qb_item_ref_labor?: string | null;
  qb_item_ref_fees_sublet?: string | null;
};

const parseLimit = async (req: Request) => {
  const url = new URL(req.url);
  const fromQuery = Number(url.searchParams.get('limit'));
  if (Number.isFinite(fromQuery) && fromQuery > 0) return Math.min(fromQuery, 100);
  try {
    const body = await req.json();
    const fromBody = Number(body?.limit);
    if (Number.isFinite(fromBody) && fromBody > 0) return Math.min(fromBody, 100);
  } catch {
    // ignore
  }
  return 10;
};

const normalizeClaimedIds = (data: unknown): string[] => {
  if (!Array.isArray(data)) return [];
  if (data.length === 0) return [];
  if (typeof data[0] === 'string') {
    return (data as unknown[])
      .filter((id) => typeof id === 'string')
      .map((id) => (id as string).trim())
      .filter((id) => id.length > 0);
  }
  if (typeof data[0] === 'object' && data[0] !== null) {
    return (data as Array<Record<string, unknown>>)
      .map((row) => (typeof row.id === 'string' ? row.id.trim() : ''))
      .filter((id) => id.length > 0);
  }
  return [];
};

const claimExports = async (limit: number) => {
  const { data, error } = await supabase.rpc('claim_accounting_exports_service', {
    p_provider: 'quickbooks',
    p_limit: limit,
  });
  if (error) throw error;
  return normalizeClaimedIds(data);
};

const loadExports = async (ids: string[]) => {
  if (ids.length === 0) return [] as ExportRow[];
  const { data, error } = await supabase
    .from('accounting_exports')
    .select('id,tenant_id,export_type,payload_json,status,external_id,attempt_count,sent_at')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as ExportRow[];
};

const loadConnection = async (tenantId: string | null) => {
  if (!tenantId) return { error: 'tenant_id missing on export' } as const;
  const { data, error } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'quickbooks')
    .in('status', ['CONNECTED', 'ACTIVE'])
    .maybeSingle();
  if (error || !data) return { error: 'QB not connected' } as const;
  if (!data.external_realm_id) return { error: 'QB realm missing' } as const;
  return { conn: data } as const;
};

const loadConfig = async (tenantId: string | null) => {
  if (!tenantId) return { error: 'tenant_id missing on export' } as const;
  const { data, error } = await supabase
    .from('accounting_integration_config')
    .select('id,tenant_id,provider,is_enabled,transfer_mode,qb_customer_ref,qb_item_ref_parts,qb_item_ref_labor,qb_item_ref_fees_sublet')
    .eq('provider', 'quickbooks')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !data) return { error: 'QuickBooks config missing' } as const;
  if (data.is_enabled !== true) return { error: 'QuickBooks config disabled' } as const;
  const tm = (data.transfer_mode ?? 'IMPORT_ONLY').toString().toUpperCase();
  if (tm !== 'LIVE_TRANSFER' && tm !== 'IMPORT_ONLY') {
    return { error: `QuickBooks transfer_mode is invalid: ${data.transfer_mode}` } as const;
  }
  return { cfg: data as IntegrationConfig } as const;
};

const ensureAccessToken = async (conn: any) => {
  const expiresAt = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : null;
  const needsRefresh = expiresAt !== null && expiresAt - Date.now() <= 2 * 60 * 1000;
  if (!needsRefresh) {
    if (!conn.access_token) throw new Error('Access token missing');
    return { accessToken: conn.access_token as string, connUpdated: false };
  }
  if (!conn.refresh_token) throw new Error('Refresh token missing');
  const refreshed = await refreshQuickBooksAccessToken(supabase, conn.tenant_id);
  return { accessToken: refreshed.accessToken, connUpdated: true };
};

const buildInvoiceBody = (payload: any, cfg: IntegrationConfig) => {
  if (!payload) throw new Error('Missing payload');
  if (!cfg.qb_customer_ref) throw new Error('Missing QB CustomerRef (config.qb_customer_ref)');
  const lines = Array.isArray(payload.lines) ? payload.lines : null;
  if (!lines || lines.length === 0) throw new Error('Invoice payload has no lines');
  const qbLines = lines
    .filter((line: any) => Number(line?.amount ?? 0) > 0)
    .map((line: any) => {
      const kind = (line?.kind || '').toString().toUpperCase();
      const amount = Number(line?.amount ?? 0);
      if (kind === 'LABOR') {
        if (!cfg.qb_item_ref_labor) throw new Error('Missing QB ItemRef for labor (config.qb_item_ref_labor)');
        return {
          DetailType: 'SalesItemLineDetail',
          Amount: amount,
          Description: line.description || line.kind || 'Labor',
          SalesItemLineDetail: {
            Qty: 1,
            UnitPrice: amount,
            ItemRef: { value: cfg.qb_item_ref_labor },
          },
        };
      }
      if (kind === 'PARTS') {
        if (!cfg.qb_item_ref_parts) throw new Error('Missing QB ItemRef for parts (config.qb_item_ref_parts)');
        return {
          DetailType: 'SalesItemLineDetail',
          Amount: amount,
          Description: line.description || line.kind || 'Parts',
          SalesItemLineDetail: {
            Qty: 1,
            UnitPrice: amount,
            ItemRef: { value: cfg.qb_item_ref_parts },
          },
        };
      }
      if (kind === 'FEES_SUBLET') {
        if (!cfg.qb_item_ref_fees_sublet) {
          throw new Error('Missing QB ItemRef for fees/sublet (config.qb_item_ref_fees_sublet)');
        }
        return {
          DetailType: 'SalesItemLineDetail',
          Amount: amount,
          Description: line.description || line.kind || 'Fees/Sublet',
          SalesItemLineDetail: {
            Qty: 1,
            UnitPrice: amount,
            ItemRef: { value: cfg.qb_item_ref_fees_sublet },
          },
        };
      }
      throw new Error(`Unsupported invoice line kind: ${line?.kind ?? 'UNKNOWN'}`);
    });
  if (qbLines.length === 0) throw new Error('No billable lines (all amounts <= 0)');
  const rawDocNumber = payload.source?.number || payload.source?.id;
  const docNumber = (!rawDocNumber || rawDocNumber === 'TEST-001' || String(rawDocNumber).startsWith('TEST'))
    ? undefined
    : rawDocNumber;
  return {
    ...(docNumber !== undefined ? { DocNumber: docNumber } : {}),
    TxnDate: payload.source?.date || new Date().toISOString().slice(0, 10),
    CustomerRef: { value: cfg.qb_customer_ref },
    Line: qbLines,
  };
};

const isRetryableStatus = (status: number) => status === 408 || status === 429 || status >= 500;

const markSuccess = async (row: ExportRow, externalId: string | null, resultJson: any) => {
  await supabase
    .from('accounting_exports')
    .update({
      status: 'SENT',
      sent_at: row.sent_at ?? new Date().toISOString(),
      external_id: externalId,
      external_result_json: resultJson ?? null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
};

const markFailure = async (
  row: ExportRow,
  status: 'PENDING' | 'FAILED',
  err: string,
  meta?: any,
) => {
  const attempt = Number(row.attempt_count ?? 0);
  const nextAttemptAt =
    status === 'PENDING'
      ? new Date(Date.now() + backoffMs(attempt)).toISOString()
      : null;

  await supabase
    .from('accounting_exports')
    .update({
      status,
      next_attempt_at: nextAttemptAt,
      last_error: err,
      external_result_json: meta ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
};

const processRow = async (row: ExportRow) => {
  if (row.status === 'SENT' || row.external_id) {
    await markSuccess(row, row.external_id ?? null, null);
    return { sent: true };
  }

  if (row.export_type !== 'INVOICE') {
    await markFailure(row, 'FAILED', `Unsupported export_type: ${row.export_type}`);
    return { failed: true };
  }

  const { cfg, error: cfgErr } = await loadConfig(row.tenant_id);
  if (cfgErr) {
    await markFailure(row, 'FAILED', cfgErr);
    return { failed: true };
  }

  const { conn, error: connErr } = await loadConnection(row.tenant_id);
  if (connErr) {
    await markFailure(row, 'FAILED', connErr);
    return { failed: true };
  }

  let accessToken: string;
  try {
    const { accessToken: token } = await ensureAccessToken(conn);
    accessToken = token;
  } catch (err: any) {
    await markFailure(row, 'FAILED', err?.message || 'Token error');
    return { failed: true };
  }

  let body: any;
  try {
    body = buildInvoiceBody(row.payload_json, cfg);
  } catch (err: any) {
    await markFailure(row, 'FAILED', err?.message || 'Mapping failed');
    return { failed: true };
  }

  const realmId = conn.external_realm_id;
  const url = `${qbApiBase}/v3/company/${realmId}/invoice?minorversion=73`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let errMsg = `QB error ${resp.status}`;
    let faultMeta: any = { status: resp.status };
    try {
      const j = await resp.json();
      const fault = j?.Fault?.Error?.[0]?.Message || j?.Fault?.Error?.[0]?.Detail;
      if (fault) errMsg += `: ${fault}`;
      if (j?.Fault) faultMeta = { ...faultMeta, Fault: j.Fault };
    } catch {
      // ignore parse errors
    }

    if (isRetryableStatus(resp.status)) {
      await markFailure(row, 'PENDING', errMsg, faultMeta);
      return { retried: true };
    }

    await markFailure(row, 'FAILED', errMsg, faultMeta);
    return { failed: true };
  }

  let respJson: any = null;
  try {
    respJson = await resp.json();
  } catch {
    // ignore
  }
  const remoteId = respJson?.Invoice?.Id || null;

  // Persist QB remote mapping before marking SENT
  if (remoteId && row.tenant_id && row.source_entity_type && row.source_entity_id) {
    const { error: upsertErr } = await supabase
      .from('external_references')
      .upsert({
        tenant_id: row.tenant_id,
        provider: 'quickbooks',
        entity_type: row.source_entity_type,
        entity_id: row.source_entity_id,
        remote_id: remoteId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'provider,entity_type,entity_id' });
    if (upsertErr) {
      await markFailure(row, 'PENDING', `external_references upsert failed: ${upsertErr.message}`);
      return { retried: true };
    }
  }

  await markSuccess(row, remoteId, respJson);
  return { sent: true };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  console.log('SHOPFLOW_SERVICE_KEY:', shopflowServiceKey);
  const incomingServiceKey = (req.headers.get('x-shopflow-service-key') ?? '').trim();
  if (!shopflowServiceKey || !incomingServiceKey || incomingServiceKey !== shopflowServiceKey) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  const limit = await parseLimit(req);
  const result: SendResult = { claimed: 0, sent: 0, failed: 0, retried: 0 };

  try {
    const claimedIds = await claimExports(limit);
    result.claimed = claimedIds.length;

    const rows = await loadExports(claimedIds);
    for (const row of rows) {
      const res = await processRow(row);
      if (res.sent) result.sent += 1;
      if (res.failed) result.failed += 1;
      if (res.retried) result.retried += 1;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  } catch (err: any) {
    console.error('qb-sender error', err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }
});
