// QuickBooks query proxy for service scripts
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SHOPFLOW_SERVICE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getQboApiBase } from '../_shared/qb_env.ts';
import { refreshQuickBooksAccessToken } from '../_shared/qb_refresh.ts';

const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim();
const serviceRoleKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
const shopflowServiceKey = (Deno.env.get('SHOPFLOW_SERVICE_KEY') ?? '').trim();

const qbQueryBase = `${getQboApiBase()}/v3/company`;

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-shopflow-service-key, x-shopflow-tenant-id',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });

const queryQuickBooks = async (realmId: string, query: string, accessToken: string) =>
  await fetch(`${qbQueryBase}/${encodeURIComponent(realmId)}/query?query=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return jsonResponse(405, { error: 'method_not_allowed' });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: 'server_misconfigured' });
    }

    // const incomingServiceKey = (req.headers.get('x-shopflow-service-key') ?? '').trim();
    // if (!shopflowServiceKey || !incomingServiceKey || incomingServiceKey !== shopflowServiceKey) {
    //   return jsonResponse(401, { error: 'unauthorized' });
    // }

    const tenantId = (req.headers.get('x-shopflow-tenant-id') ?? '').trim();
    if (!tenantId) {
      return jsonResponse(400, { error: 'tenant_header_required' });
    }

    let body: { query?: string } | null = null;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'invalid_body' });
    }

    const query = String(body?.query ?? '').trim();
    if (!query) {
      return jsonResponse(400, { error: 'query_required' });
    }

    if (!supabase) {
      return jsonResponse(500, { error: 'server_misconfigured' });
    }

    const { data: connection, error: connectionError } = await supabase
      .from('integration_connections')
      .select('tenant_id,external_realm_id,access_token')
      .eq('tenant_id', tenantId)
      .eq('provider', 'quickbooks')
      .maybeSingle();

    if (connectionError) {
      console.error('qb-query connection lookup failed', connectionError);
      return jsonResponse(500, { error: 'connection_lookup_failed' });
    }

    if (!connection) {
      return jsonResponse(400, { error: 'quickbooks_connection_missing' });
    }

    const realmId = String(connection.external_realm_id ?? '').trim();
    if (!realmId) {
      return jsonResponse(400, { error: 'external_realm_id_missing' });
    }

    let accessToken = String(connection.access_token ?? '').trim();
    if (!accessToken) {
      return jsonResponse(400, { error: 'access_token_missing' });
    }

    let qbResp = await queryQuickBooks(realmId, query, accessToken);
    if (qbResp.status === 401) {
      try {
        const refreshed = await refreshQuickBooksAccessToken(supabase, tenantId);
        accessToken = refreshed.accessToken;
        qbResp = await queryQuickBooks(realmId, query, accessToken);
      } catch (refreshErr) {
        console.error('qb-query refresh failed', refreshErr);
      }
    }

    const responseText = await qbResp.text();
    try {
      const responseJson = JSON.parse(responseText);
      return jsonResponse(qbResp.status, responseJson);
    } catch {
      return jsonResponse(qbResp.status, { error: 'qbo_non_json_response', body: responseText });
    }
  } catch (err) {
    console.error('qb-query unhandled error', err);
    return jsonResponse(500, { error: 'internal_error' });
  }
});
