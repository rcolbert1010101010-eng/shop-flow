// Intuit OAuth start (returns authorize URL)
// Env: QUICKBOOKS_CLIENT_ID, QUICKBOOKS_REDIRECT_URI, QUICKBOOKS_STATE_HMAC_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createState } from '../_shared/qb_state.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stateSecret = Deno.env.get('QUICKBOOKS_STATE_HMAC_SECRET')!;
const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID')!;
const redirectUri = Deno.env.get('QUICKBOOKS_REDIRECT_URI')!;

const scopes = ['com.intuit.quickbooks.accounting'];
const authBase = 'https://appcenter.intuit.com/connect/oauth2';

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const jwt = authHeader.replace('Bearer ', '');
    const parts = jwt.split('.');
    if (parts.length !== 3) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const userId = payload.sub;
    const tenantId = payload.tenant_id;
    const role = payload.role || payload.app_metadata?.role || payload.user_metadata?.role;
    if (!userId || !tenantId) return new Response('Missing tenant', { status: 400, headers: corsHeaders });
    if (role && role !== 'ADMIN') return new Response('Forbidden', { status: 403, headers: corsHeaders });
    // TODO: enforce ADMIN via DB lookup if role claim is absent

    const state = await createState(stateSecret, tenantId, userId);

    const url = new URL(authBase);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);

    return new Response(JSON.stringify({ url: url.toString() }), {
      status: 200,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('qb-oauth-start error', err?.message || err);
    return new Response('Internal Error', { status: 500, headers: corsHeaders });
  }
});
