// Intuit OAuth callback (handles code exchange and token storage)
// Env: QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REDIRECT_URI, QUICKBOOKS_STATE_HMAC_SECRET, QUICKBOOKS_TOKEN_ENC_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// TODO: Prevent state replay by persisting nonce and marking consumed (e.g., quickbooks_oauth_states).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { verifyState } from '../_shared/qb_state.ts';
import { encryptToken } from '../_shared/qb_crypto.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stateSecret = Deno.env.get('QUICKBOOKS_STATE_HMAC_SECRET')!;
const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID')!;
const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET')!;
const redirectUri = Deno.env.get('QUICKBOOKS_REDIRECT_URI')!;
const tokenKey = Deno.env.get('QUICKBOOKS_TOKEN_ENC_KEY')!;

const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const successHtml = `
<!doctype html>
<html>
  <body style="font-family: sans-serif; padding: 24px;">
    <h3>QuickBooks connected</h3>
    <p>You can close this window.</p>
  </body>
</html>`;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const realmId = url.searchParams.get('realmId');
    const state = url.searchParams.get('state');
    if (!code || !realmId || !state) return new Response('Missing parameters', { status: 400 });

    const payload = await verifyState(stateSecret, state).catch(() => null);
    if (!payload) return new Response('Invalid state', { status: 400 });
    const tenantId = payload.tenant_id;
    const userId = payload.user_id;
    if (!tenantId || !userId) return new Response('Invalid state payload', { status: 400 });

    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', redirectUri);

    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
    if (!tokenResp.ok) {
      console.error('Token exchange failed', tokenResp.status, tokenResp.headers.get('intuit_tid'));
      return new Response('Token exchange failed', { status: 400 });
    }
    const tokenJson = await tokenResp.json();
    const expiresIn = Number(tokenJson.expires_in || 0);
    const accessEnc = await encryptToken(tokenKey, tokenJson.access_token);
    const refreshEnc = tokenJson.refresh_token ? await encryptToken(tokenKey, tokenJson.refresh_token) : null;

    // TODO: prevent state replay by consuming nonce in quickbooks_oauth_states

    const { error } = await supabase
      .from('quickbooks_connections')
      .upsert(
        {
          tenant_id: tenantId,
          realm_id: realmId,
          status: 'CONNECTED',
          access_token_enc: accessEnc,
          refresh_token_enc: refreshEnc,
          expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
          scope: tokenJson.scope || null,
          company_name: null,
          connected_at: new Date().toISOString(),
          connected_by: userId,
        },
        { onConflict: 'tenant_id' }
      );

    if (error) {
      console.error('QB upsert error', error?.message || error);
      return new Response('Persist failed', { status: 500 });
    }

    return new Response(successHtml, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (err) {
    console.error('qb-oauth-callback error', err?.message || err);
    return new Response('Internal Error', { status: 500 });
  }
});
