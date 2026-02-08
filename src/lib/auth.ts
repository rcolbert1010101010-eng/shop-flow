export function normalizeAuthUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

export function toAuthEmailFromUsername(username: string): string {
  const domain = (import.meta.env.VITE_AUTH_EMAIL_DOMAIN ?? '').trim();
  if (!domain) {
    throw new Error('Missing VITE_AUTH_EMAIL_DOMAIN');
  }
  const normalizedUsername = normalizeAuthUsername(username);
  return `${normalizedUsername}@${domain}`;
}
