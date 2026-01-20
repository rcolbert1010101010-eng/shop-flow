# QuickBooks Integration Roadmap (Phased, Outbox-First)

This plan builds on the existing offline export queue (accounting_exports as the single source of truth). Each phase is production-safe, additive, and keeps accounting intact even if QuickBooks is unavailable.

## Phase 2 – Connect & Identity (OAuth + Company Mapping)
- **Goal:** Establish a secure connection and map the QuickBooks company without changing export behavior.
- **What gets built:** OAuth connect flow, token storage (encrypted), company realm metadata, provider status updates. UI: Connect/Disconnect, show company name/realm, manual “Send” disabled for now.
- **Events generating exports:** None new. Outbox remains local only.
- **QuickBooks objects touched:** None (no API sends yet).
- **Failure/retry:** N/A; token refresh lifecycle only. Handle token refresh failures with clear status and admin alerts.
- **Audit trail:** Log connect/disconnect, token refresh attempts, realm metadata, and admin actions.
- **Acceptance tests:** Connect flow succeeds; token stored encrypted; disconnect clears tokens; realm info displays; no accounting_exports mutations.
- **Safe to ship:** Outbox untouched; connection errors do not block existing app flows; tokens are encrypted and non-exposed.

## Phase 3 – Sender Worker (Near-Real-Time Outbox Delivery)
- **Goal:** Post queued exports from accounting_exports to QuickBooks reliably.
- **What gets built:** Background sender job/worker (server-side) that reads accounting_exports where status=PENDING, posts to QuickBooks, updates status/attempt_count/last_error/external_id. Manual “Send now” button for admins; per-provider “Auto send” toggle.
- **Events generating exports:** Existing triggers (invoice issued, payment recorded, voids when supported) continue to enqueue; worker picks them up.
- **QuickBooks objects:** INVOICE (QBO Invoice), PAYMENT (QBO Payment to an invoice), CUSTOMER (optional pre-flight if missing), ITEM/SERVICE stubs (optional minimal).
- **Failure/retry:** Exponential backoff; cap attempts; status FAILED with last_error; manual retry sets PENDING; idempotency keys derived from payload_hash to avoid duplicates; store external_id on success.
- **Audit trail:** Sender runs, requests/responses (sanitized), status transitions, retries, external_id, timestamps, actor for manual sends.
- **Acceptance tests:** Pending rows transition to SUCCESS with external_id; duplicate sends avoided; FAILED rows record last_error; manual “Send now” works and respects toggles; auto-send toggle off prevents posting.
- **Safe to ship:** Worker can be disabled; sends only when toggle is on; no mutation of source accounting data.

## Phase 4 – Expand Export Types (Payments/Credits/Voids/Refunds)
- **Goal:** Cover end-to-end financial events beyond invoices.
- **What gets built:** Payloads + sender support for PAYMENT, CREDIT_MEMO/REFUND, VOID handling (inverse entries), optional WRITE_OFF/ADJUSTMENT exports. Mapping UI for refund/credit items and clearing accounts. Reconciliation helpers: match payments to invoices, refunds to payments/credits.
- **Events generating exports:** Payment recorded, credit/refund issued, invoice voided (send void reversal/close), adjustments/write-offs applied.
- **QuickBooks objects:** Payment, CreditMemo or RefundReceipt, void adjustments (could be CreditMemo or zeroing JournalEntry), optional JournalEntry for write-offs, Deposits/Undeposited funds moves.
- **Failure/retry:** Same sender backoff; specific idempotency keys per export_type; avoid duplicate Payment/CreditMemo by using payload_hash and external_id. Detect “already exists” responses and mark SUCCESS with external_id.
- **Audit trail:** Per export_type attempts, linking back to source entity; reconciliation of payment->invoice; void/adjustment metadata.
- **Acceptance tests:** Payment export links to invoice; credit/refund reduces balance; void cancels prior invoice export or posts offset; retries cleanly handle duplicates.
- **Safe to ship:** Feature flags per export_type; sender can skip types safely; no changes to local accounting totals.

## Phase 4.1 – Deposits & Undeposited Funds
- **Goal:** Handle cash movement to bank/undeposited funds.
- **What gets built:** Config for clearing/undeposited funds accounts (already partly present); exports for Deposit creation when payments batched; mapping from payment method to deposit grouping optional.
- **Events generating exports:** Deposit batch creation (manual trigger), or daily job that rolls up undeposited funds.
- **QuickBooks objects:** Deposit records referencing payments; updates to Undeposited Funds account.
- **Failure/retry:** Same sender model; idempotent per batch/date + payload_hash.
- **Audit trail:** Deposit batches, payments included, external_id, amount.
- **Acceptance tests:** Deposit created with linked payments; duplicate prevention; failed deposit logs error.
- **Safe to ship:** Deposits feature-flagged; sender can skip deposit exports.

## Phase 4.2 – Customer Sync Strategy
- **Goal:** Ensure customers exist before invoices/payments post.
- **What gets built:** Customer match strategies (display name, phone, external ref); optional preflight Customer export; external_references table usage; config for auto-create vs require match.
- **Events generating exports:** Before INVOICE/PAYMENT send, ensure customer exists (create if allowed).
- **QuickBooks objects:** Customer.
- **Failure/retry:** Retry customer creation/match; idempotency via external_references; handle “name taken” with fallbacks.
- **Audit trail:** Customer matches/creates with external_id and strategy used.
- **Acceptance tests:** Invoice send auto-creates/matches customer; duplicate prevention; failures logged and surfaced.
- **Safe to ship:** Customer auto-create toggle; fallback to skip export if customer sync fails.

## Phase 4.3 – Items/Services Mapping Strategy
- **Goal:** Map lines to QBO Items/Services for detail exports.
- **What gets built:** Config for item/service defaults per category (labor, parts, fees, tax, clearing); optional item pre-create; line-item strategy (ROLLUP vs DETAILED) already present—extend to QBO item refs.
- **Events generating exports:** Invoice send (detailed mode).
- **QuickBooks objects:** Item/Service (optional creation), Invoice lines referencing them.
- **Failure/retry:** Idempotent item creation with external_references; retries on item creation before invoice send.
- **Audit trail:** Item mappings and creations, external_id, strategy used.
- **Acceptance tests:** Detailed invoice posts with item refs; rollup still works; duplicates avoided.
- **Safe to ship:** Detailed mode feature-flag; rollup default unchanged.

## Phase 4.4 – Taxes
- **Goal:** Align tax handling with QBO tax codes/accounts.
- **What gets built:** Config for tax liability account and optional tax codes; payload mapping to QBO tax lines; validation to prevent mismatched tax modes.
- **Events generating exports:** Invoice send with tax_amount > 0; credit/void with tax impact.
- **QuickBooks objects:** Invoice tax lines or JournalEntry adjustments; potentially TaxCode references if configured.
- **Failure/retry:** Same sender with idempotency; surface tax code mismatch errors.
- **Audit trail:** Tax mapping used, amounts, external_id.
- **Acceptance tests:** Taxed invoice posts with correct liability ref; retries handle mismatches; rollbacks when voided.
- **Safe to ship:** Tax mapping optional; defaults to liability account only if codes not configured.

## Manual vs Auto Send
- **Manual send button:** On each export row (or detail) to set status=PENDING and force sender to pick it up immediately.
- **Auto send toggle per provider:** When off, sender skips posting but still allows manual send. When on, sender posts pending exports.

## Idempotency & Remote IDs
- Use payload_hash as idempotency key; on success store external_id, external_key (if any) in accounting_exports and/or external_references.
- On duplicate/“already exists” responses, set SUCCESS and capture external_id to avoid re-posting.

## Operational Dashboards
- Status views: pending/queued, sent, failed, skipped by reason, duplicates detected.
- Drilldown: last_error, attempt_count, external_id, payload preview, retry button.
- Metrics: time-to-send, failure rate per type, auto-send toggle state.

## Minimal Acceptance Tests (per phase)
- Token stored encrypted; disconnect removes tokens.
- Sender picks up pending exports when auto-send on; respects off toggle.
- Invoice export posts once, no duplicates after retry.
- Payment export posts only when mode allows and trigger set; skipped when disabled.
- Retry sets status to PENDING and attempts increment.

## Safe-to-Ship Criteria (per phase)
- Feature flags/toggles isolate new sends.
- accounting_exports remains authoritative and unchanged by remote failures.
- Errors surface in UI (Recent Exports, dashboards) and do not block core app flows.
- Idempotency and external_id storage prevent duplicate QuickBooks objects.
