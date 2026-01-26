// QuickBooks sender worker: claims accounting_exports and posts invoices
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, QUICKBOOKS_ENV, QUICKBOOKS_TOKEN_ENC_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { decryptToken } from '../_shared/qb_crypto.ts';
import { refreshQuickBooksAccessToken } from '../_shared/qb_refresh.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const tokenKey = Deno.env.get('QUICKBOOKS_TOKEN_ENC_KEY')!;
const qbEnv = (Deno.env.get('QUICKBOOKS_ENV') || 'sandbox').toLowerCase();

const qbApiBase =
  qbEnv === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
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

const parseJwt = (token: string) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
};

const isAdminOrService = (req: Request) => {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token === serviceRoleKey) return true;
    const payload = parseJwt(token);
    const role = payload?.role || payload?.app_metadata?.role || payload?.user_metadata?.role;
    return role === 'ADMIN';
  }
  return false;
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
  const { data, error } = await supabase.rpc('claim_accounting_exports', {
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
    .from('quickbooks_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'CONNECTED')
    .maybeSingle();
  if (error || !data) return { error: 'QB not connected' } as const;
  if (!data.realm_id) return { error: 'QB realm missing' } as const;
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
  if (data.transfer_mode !== 'LIVE_TRANSFER') {
    return { error: 'QuickBooks transfer_mode is not LIVE_TRANSFER' } as const;
  }
  return { cfg: data as IntegrationConfig } as const;
};

const ensureAccessToken = async (conn: any) => {
  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : null;
  const needsRefresh = expiresAt !== null && expiresAt - Date.now() <= 2 * 60 * 1000;
  if (!needsRefresh) {
    return { accessToken: await decryptToken(tokenKey, conn.access_token_enc), connUpdated: false };
  }
  if (!conn.refresh_token_enc) throw new Error('Refresh token missing');
  const refreshed = await refreshQuickBooksAccessToken(conn.refresh_token_enc);
  await supabase
    .from('quickbooks_connections')
    .update({
      access_token_enc: refreshed.accessEnc,
      refresh_token_enc: refreshed.refreshEnc,
      expires_at: refreshed.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', conn.tenant_id);
  return { accessToken: await decryptToken(tokenKey, refreshed.accessEnc), connUpdated: true };
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
  return {
    DocNumber: payload.source?.number || payload.source?.id,
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

  const realmId = conn.realm_id;
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

  await markSuccess(row, remoteId, respJson);
  return { sent: true };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!isAdminOrService(req)) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
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
