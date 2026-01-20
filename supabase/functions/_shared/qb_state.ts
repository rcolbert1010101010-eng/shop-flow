// Signed state for QuickBooks OAuth
// Env: QUICKBOOKS_STATE_HMAC_SECRET
const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlDecode = (str: string) => {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '=');
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function hmac(secret: string, data: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return new Uint8Array(sig);
}

export async function createState(secret: string, tenantId: string, userId: string) {
  const payload = {
    tenant_id: tenantId,
    user_id: userId,
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + 600,
  };
  const payloadBytes = enc.encode(JSON.stringify(payload));
  const sig = await hmac(secret, payloadBytes);
  return `${b64url(payloadBytes)}.${b64url(sig)}`;
}

export async function verifyState(secret: string, token: string) {
  const [payloadPart, sigPart] = token.split('.');
  if (!payloadPart || !sigPart) throw new Error('invalid_state');
  const payloadBytes = b64urlDecode(payloadPart);
  const expectedSig = b64urlDecode(sigPart);
  const actualSig = await hmac(secret, payloadBytes);
  if (expectedSig.length !== actualSig.length || expectedSig.some((b, i) => b !== actualSig[i])) {
    throw new Error('invalid_signature');
  }
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  if (!payload.exp || Date.now() / 1000 > Number(payload.exp)) throw new Error('state_expired');
  return payload;
}
