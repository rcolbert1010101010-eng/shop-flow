// qb-qry-invoice: query QuickBooks for invoices by DocNumber
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, QUICKBOOKS_ENVIRONMENT
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getQboApiBase } from '../_shared/qb_env.ts';
import { refreshQuickBooksAccessToken } from '../_shared/qb_refresh.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const qbApiBase = getQboApiBase();

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  const tenantId = body?.tenant_id as string | undefined;
  const docNumber = body?.doc_number as string | undefined;

  if (!tenantId || !docNumber) {
    return new Response(JSON.stringify({ error: 'tenant_id and doc_number are required' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  // Load QB connection
  const { data: conn, error: connErr } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'quickbooks')
    .in('status', ['CONNECTED', 'ACTIVE'])
    .maybeSingle();

  if (connErr || !conn) {
    return new Response(JSON.stringify({ error: 'QB not connected' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  if (!conn.external_realm_id) {
    return new Response(JSON.stringify({ error: 'QB realm missing' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  // Ensure access token is fresh
  let accessToken: string;
  try {
    const expiresAt = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : null;
    const needsRefresh = expiresAt !== null && expiresAt - Date.now() <= 2 * 60 * 1000;
    if (needsRefresh) {
      const refreshed = await refreshQuickBooksAccessToken(supabase, tenantId);
      accessToken = refreshed.accessToken;
    } else {
      if (!conn.access_token) throw new Error('Access token missing');
      accessToken = conn.access_token as string;
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Token error' }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  // Query QB
  const escaped = docNumber.replace(/'/g, "\\'");
  const query = encodeURIComponent(`SELECT * FROM Invoice WHERE DocNumber = '${escaped}'`);
  const url = `${qbApiBase}/v3/company/${conn.external_realm_id}/query?query=${query}&minorversion=73`;

  let qbResp: Response;
  try {
    qbResp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `QB fetch failed: ${err?.message}` }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  if (!qbResp.ok) {
    return new Response(JSON.stringify({ error: `QB error ${qbResp.status}` }), {
      status: 502,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  const qbJson = await qbResp.json();
  const rawInvoices = qbJson?.QueryResponse?.Invoice ?? [];
  const invoices = rawInvoices.map((inv: any) => ({
    Id: inv.Id,
    DocNumber: inv.DocNumber,
    TxnDate: inv.TxnDate,
    TotalAmt: inv.TotalAmt,
  }));

  return new Response(JSON.stringify({ count: invoices.length, invoices }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });
});
