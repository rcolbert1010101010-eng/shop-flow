# ShopFlow Beta Onboarding Runbook

## Preflight checklist
1. Supabase project is on **Pro** plan (beta requirement).
2. Auth redirect URLs include production + staging domains (Supabase Auth settings).
3. RPC `clear_my_must_change_password()` exists and grants are applied.
4. RLS is enabled on tenant-scoped tables and tenant isolation has been verified.
5. Vercel (or host) env vars are set for the customer (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_DOMAIN`, `<CUSTOMER>_SERVICE_ROLE_KEY`).

## 1) Create tenant + owner
1. Prepare `.env.<customer>.local` with required vars.
2. Run `npm run env:<customer>` to copy into `.env.local`.
3. Run `npm run bootstrap:customer <customer>` to create the tenant and owner user.
4. Confirm in Supabase Dashboard:
   - `tenants` has the new row.
   - `profiles` for the owner has `role = 'ADMIN'`, `active_tenant_id` set, and `must_change_password = true`.
   - `tenant_users` has the owner membership with `role = 'ADMIN'`.

## 2) Invite additional users
1. Admin creates user in Admin UI (or admin-create-user edge function).
2. Ensure `profiles.must_change_password = true` for the new user.
3. User signs in → forced password change → access granted.

## 3) Password recovery
1. Use the Reset Password route (to be implemented next).
2. Ensure Supabase Auth redirect URLs include:
   - Production domain (e.g., `https://app.shopflow.com/*`)
   - Staging domain (e.g., `https://staging.shopflow.com/*`)

## Smoke test
1. Login as owner user.
2. Dashboard loads for the correct tenant.
3. Create a customer.
4. Create a work order **or** sales order.
5. Add at least one line item and save.
6. Log out and log back in.

## Emergency operations
Run these in Supabase SQL Editor (replace `<user_id>` as needed):

- Force must_change_password = true
```sql
update public.profiles
set must_change_password = true
where id = '<user_id>';
```

- Verify must_change_password flag
```sql
select id, must_change_password
from public.profiles
where id = '<user_id>';
```

- Disable a user (current manual step)
```sql
update public.profiles
set role = 'GUEST'
where id = '<user_id>';
```

## Record these IDs
| item | value |
| --- | --- |
| tenant_id | |
| owner_user_id | |
| owner_email | |
| created_at | |
| notes | |
