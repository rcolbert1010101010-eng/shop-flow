# ShopFlow Beta Onboarding Runbook

## Preconditions
- Supabase project on **Pro** plan with Edge Functions enabled.
- Deployed frontend URL (e.g., Vercel/Netlify/Custom).
- Customer domain decided (for `VITE_AUTH_EMAIL_DOMAIN`).
- Environment files prepared:
  - `.env.<customer>.local` in repo root.
  - Required vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `<CUSTOMER>_SERVICE_ROLE_KEY`, `VITE_AUTH_EMAIL_DOMAIN`.

## Steps: Create Tenant + Owner User
1. **Select env for customer** (copies to `.env.local`):
   - `npm run env:<customer>`
2. **Bootstrap tenant + owner**:
   - `npm run bootstrap:customer <customer>`
   - This ensures: tenant row, owner auth user, `profiles.role='ADMIN'`, `profiles.active_tenant_id`, `tenant_users` membership.
3. **Confirm RPC exists** (for forced password change):
   - Apply migrations if not already deployed.
   - Verify `clear_my_must_change_password()` exists and grants are applied.

## Steps: Invite Additional Users + Force Password Change
1. Create users via Admin UI or admin-create-user function.
2. For each new user, set `profiles.must_change_password = true` (default may already be true for new bootstrap users).
3. Communicate initial password to the user and instruct them to update on first login.

## Verify Access + Smoke Test
1. **Login** as owner user.
2. Confirm **dashboard** loads and tenant name appears.
3. Create a **Customer** record.
4. Create a **Work Order** and/or **Sales Order**.
5. Confirm access to **Settings** (requires `profiles.role='ADMIN'`).

## Emergency Operations
- **Reset password:** Admin reset in Supabase Auth dashboard or via admin-create-user flow.
- **Disable user:** Set `profiles.role='GUEST'` or remove `tenant_users` membership.
- **Clear must_change_password:**
  - `select public.clear_my_must_change_password();` (run as the user)
  - Or admin-side update if needed.

## Record These IDs
- `tenant_id` (from `tenants` table)
- `user_id` (from Auth user record)
- `email` (synthetic auth email)

Store these in the onboarding tracker (internal ops doc) and the customer record in CRM.
