# QuickBooks Sender Ops (Phase 2A)

This document covers **operational setup** for the Phase 2A live QuickBooks invoice sender.

## What runs “live”
ShopFlow never posts directly from the UI to QuickBooks.

Instead:
- UI + triggers enqueue rows into `public.accounting_exports`
- `qb-sender` consumes the queue and posts to QuickBooks
- All outcomes are written back to the export row (auditable + retryable)

---

## Required environment variables

### OAuth + tokens
- `QUICKBOOKS_CLIENT_ID`
- `QUICKBOOKS_CLIENT_SECRET`
- `QUICKBOOKS_REDIRECT_URI`
- `QUICKBOOKS_STATE_HMAC_SECRET` (HMAC signing for OAuth state)
- `QUICKBOOKS_TOKEN_ENC_KEY` (AES-GCM key for encrypting tokens at rest)
- `QUICKBOOKS_ENV` = `sandbox` or `production`

### Supabase / service
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Cron runner (recommended)
- `SHOPFLOW_CRON_SECRET` (shared secret required by `qb-sender-cron` via header `x-shopflow-cron-secret`)

---

## Functions involved
- `qb-oauth-start` — returns Intuit authorize URL (ADMIN only)
- `qb-oauth-callback` — exchanges code → tokens, encrypts, stores in `quickbooks_connections`
- `qb-sender` — consumes `accounting_exports` for `provider=quickbooks`, `export_type=INVOICE`
- `qb-sender-cron` — secure wrapper intended for scheduled invocation; calls `qb-sender` with service role

---

## Deploy functions

Deploy (example):
- `supabase functions deploy qb-oauth-start`
- `supabase functions deploy qb-oauth-callback`
- `supabase functions deploy qb-sender`
- `supabase functions deploy qb-sender-cron`

Also ensure the function secrets/env vars above are set in Supabase.

---

## Scheduling (recommended)

Set up a scheduled trigger to call `qb-sender-cron` every **2 minutes** (start conservative).
Your scheduler must:
- `POST` to `/functions/v1/qb-sender-cron`
- Include header: `x-shopflow-cron-secret: <SHOPFLOW_CRON_SECRET>`

If your scheduler cannot add custom headers, do not expose `qb-sender-cron` publicly; use an alternative scheduler that supports headers.

---

## Manual run (ADMIN)

In ShopFlow:
- Settings → Accounting → QuickBooks
- Click **Run Sender Now**
- A toast shows: processed / claimed / scanned counts from `qb-sender`.

---

## Troubleshooting

### 1) Exports stuck in PENDING
Check:
- `quickbooks_connections.status` is `CONNECTED`
- `quickbooks_connections.expires_at` is valid (sender auto-refreshes when near expiry)
- `accounting_exports.next_attempt_at` (leases/backoff can delay retries)

### 2) FAILED exports
Look at:
- `accounting_exports.last_error`
- `accounting_exports.attempt_count`
- `accounting_exports.provider_meta_json` (QB fault/status where available)

Common causes:
- Not connected to QuickBooks
- Customer mapping missing (payload mapping not implemented for that case)
- QuickBooks validation errors (Line items, accounts, tax settings)

### 3) Verifying what was sent
For invoices:
- `accounting_exports.remote_id` should contain the QuickBooks Invoice Id (when returned)
- `status = SENT` indicates sender posted successfully

---

## Notes / next phases
- Phase 2B adds **payments**.
- Phase 2C adds **credits/voids/refunds**.
- Phase 2D adds **webhooks + reconciliation**.
