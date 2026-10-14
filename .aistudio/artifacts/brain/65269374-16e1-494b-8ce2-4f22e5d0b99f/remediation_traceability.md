# AGILA Hub Android — Phase 00 Remediation Traceability Matrix (Revision 3.10)
**Document:** Final Phase 00 Remediation Traceability (`remediation_traceability.md`)  
**Status:** Implementation-Ready Planning Traceability (Awaiting Stakeholder Approval)  
**Scope:** Reconciled against Migrations 001 through 009, Preflight Checks, and Operational Procedures

---

## 1. Traceability Register: Targeted Remediation Findings

### 1. Audit Privacy & Expense Payload Integrity
*   **Defect & Impact:** 
    1. Previous revision fell back to copying raw payloads minus token/phone when a table was not recognized, risking exposure of storage paths, emails, and private data.
    2. In `expenses` audit logging, `v_safe_new` erroneously read `category` from `v_raw_old->'category'` instead of `v_raw_new->'category'`, causing `new_data.category` to evaluate to `NULL` on INSERTs and retain stale categories on UPDATEs.
*   **Source Location:** `supabase/migrations/20261013000008_audit_logs_and_triggers.sql` (in `public.process_audit_log_capture()`)
*   **Corrected SQL & Control:**
    - Corrected `expenses` audit mapping: `v_safe_new := jsonb_build_object(..., 'category', v_raw_new->'category', ...)`.
    - Replaced generic fallback with strict per-table allowlists for all 8 audited tables (`members`, `eagles_id_cards`, `member_invitations`, `contributions`, `expenses`, `announcements`, `attendance_events`, `attendance_records`).
    - The unmapped fallback branch strictly records `jsonb_build_object('id', v_record_id)` with zero raw payload fields.
    - Added `actor_type` column (`VARCHAR(50) NOT NULL DEFAULT 'authenticated_member'`) distinguishing `'authenticated_member'`, `'service_role'`, and `'system'`. Actor attribution is derived strictly from server context (`auth.uid()`), ignoring any client payload.
*   **Acceptance Tests:**
    - *Positive Test 1 (Allowlisted Field Capture):* Member updates nickname. Expected: audit row created with `actor_type = 'authenticated_member'`; `new_data` contains only allowlisted keys (`id`, `nickname`, `role`, `status`, `club_chapter`, `updated_at`).
    - *Positive Test 2 (Service-Role Attribution):* Backend worker executes mutation via service role. Expected: audit row created with `actor_type = 'service_role'` and `actor_id IS NULL`.
    - *Positive Test 3 (Expense Category Regression Test):* Financial officer inserts expense (`category = 'venue_rental'`). Expected: audit row created with `new_data->>'category' = 'venue_rental'` (non-null) and `old_data IS NULL`. When updated to `'equipment_rental'`, verify `old_data->>'category' = 'venue_rental'` and `new_data->>'category' = 'equipment_rental'`.
    - *Negative Test 1 (Storage Path Exclusion):* Member uploads Eagles ID card. Expected: audit log captures status change; `front_storage_path` and `back_storage_path` are completely excluded from `new_data`.
    - *Negative Test 2 (Token Hash Exclusion):* Admin generates invitation. Expected: audit log captures invitation creation; `token_hash` is completely excluded from `new_data`.
*   **Execution Status:** Specification and SQL DDL verified. Runtime execution: **NOT EXECUTED (SPECIFIED FOR AUDIT RELEASE GATE)**.

---

### 2. Preflight Completeness: Type-Aligned & Uniqueness-Verified Schema Assertions
*   **Defect & Impact:**
    1. Previous preflight script checked `audit_logs.actor_type` as `data_type = 'text'`, which fails on PostgreSQL databases created from Migration 008 declaring `actor_type VARCHAR(50)` (`data_type = 'character varying'`).
    2. Index assertions checked expressions by text search without validating index uniqueness on `idx_members_email_lower` or verifying that `idx_constitution_embedding_hnsw` specifically belongs to `public.constitution_sections`, uses the HNSW access method, and indexes the `embedding` column with `vector_cosine_ops`.
*   **Source Location:** Section 8.1 of `implementation_plan.md` and `scripts/preflight_schema_check.sql`
*   **Corrected SQL & Control:**
    - Aligned `audit_logs.actor_type` check with Migration 008 definition: asserts `data_type = 'character varying'` and `character_maximum_length = 50`.
    - Hardened index assertions to validate security- and integrity-relevant properties:
      - `idx_members_email_lower`: joins `pg_index` to assert `indisunique = TRUE` in addition to `indexdef ILIKE '%lower(%email%)%'`.
      - `uq_reference_payment`: asserts unique constraint in `pg_constraint (contype = 'u')` and unique index in `pg_index (indisunique = TRUE)` covering `(payment_channel, reference_number)`.
      - `idx_constitution_embedding_hnsw`: asserts index on `public.constitution_sections`, HNSW method (`indexdef ILIKE '%hnsw%'`), and explicit indexing of the `embedding` column with `vector_cosine_ops` (`indexdef ILIKE '%(embedding%vector_cosine_ops)%'`).
    - Validates complete baseline:
      - **3 Required Extensions:** `uuid-ossp`, `pgcrypto`, `vector`.
      - **All 10 Core Baseline Tables:** `members`, `member_invitations`, `eagles_id_cards`, `announcements`, `attendance_events`, `attendance_records`, `contributions`, `expenses`, `constitution_sections`, `audit_logs`.
      - **Critical Columns & Types:** `members.auth_user_id (uuid)`, `contributions.closed_by (uuid)`, `expenses.reversed_by (uuid)`, `audit_logs.actor_type (varchar(50))`, `constitution_sections.embedding`.
      - **6 Critical Integrity Triggers:** `trg_validate_expense_mutation`, `trg_protect_payment_transitions`, `trg_protect_member_columns`, `trg_validate_attendance_record_mutation`, `trg_audit_expenses`, `trg_audit_members`.
      - **3 Critical Security Functions:** `public.get_caller_auth`, `public.match_constitution_sections`, `public.process_audit_log_capture`.
      - **Active Row Level Security:** Asserts `rowsecurity = TRUE` across ALL 10 public tables.
    - Script fails closed: raises fatal SQL exception (`RAISE EXCEPTION`) listing all missing items if any assertion fails.
*   **Acceptance Tests:**
    - *Positive Test 1 (Baseline Pass):* Run preflight check on database created from Migrations 001–009. Expected: script runs cleanly with zero exceptions.
    - *Negative Test 1 (Type Mismatch Abort):* Alter `audit_logs.actor_type` to `varchar(20)`. Expected: raises fatal exception `PREFLIGHT VALIDATION FAILED: Missing baseline objects: Column: public.audit_logs.actor_type (varchar(50))`.
    - *Negative Test 2 (Non-Unique Email Index Abort):* Recreate `idx_members_email_lower` without `UNIQUE` keyword (`indisunique = false`). Expected: raises fatal exception `PREFLIGHT VALIDATION FAILED: Index: public.members.idx_members_email_lower (UNIQUE on LOWER(email))`.
    - *Negative Test 3 (Wrong RAG Index Column Abort):* Recreate `idx_constitution_embedding_hnsw` indexing a text column instead of `embedding`. Expected: raises fatal exception `PREFLIGHT VALIDATION FAILED: Index: public.constitution_sections.idx_constitution_embedding_hnsw (HNSW on embedding with vector_cosine_ops)`.
    - *Negative Test 4 (Disabled RLS Abort):* Disable RLS on any public table. Expected: raises fatal exception `RLS disabled on table: public.[table_name]`.
*   **Execution Status:** Script DDL verified. Runtime execution: **NOT EXECUTED (SPECIFIED FOR SCHEMA RELEASE GATE)**.

---

### 3. Expense Attribution: Preserved Approval on Reversal
*   **Defect & Impact:** Reversing an approved expense previously overwrote `approved_by` and `approved_at`, destroying the historical record of who originally approved the disbursement.
*   **Source Location:** `supabase/migrations/20261013000006_financial_records.sql`
*   **Corrected SQL & Control:**
    - Added dedicated columns to `public.expenses`: `reversed_by UUID REFERENCES public.members(id)` and `reversed_at TIMESTAMPTZ`.
    - In `public.validate_expense_mutation()`:
      - Transition `recorded -> verified` (approval): sets `NEW.approved_by := v_caller.member_id`, `NEW.approved_at := timezone('utc', now())`, `NEW.reversed_by := NULL`, `NEW.reversed_at := NULL`.
      - Transition `verified -> voided` (reversal): preserves `NEW.approved_by := OLD.approved_by` and `NEW.approved_at := OLD.approved_at` intact; sets `NEW.reversed_by := v_caller.member_id`, `NEW.reversed_at := timezone('utc', now())`; requires non-empty `reversal_reason` ($\ge 5$ chars).
      - Transition `recorded -> voided` (cancellation before approval): keeps `approved_by` and `approved_at` as NULL; sets `reversed_by` and `reversed_at`.
*   **Acceptance Tests:**
    - *Positive Test 1 (Approval and Reversal Attribution):* Financial Officer B approves Officer A's expense; Financial Officer C reverses the expense with reason. Expected: record shows `approved_by = Officer_B_ID`, `approved_at = T1`, `reversed_by = Officer_C_ID`, `reversed_at = T2`, `reversal_reason = 'Cancelled by committee'`.
    - *Negative Test 1 (Approval Metadata Tampering):* Client updates `approved_by` while leaving `status = 'verified'`. Expected: fails with `Approval metadata cannot be modified independently`.
    - *Negative Test 2 (Reversal Without Reason):* Officer attempts to reverse approved expense with empty `reversal_reason`. Expected: fails with `Validation Failed: Reversing an approved expense requires a descriptive reversal_reason`.
*   **Execution Status:** Specification and SQL DDL verified. Runtime execution: **NOT EXECUTED (SPECIFIED FOR FINANCIAL RELEASE GATE)**.

---

### 4. Contribution Attribution: Preserved Verification on Voiding/Adjustment
*   **Defect & Impact:** Voiding or adjusting an approved contribution previously wiped or overwrote `verified_by` and `verified_at`, destroying the audit record of who confirmed receipt of funds.
*   **Source Location:** `supabase/migrations/20261013000006_financial_records.sql`
*   **Corrected SQL & Control:**
    - Added dedicated columns to `public.contributions`: `closed_by UUID REFERENCES public.members(id)` and `closed_at TIMESTAMPTZ`.
    - In `public.protect_payment_state_transitions()`:
      - Transition `recorded -> verified`: sets `NEW.verified_by := v_caller.member_id`, `NEW.verified_at := timezone('utc', now())`, `NEW.closed_by := NULL`, `NEW.closed_at := NULL`.
      - Transition `verified -> voided`: preserves `NEW.verified_by := OLD.verified_by` and `NEW.verified_at := OLD.verified_at` intact; sets `NEW.closed_by := v_caller.member_id`, `NEW.closed_at := timezone('utc', now())`; requires `void_reason` ($\ge 5$ chars).
      - Transition `verified -> adjusted`: preserves `NEW.verified_by := OLD.verified_by` and `NEW.verified_at := OLD.verified_at` intact; sets `NEW.closed_by := v_caller.member_id`, `NEW.closed_at := timezone('utc', now())`; requires adjustment note.
      - Transition `recorded -> voided`: keeps `verified_by` and `verified_at` as NULL; sets `closed_by` and `closed_at`.
*   **Acceptance Tests:**
    - *Positive Test 1 (Verification and Voiding Attribution):* Financial Officer B verifies Officer A's recorded contribution; Officer C voids the verified contribution. Expected: record shows `verified_by = Officer_B_ID`, `verified_at = T1`, `closed_by = Officer_C_ID`, `closed_at = T2`.
    - *Negative Test 1 (Metadata Tampering Without Transition):* Client attempts to update `closed_by` or `verified_by` while leaving `status = 'verified'`. Expected: fails with `Verification metadata cannot be modified without a valid status transition`.
    - *Negative Test 2 (Transition from Voided):* Client attempts to transition from `status = 'voided'` to `'verified'`. Expected: fails with `Terminal State: Voided or adjusted payments cannot transition to any other status`.
*   **Execution Status:** Specification and SQL DDL verified. Runtime execution: **NOT EXECUTED (SPECIFIED FOR FINANCIAL RELEASE GATE)**.

---

### 5. Restore Safety: Fail-Closed DNS Resolution, Address Set Comparison & Exhaustive Invariants
*   **Defect & Impact:**
    1. Previous restore script continued execution if DNS lookup failed or returned empty addresses, failing open rather than fail-closed.
    2. Comparing only the first resolved IP could fail to detect multi-homed or overlapping address sets between target and production endpoints.
*   **Source Location:** Section 7.2 of `implementation_plan.md` and `scripts/restore_database.sh`
*   **Corrected Documentation & Control:**
    - **Fail-Fast Shell Handling:** Enforces `set -euo pipefail` at script start.
    - **Primary Authoritative Target-Project Identity Verification:**
      - Requires non-empty `PROD_DB_HOST` and `TARGET_PROJECT_ID`.
      - Authoritatively rejects if `TARGET_PROJECT_ID == PROD_PROJECT_ID`.
      - Enforces strict whitelist: `TARGET_ENV` must explicitly equal `staging` or `development`.
      - Compares `TARGET_DB_HOST` directly against `PROD_DB_HOST`.
      - Requires valid credentials for the authoritative target environment before connecting.
    - **Secondary Defense-in-Depth (Fail-Closed DNS Set Comparison):**
      - Documented that IP overlap is only a secondary signal (multi-tenant cloud ingress or proxy pools may share IPs; conversely aliases may route to prod). Authoritative target-project/endpoint identity verification above is the primary prerequisite before connecting.
      - Resolves complete normalized IPv4 and IPv6 address sets for both `TARGET_HOST` and `PROD_DB_HOST` (`sort -u`).
      - Fails closed immediately if either host resolution fails or returns an empty address set.
      - Uses `comm -12` to detect any overlapping IP address between target and production sets; aborts immediately with fatal error if any address is shared.
    - **Atomic Single Transaction:** Restores exclusively using `psql --single-transaction -v ON_ERROR_STOP=1`.
    - **Exhaustive Automated Invariant Assertions:**
      - Verifies non-zero baseline count on `members`.
      - Verifies referential integrity across ALL member references in `expenses` (`recorded_by`, `approved_by`, `reversed_by`).
      - Verifies referential integrity across ALL member references in `contributions` (`member_id`, `recorded_by`, `verified_by`, `closed_by`).
      - Verifies referential integrity for `attendance_records` (`event_id`, `member_id`).
      - Verifies financial state invariants (valid approval and reversal attribution on expenses, valid verification metadata on contributions).
      - Verifies active RLS (`rowsecurity = TRUE`) across **ALL public tables** in `pg_tables`.
      - Raises fatal SQL exception if any invariant fails, causing `psql` to exit non-zero.
*   **Acceptance Test Fixtures:**
    - *Positive Fixture 1 (Valid Staging Execution):* Script executes with `TARGET_ENV=staging`, `TARGET_DB_HOST=db.staging-ref.supabase.co`, `PROD_DB_HOST=db.prod-ref.supabase.co`. Both resolve to distinct non-empty IP sets. Expected: all endpoint guards pass, restore executes within single transaction, and post-restore assertion executes cleanly with notice.
    - *Negative Fixture 1 (DNS Resolution Failure Abort):* Pass unresolvable target host. Expected: script fails closed immediately with `FATAL: DNS resolution failed or returned empty address set for TARGET_HOST`.
    - *Negative Fixture 2 (Complete Address Set Overlap Abort):* Pass target host where any resolved IP matches an IP in the production address set. Expected: script aborts immediately with `FATAL: Endpoint alias detected! TARGET_HOST shares resolved IP address(es) with PROD_DB_HOST`.
    - *Negative Fixture 3 (Direct Endpoint Match):* Pass `TARGET_DB_HOST=PROD_DB_HOST`. Expected: terminates immediately before connection with `FATAL: TARGET_HOST matches trusted production endpoint`.
    - *Negative Fixture 4 (Disallowed Environment):* Pass `TARGET_ENV=production`. Expected: terminates immediately with `FATAL: TARGET_ENV must be 'staging' or 'development'`.
    - *Negative Fixture 5 (Orphan approved_by / reversed_by FK):* Database backup contains an expense row with `approved_by` or `reversed_by` referencing non-existent member. Expected: post-restore assertion raises fatal exception and fails script.
    - *Negative Fixture 6 (Disabled Public Table RLS):* Database target has `rowsecurity = FALSE` on any public table. Expected: post-restore assertion raises fatal exception and fails script.
*   **Execution Status:** Runbook specification, SQL DDL, and test fixtures verified. Runtime execution: **NOT EXECUTED (SPECIFIED FOR RECOVERY RELEASE GATE IN PHASE 07)**.
