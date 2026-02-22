// Intuit OAuth callback (handles code exchange and token storage)
// Env: QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REDIRECT_URI, QUICKBOOKS_STATE_HMAC_SECRET, QUICKBOOKS_TOKEN_ENC_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// TODO: Prevent state replay by persisting nonce and marking consumed (e.g., quickbooks_oauth_states).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { verifyState } from '../_shared/qb_state.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stateSecret = Deno.env.get('QUICKBOOKS_STATE_HMAC_SECRET')!;
const clientId = (Deno.env.get('QUICKBOOKS_CLIENT_ID') ?? '').trim();
const clientSecret = (Deno.env.get('QUICKBOOKS_CLIENT_SECRET') ?? '').trim();
const redirectUri = (Deno.env.get('QUICKBOOKS_REDIRECT_URI') ?? '').trim();

const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'GET, OPTIONS',
};

const jsonHeaders = { 'content-type': 'application/json', ...corsHeaders };

const jsonError = (status: number, errorCode: string, message: string) =>
  new Response(JSON.stringify({ error_code: errorCode, message }), { status, headers: jsonHeaders });

const successHtml = `
<!doctype html>
<html>
  <body style="font-family: sans-serif; padding: 24px;">
    <h3>QuickBooks connected</h3>
    <p>You can close this window.</p>
  </body>
</html>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'GET') {
      return jsonError(405, 'method_not_allowed', 'Method not allowed');
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const realmId = url.searchParams.get('realmId')?.trim() ?? '';
    const state = url.searchParams.get('state');
    console.log('qb-oauth-callback', { hasCode: !!code, hasRealm: !!realmId, hasState: !!state });

    if (!realmId) {
      return jsonError(400, 'realm_missing', 'realmId is required');
    }
    if (!code) {
      return jsonError(400, 'code_missing', 'code is required');
    }
    if (!state) {
      return jsonError(400, 'invalid_state', 'state is required');
    }

    const payload = await verifyState(stateSecret, state).catch(() => null);
    if (!payload) return jsonError(400, 'invalid_state', 'state is invalid or expired');
    const tenantId = payload.tenant_id;
    const userId = payload.user_id;
    if (!tenantId || !userId) return jsonError(400, 'invalid_state', 'state is invalid or expired');

    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', redirectUri);
    const basic = btoa(`${clientId}:${clientSecret}`);

    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
    if (!tokenResp.ok) {
      const bodyText = await tokenResp.text();
      console.error('qb token exchange failed', { status: tokenResp.status, body: bodyText.slice(0, 800) });
      return jsonError(400, 'token_exchange_failed', 'Token exchange failed');
    }
    const tokenJson = await tokenResp.json();
    const expiresIn = Number(tokenJson.expires_in || 0);
    const refreshExpiresIn = Number(
      tokenJson.refresh_expires_in || tokenJson.refresh_token_expires_in || tokenJson.x_refresh_token_expires_in || 0
    );
    const scopeRaw = tokenJson.scope;
    const scopeList = Array.isArray(scopeRaw)
      ? scopeRaw.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
      : typeof scopeRaw === 'string'
        ? scopeRaw.split(/\s+/).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        : null;
    const nowIso = new Date().toISOString();

    // TODO: prevent state replay by consuming nonce in quickbooks_oauth_states

    const { error } = await supabase
      .from('integration_connections')
      .upsert(
        {
          tenant_id: tenantId,
          provider: 'quickbooks',
          status: 'CONNECTED',
          display_name: 'QuickBooks',
          external_realm_id: realmId,
          access_token: tokenJson.access_token ?? null,
          refresh_token: tokenJson.refresh_token ?? null,
          access_token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
          refresh_token_expires_at: refreshExpiresIn
            ? new Date(Date.now() + refreshExpiresIn * 1000).toISOString()
            : null,
          scopes: scopeList,
          last_error: null,
          metadata: { realmId },
          updated_at: nowIso,
        },
        { onConflict: 'tenant_id,provider' }
      );

    if (error) {
      console.error('QB upsert error', error?.message || error);
      return jsonError(500, 'persist_failed', 'Persist failed');
    }

    return new Response(successHtml, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', ...corsHeaders },
    });
  } catch (err) {
    console.error('qb-oauth-callback error', err?.message || err);
    return jsonError(500, 'internal_error', 'Internal Error');
  }
});
