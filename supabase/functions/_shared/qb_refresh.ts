// QuickBooks token refresh helper
// Env: QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_ENV

const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID')!;
const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET')!;

const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

export async function refreshQuickBooksAccessToken(supabase: any, tenantId: string) {
  const { data: conn, error: connErr } = await supabase
    .from('integration_connections')
    .select('refresh_token')
    .eq('tenant_id', tenantId)
    .eq('provider', 'quickbooks')
    .maybeSingle();
  if (connErr) throw new Error(connErr.message || 'Failed to load integration connection');
  if (!conn?.refresh_token) throw new Error('Refresh token missing');
  const refreshToken = conn.refresh_token as string;

  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);

  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (!resp.ok) {
    const tid = resp.headers.get('intuit_tid');
    if (tid) console.error('QB refresh failed', resp.status, tid);
    await supabase
      .from('integration_connections')
      .update({
        last_error: `Token refresh failed (HTTP ${resp.status})`,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('provider', 'quickbooks');
    throw new Error(`Token refresh failed (HTTP ${resp.status})`);
  }

  const json = await resp.json();
  const accessToken = json.access_token as string;
  const rotatedRefreshToken = json.refresh_token ? String(json.refresh_token) : refreshToken;
  const expiresAt = json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString() : null;
  const refreshExpiresIn = Number(
    json.refresh_expires_in || json.refresh_token_expires_in || json.x_refresh_token_expires_in || 0
  );
  const refreshExpiresAt = refreshExpiresIn
    ? new Date(Date.now() + refreshExpiresIn * 1000).toISOString()
    : null;
  const scopeRaw = json.scope;
  const scopeList = Array.isArray(scopeRaw)
    ? scopeRaw.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
    : typeof scopeRaw === 'string'
      ? scopeRaw.split(/\s+/).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      : null;

  const { error: updateErr } = await supabase
    .from('integration_connections')
    .update({
      access_token: accessToken,
      refresh_token: rotatedRefreshToken,
      access_token_expires_at: expiresAt,
      refresh_token_expires_at: refreshExpiresAt,
      scopes: scopeList,
      status: 'CONNECTED',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('provider', 'quickbooks');
  if (updateErr) throw new Error(updateErr.message || 'Failed to persist refreshed token');

  return {
    accessToken,
    expiresAt,
  };
}
