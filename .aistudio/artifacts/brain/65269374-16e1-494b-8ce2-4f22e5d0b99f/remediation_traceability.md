# AGILA Hub Android — Phase 00 Remediation Traceability Matrix (Revision 3.7)
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
    - Added `actor_type` column distinguishing `'authenticated_member'`, `'service_role'`, and `'system'`. Actor attribution is derived strictly from server context (`auth.uid()`), ignoring any client payload.
*   **Acceptance Tests:**
    - *Positive Test 1 (Allowlisted Field Capture):* Member updates nickname. Expected: audit row created with `actor_type = 'authenticated_member'`; `new_data` contains only allowlisted keys (`id`, `nickname`, `role`, `status`, `club_chapter`, `updated_at`).
    - *Positive Test 2 (Service-Role Attribution):* Backend worker executes mutation via service role. Expected: audit row created with `actor_type = 'service_role'` and `actor_id IS NULL`.
    - *Positive Test 3 (Expense Category Regression Test):* Financial officer inserts expense (`category = 'venue_rental'`). Expected: audit row created with `new_data->>'category' = 'venue_rental'` (non-null) and `old_data IS NULL`. When updated to `'equipment_rental'`, verify `old_data->>'category' = 'venue_rental'` and `new_data->>'category' = 'equipment_rental'`.
    - *Negative Test 1 (Storage Path Exclusion):* Member uploads Eagles ID card. Expected: audit log captures status change; `front_storage_path` and `back_storage_path` are completely excluded from `new_data`.
    - *Negative Test 2 (Token Hash Exclusion):* Admin generates invitation. Expected: audit log captures invitation creation; `token_hash` is completely excluded from `new_data`.
*   **Execution Status:** Specification and SQL DDL verified. Runtime execution: **NOT EXECUTED (SPECIFIED FOR AUDIT RELEASE GATE)**.

---

### 2. Preflight Completeness: Exhaustive Baseline Schema Verification
*   **Defect & Impact:** Previous preflight script checked only object presence names and missed validating columns, data types, triggers, and RLS configurations, failing to detect schema drift.
*   **Source Location:** Section 8.1 of `implementation_plan.md` and `scripts/preflight_schema_check.sql`
*   **Corrected SQL & Control:**
    - Expanded `preflight_schema_check.sql` to systematically inspect:
      - **3 Required Extensions:** `uuid-ossp`, `pgcrypto`, `vector`.
      - **All 10 Core Baseline Tables:** `members`, `member_invitations`, `eagles_id_cards`, `announcements`, `attendance_events`, `attendance_records`, `contributions`, `expenses`, `constitution_sections`, `audit_logs`.
      - **Critical Columns & Types:** `members.auth_user_id (uuid)`, `contributions.closed_by (uuid)`, `expenses.reversed_by (uuid)`, `audit_logs.actor_type (text)`, `constitution_sections.embedding`.
      - **6 Critical Integrity Triggers:** `trg_validate_expense_mutation`, `trg_protect_payment_transitions`, `trg_protect_member_columns`, `trg_validate_attendance_record_mutation`, `trg_audit_expenses`, `trg_audit_members`.
      - **3 Critical Security Functions:** `public.get_caller_auth`, `public.match_constitution_sections`, `public.process_audit_log_capture`.
      - **2 Critical Unique Indexes:** `uq_members_email_lower`, `uq_contributions_reference`.
      - **Active Row Level Security:** Validates `rowsecurity = TRUE` on all 10 public tables.
    - Script fails closed: raises fatal SQL exception listing all missing items if any check fails.
*   **Acceptance Tests:**
    - *Positive Test 1 (Baseline Pass):* Run preflight check on database with complete schema baseline. Expected: script runs cleanly with zero exceptions.
    - *Negative Test 1 (Missing Column):* Drop column `closed_by` on `contributions` and run preflight script. Expected: raises fatal exception `PREFLIGHT VALIDATION FAILED: Missing baseline objects: Column: public.contributions.closed_by (uuid)`.
    - *Negative Test 2 (Disabled RLS):* Disable RLS on `public.expenses` and run preflight script. Expected: raises fatal exception `RLS disabled on table: public.expenses`.
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

### 5. Restore Safety: Production Isolation, Fail-Fast Shell & Automated Invariant Assertions
*   **Defect & Impact:** Restore procedure previously lacked comprehensive target environment guards, omitted shell fail-fast handling (`set -euo pipefail`), and relied on basic row count outputs rather than enforcing schema, referential, and state invariants.
*   **Source Location:** Section 7.2 of `implementation_plan.md` and `scripts/restore_database.sh`
*   **Corrected Documentation & Control:**
    - **Fail-Fast Shell Handling:** Added `set -euo pipefail` at script start; halts on any pipeline, command, or uninitialized variable failure.
    - **Multi-Point Production Target Guard:** Checks that both `TARGET_PROJECT_ID` and `PROD_PROJECT_ID` are non-empty; halts immediately if `TARGET_PROJECT_ID == PROD_PROJECT_ID`, or if target ID/host contains `prod` or `agila-hub-prod`.
    - **Atomic Single Transaction:** Restores exclusively using `psql --single-transaction -v ON_ERROR_STOP=1`.
    - **Automated Post-Restore Invariant Assertions:** Connects with `-v ON_ERROR_STOP=1` and runs a PL/pgSQL verification block asserting:
      1. Non-zero baseline row counts on `members`.
      2. Referential integrity: zero orphaned rows in `contributions` and `expenses` pointing to invalid `members(id)`.
      3. Financial state invariant: zero verified expenses lacking approval metadata (`approved_by`, `approved_at`).
      4. Reversal invariant: zero voided expenses lacking reversal metadata (`reversed_by`, `reversed_at`, `reversal_reason`) or having cleared approval metadata.
      5. Security invariant: active RLS (`rowsecurity = TRUE`) on all public tables.
      6. Raises fatal exception and exits non-zero if any invariant is violated.
*   **Acceptance Tests:**
    - *Positive Test 1 (Valid Staging Restore):* Execute `scripts/restore_database.sh` targeting verified staging instance. Expected: pre-checks pass, psql executes within single transaction, post-restore automated invariant block succeeds with notice.
    - *Negative Test 1 (Production Target Block):* Set `TARGET_PROJECT_ID = $PROD_PROJECT_ID` and execute restore script. Expected: halts immediately with `FATAL: Attempted restore to PRODUCTION target`.
    - *Negative Test 2 (Corrupted File Abort):* Pass corrupted backup file to restore script. Expected: transaction rolls back cleanly with zero changes applied to staging.
    - *Negative Test 3 (Invariant Failure Abort):* Restore backup with orphan foreign keys into staging. Expected: PL/pgSQL post-restore assertion raises fatal exception and fails script.
*   **Execution Status:** Runbook specification and automated SQL assertion verified. Runtime execution: **NOT EXECUTED (SPECIFIED FOR RECOVERY RELEASE GATE)**.
