// Token encryption helpers for QuickBooks tokens (AES-256-GCM)
// Env: QUICKBOOKS_TOKEN_ENC_KEY
const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function parseKey(secret: string) {
  // Accept base64url/base64 or hex; fallback to utf-8
  try {
    const b = atob(secret.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
  } catch {
    // not base64
  }
  if (/^[0-9a-fA-F]+$/.test(secret) && secret.length % 2 === 0) {
    return Uint8Array.from(secret.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  }
  return enc.encode(secret);
}

async function importKey(secret: string) {
  const raw = parseKey(secret);
  if (raw.length < 32) throw new Error('token key too short');
  return crypto.subtle.importKey('raw', raw.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt']);
}

export async function encryptToken(secret: string, token: string) {
  const key = await importKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token));
  const bytes = new Uint8Array(cipherBuf);
  const tagLen = 16;
  const cipher = bytes.slice(0, bytes.length - tagLen);
  const tag = bytes.slice(bytes.length - tagLen);
  return `${b64url(iv)}.${b64url(cipher)}.${b64url(tag)}`;
}
