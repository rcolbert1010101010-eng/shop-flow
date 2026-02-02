# ShopFlow Ops — Provisioning & Recovery (v1)

This document defines the repeatable operational process to provision, update, and recover a single-tenant hosted ShopFlow customer.

## Model (Locked)
- **Single-tenant hosted:** one Supabase project per customer.
- **DB provisioning uses:**
  1) `supabase/sql/customer_bootstrap.sql` (authoritative schema bootstrap)
  2) `supabase/migrations/*` (incremental changes after baseline)

## 1) New Customer Provisioning (Supabase Project)
### 1.1 Create project
- Create a new Supabase project (name: `ShopFlow - <CustomerName>`).
- Record:
  - Project ref
  - Region
  - DB password (store in password manager)
  - API URL + anon key + service role key (store securely)

### 1.2 Apply DB bootstrap (schema)
Goal: make a brand-new project match the current “known-good” schema baseline.

Use pg client tooling with **Transaction pooler** connection info (Connect → Transaction pooler) and run:

- Apply `supabase/sql/customer_bootstrap.sql` once to the new project's database.
  - Must be executed as a role with permission to create objects in required schemas.

### 1.3 Apply migrations
Apply all repo migrations after the baseline to bring the new project up to current app expectations.

- Apply `supabase/migrations/` in timestamp order.
- Confirm no errors.

### 1.4 Create first admin user + tenant setup
- Create initial admin user in Supabase Auth.
- Sign in through the app, confirm:
  - profile created
  - tenant created/selected correctly
  - role = admin/owner as intended

### 1.5 Smoke test (minimum)
- Login/logout
- Create customer
- Create unit
- Create part
- Create sales order line and total
- Create work order line and total
- Create PO + receive line
- Generate invoice + record payment
- Confirm dashboard loads
- Confirm docs/help drawer opens

## 2) Updates / Releases (Single Tenant)
Order matters:
1) Apply DB migrations
2) Deploy frontend
3) Run smoke test
4) Monitor error logs

Rollback principle:
- Roll back frontend first.
- DB rollbacks are avoided; prefer forward-fix migrations.

## 3) Backup & Restore (Proof Required)
### 3.1 Backups
- Confirm daily automated backups are enabled in Supabase for each customer project.

### 3.2 Restore test (Proof)
For each customer, perform at least one restore test:
- Restore the customer DB backup into a separate staging project.
- Run smoke test against restored DB (read-only verification is acceptable).
- Record:
  - date/time
  - backup used
  - restore target
  - results

## 4) Support Boundaries (Ops)
Included:
- Bug fixes
- Onboarding/training for standard workflow

Not included (billable):
- Complex data cleanup
- Custom imports beyond agreed templates
- Custom reports/features during beta

