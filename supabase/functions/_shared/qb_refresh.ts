// QuickBooks token refresh helper
// Env: QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_TOKEN_ENC_KEY, QUICKBOOKS_ENV
import { decryptToken, encryptToken } from './qb_crypto.ts';

const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID')!;
const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET')!;
const tokenKey = Deno.env.get('QUICKBOOKS_TOKEN_ENC_KEY')!;
const qbEnv = (Deno.env.get('QUICKBOOKS_ENV') || 'sandbox').toLowerCase();

const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

export async function refreshQuickBooksAccessToken(refreshTokenEnc: string) {
  const refreshToken = await decryptToken(tokenKey, refreshTokenEnc);

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
    throw new Error(`Token refresh failed (HTTP ${resp.status})`);
  }

  const json = await resp.json();
  const newAccessEnc = await encryptToken(tokenKey, json.access_token);
  const newRefreshEnc = json.refresh_token ? await encryptToken(tokenKey, json.refresh_token) : refreshTokenEnc;
  const expiresAt = json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString() : null;

  return {
    accessEnc: newAccessEnc,
    refreshEnc: newRefreshEnc,
    expiresAt,
  };
}
