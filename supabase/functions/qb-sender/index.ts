// QuickBooks sender worker: consumes accounting_exports and posts invoices
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, QUICKBOOKS_ENV, QUICKBOOKS_TOKEN_ENC_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { decryptToken } from '../_shared/qb_crypto.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const tokenKey = Deno.env.get('QUICKBOOKS_TOKEN_ENC_KEY')!;
const qbEnv = (Deno.env.get('QUICKBOOKS_ENV') || 'sandbox').toLowerCase();

const qbApiBase =
  qbEnv === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const backoffMs = (attempt: number) => {
  if (attempt <= 1) return 5 * 60 * 1000;
  if (attempt === 2) return 15 * 60 * 1000;
  return 60 * 60 * 1000;
};

type ExportRow = {
  id: string;
  tenant_id?: string;
  payload_json: any;
  status: string;
  remote_id?: string | null;
  attempt_count?: number;
};

async function claimBatch() {
  const { data, error } = await supabase
    .from('accounting_exports')
    .select('*')
    .eq('provider', 'quickbooks')
    .eq('export_type', 'INVOICE')
    .eq('status', 'PENDING')
    .or('next_attempt_at.is.null,next_attempt_at.lte.' + new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(10);
  if (error || !data) return [];
  return data as ExportRow[];
}

async function claimRow(row: ExportRow) {
  const claimedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('accounting_exports')
    .update({
      next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      provider_meta_json: { ...(row as any).provider_meta_json, claimed_at: claimedAt, claimed_by: 'qb-sender' },
      updated_at: claimedAt,
    })
    .eq('id', row.id)
    .eq('status', 'PENDING')
    .or('next_attempt_at.is.null,next_attempt_at.lte.' + new Date().toISOString())
    .select('*')
    .maybeSingle();
  if (error || !data) return null;
  return data as ExportRow;
}

async function markResult(
  row: ExportRow,
  status: string,
  fields: Record<string, unknown> = {},
  err?: string,
) {
  const attempt = (row.attempt_count ?? 0) + (status === 'FAILED' ? 1 : 0);
  const nextAttempt =
    status === 'FAILED'
      ? new Date(Date.now() + backoffMs(attempt)).toISOString()
      : null;
  const update: Record<string, unknown> = {
    status,
    attempt_count: attempt,
    last_error: err ?? null,
    next_attempt_at: nextAttempt,
    ...fields,
  };
  await supabase.from('accounting_exports').update(update).eq('id', row.id);
}

async function loadConnection(tenantId?: string) {
  if (!tenantId) return { error: 'tenant_id missing on export' };
  const { data, error } = await supabase
    .from('quickbooks_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'CONNECTED')
    .maybeSingle();
  if (error || !data) return { error: 'QB not connected' };
  if (!data.realm_id) return { error: 'QB realm missing' };
  return { conn: data };
}

function buildInvoiceBody(payload: any) {
  if (!payload) throw new Error('Missing payload');
  const customerRef =
    payload.customer?.qb_customer_id ||
    payload.customer?.id ||
    payload.customer_id;
  if (!customerRef) throw new Error('CustomerRef missing');
  const lines = Array.isArray(payload.lines) ? payload.lines : null;
  if (!lines || lines.length === 0) throw new Error('Invoice payload mapping not implemented');
  const qbLines = lines.map((line: any) => ({
    DetailType: 'SalesItemLineDetail',
    Amount: line.amount ?? 0,
    Description: line.description || line.kind || 'Line',
    SalesItemLineDetail: {
      Qty: line.qty ?? 1,
      UnitPrice: line.amount ?? 0,
      ItemRef: { value: line.item_ref || line.kind || 'ITEM' },
    },
  }));
  return {
    DocNumber: payload.source?.number || payload.source?.id,
    TxnDate: payload.source?.date || new Date().toISOString().slice(0, 10),
    CustomerRef: { value: customerRef },
    Line: qbLines,
  };
}

async function processRow(row: ExportRow) {
  if (row.remote_id || row.status === 'SENT') {
    await markResult(row, 'SENT', { remote_id: row.remote_id, sent_at: row.sent_at ?? new Date().toISOString() });
    return;
  }

  const { conn, error: connErr } = await loadConnection((row as any).tenant_id);
  if (connErr) {
    await markResult(row, 'FAILED', {}, connErr);
    return;
  }

  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : null;
  if (expiresAt && expiresAt - Date.now() <= 2 * 60 * 1000) {
    await markResult(row, 'FAILED', {}, 'Token refresh not implemented');
    return;
  }

  const accessTokenEnc = conn.access_token_enc as string;
  if (!accessTokenEnc) {
    await markResult(row, 'FAILED', {}, 'Access token missing');
    return;
  }
  let accessToken: string;
  try {
    accessToken = await decryptToken(tokenKey, accessTokenEnc);
  } catch (err: any) {
    await markResult(row, 'FAILED', {}, 'Token decrypt failed');
    return;
  }

  let body: any;
  try {
    body = buildInvoiceBody(row.payload_json);
  } catch (err: any) {
    await markResult(row, 'FAILED', {}, err?.message || 'Mapping failed');
    return;
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
    await markResult(row, 'FAILED', { provider_meta_json: faultMeta }, errMsg);
    return;
  }

  let respJson: any = null;
  try {
    respJson = await resp.json();
  } catch {
    // ignore
  }
  const remoteId = respJson?.Invoice?.Id || null;

  await supabase
    .from('accounting_exports')
    .update({
      status: 'SENT',
      remote_id: remoteId,
      provider_meta_json: respJson ? { Invoice: { Id: remoteId } } : null,
      sent_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', row.id);
}

Deno.serve(async () => {
  const batch = await claimBatch();
  let claimedCount = 0;
  let processedCount = 0;
  for (const row of batch) {
    const claimed = await claimRow(row);
    if (!claimed) continue;
    claimedCount += 1;
    await processRow(claimed);
    processedCount += 1;
  }
  return new Response(JSON.stringify({ processed: processedCount, claimed: claimedCount, scanned: batch.length }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
