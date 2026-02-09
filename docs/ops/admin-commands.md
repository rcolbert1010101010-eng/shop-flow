# ShopFlow Admin Commands Runbook

This runbook covers beta onboarding and admin operations without browser Edge Function calls.

## Preconditions

Set these environment variables before running admin commands:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_EMAIL_DOMAIN`
- `DEFAULT_TENANT_ID` (optional)

Example:

```bash
export SUPABASE_URL="https://<shopflow-project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
export AUTH_EMAIL_DOMAIN="shopflow.local"
# export DEFAULT_TENANT_ID="<tenant-uuid>"  # optional
```

## Server Env Setup

For server-side admin endpoints (`/api/v1/admin/*`), create server env values:

```bash
cp server/.env.example server/.env
```

Set at least:

- `SHOPFLOW_ADMIN_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Run the server from `server/`:

```bash
cd server
npm run dev
```

## Server Invite Endpoint (Idempotent)

Valid `role_key` values:

- `ADMIN`
- `MANAGER`
- `SERVICE_WRITER`
- `TECHNICIAN`

Call invite endpoint:

```bash
curl -i -X POST "http://localhost:4000/api/v1/admin/users/invite" \
  -H "Content-Type: application/json" \
  -H "x-shopflow-admin-key: ${SHOPFLOW_ADMIN_API_KEY}" \
  -H "X-Tenant-Id: <tenant-uuid>" \
  --data '{"email":"tech1@shopflow.local","role_key":"TECHNICIAN","full_name":"ShopFlow Tech 1"}'
```

Idempotency check: run the same command a second time for the same email.

## Create User (Invite)

```bash
node tools/admin/create-user.mjs \
  --email "tech1@shopflow.local" \
  --tenant "<tenant-uuid>" \
  --role "TECHNICIAN" \
  --send-invite
```

## Create User (Username Mode)

```bash
AUTH_EMAIL_DOMAIN="shopflow.local" node tools/admin/create-user.mjs \
  --username "shopflow.tech1" \
  --tenant "<tenant-uuid>" \
  --role "TECHNICIAN" \
  --send-invite
```

## Get Tenant UUID

```sql
select id, name
from public.tenants
order by created_at desc;
```

## Force Password Change

```sql
update public.profiles
set must_change_password = true
where id = '<user-uuid>'::uuid;
```

## Attach User To Tenant

Insert tenant membership:

```sql
insert into public.tenant_users (tenant_id, user_id)
values ('<tenant-uuid>'::uuid, '<user-uuid>'::uuid)
on conflict (tenant_id, user_id) do nothing;
```

Set active tenant:

```sql
update public.profiles
set active_tenant_id = '<tenant-uuid>'::uuid
where id = '<user-uuid>'::uuid;
```

## Assign Role (roles.key -> user_roles.role_id)

Do not use legacy role strings. Assign role through `roles.key` mapped to `user_roles.role_id`.

```sql
insert into public.user_roles (user_id, role_id)
select
  '<user-uuid>'::uuid,
  r.id
from public.roles r
where r.key = 'TECHNICIAN'
on conflict (user_id)
do update set role_id = excluded.role_id;
```

Verify role:

```sql
select ur.user_id, r.key as role_key
from public.user_roles ur
join public.roles r on r.id = ur.role_id
where ur.user_id = '<user-uuid>'::uuid;
```

## Safety Notes

- Never put `SUPABASE_SERVICE_ROLE_KEY` in frontend code or browser-exposed config.
- Never call `/functions/v1/*` from browser code for privileged operations.
- Run privileged flows from local admin CLI now; migrate to backend API endpoints later.
