# QuickBooks Export Validation Runbook (Widner)

## 1) Scope / What this validates

This runbook validates the full QuickBooks export path for a single tenant (Widner):

- Queueing export jobs through PostgREST RPC using `Authorization: Bearer <ADMIN_JWT>` + `apikey` (required because `auth.uid()` must be present).
- Claiming by sender (`qb-sender`) and transition from `PENDING` to `PROCESSING`.
- Sender failure boundary before OAuth is connected (`QB not connected` is expected).
- Post-OAuth behavior and outcomes (`PROCESSING` -> `SENT`/completed behavior with external IDs).

## 2) Preconditions

Set these for local command-line validation:

```bash
export SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
export SUPABASE_APIKEY="<SUPABASE_ANON_KEY_OR_API_KEY>"
export ADMIN_JWT="<ADMIN_JWT_FOR_WIDNER_TENANT_USER>"
export PROJECT_REF="<PROJECT_REF>"
export TENANT_ID_WIDNER="<WIDNER_TENANT_UUID>"
```

Required context:

- Supabase project ref: `<PROJECT_REF>`
- Function name: `qb-sender`
- Tenant: Widner (`$TENANT_ID_WIDNER`)

Safety:

- Do not paste real JWTs/API keys into tickets, chat, or screenshots.
- Rotate any token immediately if exposed.

## 3) Canonical queue command

Use PostgREST RPC (not direct SQL) so `auth.uid()` is populated.

```bash
curl -sS -X POST "$SUPABASE_URL/rest/v1/rpc/queue_accounting_export_v1" \
  -H "apikey: $SUPABASE_APIKEY" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "quickbooks",
    "export_type": "INVOICE",
    "source_entity_type": "invoice",
    "source_entity_id": "11111111-2222-3333-4444-555555555555",
    "payload_json": {
      "schema_version": 1,
      "provider": "quickbooks",
      "source": {
        "type": "INVOICE",
        "id": "11111111-2222-3333-4444-555555555555",
        "number": "INV-1001",
        "date": "2026-02-17"
      },
      "customer": {
        "shopflow_customer_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "display_name": "Widner Customer"
      },
      "lines": [
        { "kind": "LABOR", "amount": 120.00 },
        { "kind": "PARTS", "amount": 80.00 },
        { "kind": "FEES_SUBLET", "amount": 0.00 }
      ],
      "tax": { "amount": 10.00 },
      "total": 210.00
    },
    "payload_hash": "<sha256_of_payload_json>"
  }'
```

Example success proof artifact (Widner validation record):

```json
{
  "id": "9fa954dc-f764-48ed-8afd-87fdac4528bc",
  "status": "queued"
}
```

Note: the RPC returns a status object; use SQL verification below to confirm/export the exact queued row ID.

## 4) SQL verification queries (Postgres)

### A. Find export by ID

```sql
select
  id,
  status,
  attempt_count,
  last_error,
  tenant_id,
  provider,
  export_type,
  created_at,
  last_attempt_at,
  next_attempt_at
from public.accounting_exports
where id = '9fa954dc-f764-48ed-8afd-87fdac4528bc';
```

### A0. Status rollup for this tenant

```sql
select
  status,
  count(*) as ct,
  max(updated_at) as latest
from public.accounting_exports
where tenant_id = '<WIDNER_TENANT_UUID>'
  and provider = 'quickbooks'
group by status
order by ct desc;
```

### B. Tenant config + claim eligibility signals

```sql
select
  tenant_id,
  provider,
  is_enabled,
  transfer_mode,
  export_trigger,
  mode,
  updated_at
from public.accounting_integration_config
where tenant_id = '<WIDNER_TENANT_UUID>'
  and provider = 'quickbooks';
```

```sql
select
  ae.id,
  ae.status,
  ae.attempt_count,
  ae.next_attempt_at,
  ae.created_at,
  cfg.is_enabled,
  cfg.transfer_mode
from public.accounting_exports ae
join public.accounting_integration_config cfg
  on cfg.tenant_id = ae.tenant_id
 and cfg.provider = ae.provider
where ae.tenant_id = '<WIDNER_TENANT_UUID>'
  and ae.provider = 'quickbooks'
  and ae.status in ('PENDING', 'PROCESSING', 'FAILED', 'SENT')
order by ae.created_at desc
limit 50;
```

Explicit sender-gate eligibility check (expected allowed modes):

```sql
select
  ae.id,
  ae.status,
  cfg.is_enabled,
  coalesce(cfg.transfer_mode, 'IMPORT_ONLY') as transfer_mode_effective,
  (coalesce(cfg.transfer_mode, 'IMPORT_ONLY') in ('LIVE_TRANSFER', 'IMPORT_ONLY')) as transfer_mode_allowed
from public.accounting_exports ae
join public.accounting_integration_config cfg
  on cfg.tenant_id = ae.tenant_id
 and cfg.provider = ae.provider
where ae.tenant_id = '<WIDNER_TENANT_UUID>'
  and ae.provider = 'quickbooks'
  and ae.id = '9fa954dc-f764-48ed-8afd-87fdac4528bc';
```

### C. Claim / processing indicators

If `public.accounting_export_claims` exists:

```sql
select *
from public.accounting_export_claims
where export_id = '9fa954dc-f764-48ed-8afd-87fdac4528bc'
order by created_at desc;
```

If `public.accounting_export_claims` does not exist (this repo may not have it), use `accounting_exports` state transitions:

```sql
select
  id,
  status,
  attempt_count,
  last_attempt_at,
  next_attempt_at,
  last_error,
  updated_at
from public.accounting_exports
where id = '9fa954dc-f764-48ed-8afd-87fdac4528bc';
```

### D. External references for exported entity

NOTE: Prefer validating external IDs via `public.external_references`. Only query external_id/result fields on `public.accounting_exports` if your schema explicitly includes those columns.

If `public.external_references` exists:

```sql
select
  er.tenant_id,
  er.provider,
  er.entity_type,
  er.entity_id,
  er.external_id,
  er.external_key,
  er.status,
  er.last_error,
  er.updated_at
from public.external_references er
join public.accounting_exports ae
  on ae.tenant_id = er.tenant_id
 and ae.source_entity_id = er.entity_id
where ae.id = '9fa954dc-f764-48ed-8afd-87fdac4528bc'
  and er.provider = 'quickbooks';
```

Alternative if external references are not used yet:

```sql
select
  id,
  source_entity_type,
  source_entity_id,
  status,
  last_error
from public.accounting_exports
where id = '9fa954dc-f764-48ed-8afd-87fdac4528bc';
```

## 5) Sender function checkpoints

Where to inspect:

- Supabase Dashboard -> Edge Functions -> `qb-sender` -> Logs
- CLI (if used):

```bash
supabase functions logs qb-sender --project-ref "$PROJECT_REF"
```

Checkpoint meanings:

- Claimed: sender invocation response contains `{"claimed": <n>, ...}` with `<n> > 0`.
- Processing: export row moves to `PROCESSING`; `attempt_count` increments; `last_attempt_at` updates.
- Pre-OAuth expected failure boundary: row ends `FAILED` with `last_error = 'QB not connected'`.
- Post-OAuth expected changes:
  - `quickbooks_connections` has `status='CONNECTED'` and non-null `realm_id`.
  - rows move to `SENT` (or `COMPLETED`) and external IDs/results are recorded in `external_references` (or in `accounting_exports` if those columns exist).

Note: `qb-sender` logs mostly top-level invocation/errors; per-export detail is primarily in `accounting_exports` fields.

## 6) Failure matrix

| Symptom | Likely cause | Fix |
|---|---|---|
| Not claimed in manual mode | Claim function filtered to LIVE_TRANSFER only, or sender code rejected IMPORT_ONLY | Verify `accounting_integration_config.transfer_mode` and ensure claim logic allows `IMPORT_ONLY` + `LIVE_TRANSFER`; deploy latest `qb-sender`. |
| Invalid transfer_mode: X | `accounting_integration_config.transfer_mode` is not `IMPORT_ONLY` or `LIVE_TRANSFER` | Update `transfer_mode` to a valid value. |
| unauthenticated from queue RPC | Missing or invalid `Authorization: Bearer <ADMIN_JWT>` so `auth.uid()` is null, or direct SQL was used | Call PostgREST RPC with `apikey` + `Authorization` header. |
| QB not connected | OAuth not completed (expected pre-OAuth) | Complete OAuth and verify `quickbooks_connections.status='CONNECTED'` and `realm_id` present. |
| Duplicate export suppressed | Unique constraint `(tenant_id, provider, export_type, payload_hash)` treats export as idempotent | Change payload (new intent) or treat as idempotent success and reuse existing export row. |

## 7) Cleanup note

- Remove or convert stub test artifacts such as the known TEST-path record `db3f53a2-...` before release validation sign-off.
- Test-path inserts can come from QuickBooks settings UI "Test Export" behavior and are not production export evidence.
- **Do not ship test artifacts** in production validation packets, screenshots, or ticket evidence.
