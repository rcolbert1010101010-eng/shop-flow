# ShopFlow Admin Commands Runbook

This runbook is for beta onboarding and admin operations without browser Edge Function calls.

## Preconditions

Set these environment variables before running admin CLI commands:

- `SUPABASE_URL` (ShopFlow Supabase project URL)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only secret; never expose to frontend)
- `AUTH_EMAIL_DOMAIN` (required for `--username` mode; supports ShopFlow username email synthesis)
- `DEFAULT_TENANT_ID` (optional; if omitted, pass `--tenant` per command)

Example:

```bash
export SUPABASE_URL="https://<shopflow-project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<shopflow-service-role-key>"
export AUTH_EMAIL_DOMAIN="shopflow.local"
# export DEFAULT_TENANT_ID="<shopflow-tenant-uuid>"  # optional
```

## Create User (Invite by Email)

```bash
node tools/admin/create-user.mjs \
  --email "tech1@shopflow.local" \
  --tenant "<shopflow-tenant-uuid>" \
  --role "TECHNICIAN" \
  --send-invite
```

## Create User (Username Mode)

```bash
AUTH_EMAIL_DOMAIN="shopflow.local" node tools/admin/create-user.mjs \
  --username "shopflow.tech1" \
  --tenant "<shopflow-tenant-uuid>" \
  --role "TECHNICIAN" \
  --send-invite
```

## Get Tenant UUID

Run in Supabase SQL editor:

```sql
select id, name
from public.tenants
order by created_at desc;
```

## Force Password Change

Run in Supabase SQL editor:

```sql
update public.profiles
set must_change_password = true
where id = '<shopflow-user-uuid>';
```

## Attach User to Tenant

Current ShopFlow tenant linkage tables are `public.tenant_users` and `public.profiles.active_tenant_id`.

Run in Supabase SQL editor:

```sql
insert into public.tenant_users (tenant_id, user_id)
values ('<shopflow-tenant-uuid>', '<shopflow-user-uuid>')
on conflict (tenant_id, user_id) do nothing;
```

```sql
update public.profiles
set active_tenant_id = '<shopflow-tenant-uuid>'
where id = '<shopflow-user-uuid>';
```

Tip: resolve user UUID from email when needed:

```sql
select id, email
from auth.users
where lower(email) = lower('tech1@shopflow.local');
```

## Assign Role (roles.key -> user_roles.role_id)

Do not use legacy freeform role strings. Use `public.roles.key` and map to `public.user_roles.role_id`.

Run in Supabase SQL editor:

```sql
insert into public.user_roles (user_id, role_id)
select
  '<shopflow-user-uuid>'::uuid,
  r.id
from public.roles r
where r.key = lower('TECHNICIAN')
on conflict (user_id)
do update set role_id = excluded.role_id;
```

Verify assigned role:

```sql
select ur.user_id, r.key as role_key
from public.user_roles ur
join public.roles r on r.id = ur.role_id
where ur.user_id = '<shopflow-user-uuid>'::uuid;
```

## Safety Notes

- Never place `SUPABASE_SERVICE_ROLE_KEY` in frontend code, browser storage, or client bundles.
- Never call `/functions/v1/*` from browser code for privileged ShopFlow operations.
- Run privileged workflows from server-side code or local admin CLI scripts only.
