# Admin Scripts

Privileged operations must not use browser to Edge Function calls.
Use local admin CLI scripts now; move privileged flows to backend API routes later.

## create-user.mjs

Creates a user, assigns a tenant membership, and sets a role using the service role key.

Required env:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional env:
- `DEFAULT_TENANT_ID`
- `AUTH_EMAIL_DOMAIN` (falls back to `VITE_AUTH_EMAIL_DOMAIN`)

Examples:

```bash
node tools/admin/create-user.mjs --email user@example.com --tenant 11111111-1111-1111-1111-111111111111 --role TECHNICIAN
```

```bash
node tools/admin/create-user.mjs --username tech1 --tenant 11111111-1111-1111-1111-111111111111 --password "StrongPass123!"
```

```bash
node tools/admin/create-user.mjs --email user@example.com --send-invite --tenant 11111111-1111-1111-1111-111111111111
```
