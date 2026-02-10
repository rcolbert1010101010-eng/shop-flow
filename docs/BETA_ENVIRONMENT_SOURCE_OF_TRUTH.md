# Beta Environment Source of Truth

## 1) Beta Supabase Project (Source of Truth)

- Current beta project URL (authoritative): `https://ohasmklyvnbxjcecrmlt.supabase.co`
- The Vite frontend reads `.env.local` for client-side settings (anon key) and must point to this URL.
- Service role keys must NEVER go in `.env.local` or any frontend-exposed env file. They are server/admin-only.

## 2) Required Secrets in Codespaces (Server/Admin Only)

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Where they live and why:
- Store these in **Codespaces Secrets**.
- Do not put them in repo files or `.env.local` because the service role key grants full access and must never ship to the client.

## 3) Break-Glass Admin Recovery (Guaranteed)

Run diagnostics:
```bash
node tools/admin/supabase-doctor.mjs
```

Bootstrap or restore the ADMIN user:
```bash
SUPABASE_URL="https://ohasmklyvnbxjcecrmlt.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service_role_key>" \
EMAIL="admin@example.com" \
NEW_PASS="<new_password>" \
TENANT_ID="<tenant_uuid_optional>" \
node tools/admin/bootstrap-admin.mjs
```

Success output should include (JSON summary):
- `user_id`
- `tenant_id`
- `actions_taken` (array)

## 4) Creating Users (Operational Reality)

- The `admin-create-user` edge function requires a **logged-in ADMIN user JWT**. It does **not** accept the service role key.
- If user creation fails:
- Capture the network response from the client request.
- Capture the edge function logs.
- Confirm there is no project URL drift (frontend and server both target the beta URL above).

## 5) Drift Prevention Checklist (Do this before beta handoff)

- Confirm `VITE_SUPABASE_URL` matches the beta project URL.
- Confirm login works for the admin user.
- Confirm the Users page loads and can create a user.
- Confirm no service role key exists in frontend env.
