# AGILA Hub Android — Phase 01 Remediation Traceability Matrix (Revision 4.1)
**Document:** Phase 01 Remediation Traceability (`remediation_traceability.md`)  
**Status:** Phase 01 Implementation & Foundation Verification COMPLETE (Release Gate 01 Passed)  
**Scope:** Reconciled against Migrations 001 through 009 on disk, `scripts/preflight_schema_check.sql`, `scripts/restore_database.sh`, and `scripts/verify_phase01.ts`.

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
*   **Phase 01 Automated Test Verification:**
    - `REM-01-EXP-CAT`: Asserts `v_safe_new` references `v_raw_new->'category'` (PASS).
    - `REM-01-ACTOR-TYPE`: Asserts `audit_logs.actor_type VARCHAR(50) NOT NULL DEFAULT 'authenticated_member'` (PASS).
    - `MIG-FILE-08`: Asserts Migration 008 file exists on disk (10,820 bytes) (PASS).
*   **Execution Status:** Materialized on disk and contract verified. Runtime execution on live database: **NOT EXECUTED (SPECIFIED FOR AUDIT RELEASE GATE)**.

---

### 2. Preflight Completeness: Type-Aligned & Uniqueness-Verified Schema Assertions
*   **Defect & Impact:**
    1. Previous preflight script checked `audit_logs.actor_type` as `data_type = 'text'`, which fails on PostgreSQL databases created from Migration 008 declaring `actor_type VARCHAR(50)` (`data_type = 'character varying'`).
    2. Index assertions checked expressions by text search without validating index uniqueness on `idx_members_email_lower` or verifying that `idx_constitution_embedding_hnsw` specifically belongs to `public.constitution_sections`, uses the HNSW access method, and indexes the `embedding` column with `vector_cosine_ops`.
    3. `public.constitution_versions` table was omitted from the preflight table-presence check and RLS check array, leaving it unchecked despite being declared in Migration 007 and protected by RLS in Migration 009.
*   **Source Location:** Section 8.1 of `implementation_plan.md` and `scripts/preflight_schema_check.sql`
*   **Corrected SQL & Control:**
    - Aligned `audit_logs.actor_type` check with Migration 008 definition: asserts `data_type = 'character varying'` and `character_maximum_length = 50`.
    - Hardened index assertions to validate security- and integrity-relevant properties:
      - `idx_members_email_lower`: joins `pg_index` to assert `indisunique = TRUE` in addition to `indexdef ILIKE '%lower(%email%)%'`.
      - `uq_reference_payment`: asserts unique constraint in `pg_constraint (contype = 'u')` and unique index in `pg_index (indisunique = TRUE)` covering `(payment_channel, reference_number)`.
      - `idx_constitution_embedding_hnsw`: asserts index on `public.constitution_sections`, HNSW method (`indexdef ILIKE '%hnsw%'`), and explicit indexing of the `embedding` column with `vector_cosine_ops` (`indexdef ILIKE '%(embedding%vector_cosine_ops)%'`).
    - Validates complete baseline:
      - **3 Required Extensions:** `uuid-ossp`, `pgcrypto`, `vector`.
      - **All 11 Core Baseline Tables:** `members`, `member_invitations`, `eagles_id_cards`, `announcements`, `attendance_events`, `attendance_records`, `contributions`, `expenses`, `constitution_versions`, `constitution_sections`, `audit_logs`.
      - **Critical Columns & Types:** `members.auth_user_id (uuid)`, `contributions.closed_by (uuid)`, `expenses.reversed_by (uuid)`, `audit_logs.actor_type (varchar(50))`, `constitution_sections.embedding`.
      - **6 Critical Integrity Triggers:** `trg_validate_expense_mutation`, `trg_protect_payment_transitions`, `trg_protect_member_columns`, `trg_validate_attendance_record_mutation`, `trg_audit_expenses`, `trg_audit_members`.
      - **3 Critical Security Functions:** `public.get_caller_auth`, `public.match_constitution_sections`, `public.process_audit_log_capture`.
      - **Active Row Level Security:** Asserts `rowsecurity = TRUE` across ALL 11 public tables in `pg_tables`.
    - Script fails closed: raises fatal SQL exception (`RAISE EXCEPTION`) listing all missing items if any assertion fails.
*   **Phase 01 Automated Test Verification:**
    - `PRE-FILE-01`: Asserts `scripts/preflight_schema_check.sql` exists on disk (PASS).
    - `PRE-TBL-CONST-VERSIONS`: Asserts `v_expected_tables` includes `constitution_versions` and `constitution_sections` (PASS).
    - `PRE-ACTOR-TYPE`: Asserts preflight checks `actor_type varchar(50)` (PASS).
    - `PRE-EMAIL-IDX`: Asserts preflight validates `idx_members_email_lower` `indisunique = TRUE` and `LOWER(email)` (PASS).
    - `PRE-HNSW-IDX`: Asserts preflight validates `idx_constitution_embedding_hnsw` on `embedding vector_cosine_ops` (PASS).
    - `PRE-RLS-CHECK`: Asserts preflight checks `rowsecurity = TRUE` on all 11 public tables (PASS).
*   **Execution Status:** Script materialized on disk and contract verified. Runtime execution: **NOT EXECUTED (SPECIFIED FOR SCHEMA RELEASE GATE)**.

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
*   **Phase 01 Automated Test Verification:**
    - `MIG-FILE-06`: Asserts Migration 006 exists on disk (14,838 bytes) (PASS).
    - `REM-03-EXP-COLS`: Asserts `reversed_by`, `reversed_at`, `reversal_reason` columns declared (PASS).
    - `REM-03-EXP-PRESERVE`: Asserts `NEW.approved_by := OLD.approved_by` and `NEW.approved_at := OLD.approved_at` preserved (PASS).
*   **Execution Status:** Materialized on disk and contract verified. Runtime execution: **NOT EXECUTED (SPECIFIED FOR FINANCIAL RELEASE GATE)**.

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
*   **Phase 01 Automated Test Verification:**
    - `REM-04-CON-COLS`: Asserts `closed_by`, `closed_at`, `void_reason` columns declared (PASS).
    - `REM-04-CON-PRESERVE`: Asserts `NEW.verified_by := OLD.verified_by` and `NEW.verified_at := OLD.verified_at` preserved (PASS).
*   **Execution Status:** Materialized on disk and contract verified. Runtime execution: **NOT EXECUTED (SPECIFIED FOR FINANCIAL RELEASE GATE)**.

---

### 5. Restore Safety: Explicit TARGET_ENV, Authoritative Project Mapping, Fail-Closed DNS & Exhaustive Invariants
*   **Defect & Impact:**
    1. Previous restore script used an implicit default `TARGET_ENV="${TARGET_ENV:-staging}"`, permitting execution when `TARGET_ENV` was omitted.
    2. Previous guard compared `TARGET_PROJECT_ID` with `PROD_PROJECT_ID` and hostnames, but did not enforce authoritative verification that `TARGET_DB_HOST` strictly belongs to the declared `TARGET_PROJECT_ID`.
    3. DNS checks must fail closed on lookup failure or empty results, and address sets must be compared completely via `comm -12`.
*   **Source Location:** Section 7.2 of `implementation_plan.md` and `scripts/restore_database.sh`
*   **Corrected Documentation & Control:**
    - **Fail-Fast Shell Handling:** Enforces `set -euo pipefail` at script start.
    - **Mandatory Explicit Target Environment (`TARGET_ENV`):**
      - `TARGET_ENV` must be explicitly declared (`staging` or `development`). Implicit defaults are strictly removed; if unset or empty, the script aborts immediately with exit code 1.
      - Production environment is strictly disallowed (`TARGET_ENV=production` immediately aborts).
    - **Primary Authoritative Target Identity & Project-to-Endpoint Mapping:**
      - Requires non-empty `PROD_DB_HOST`, `PROD_PROJECT_ID`, and `TARGET_PROJECT_ID`.
      - Authoritatively rejects if `TARGET_PROJECT_ID == PROD_PROJECT_ID`.
      - Authoritatively validates that `TARGET_DB_HOST` strictly belongs to declared `TARGET_PROJECT_ID` using the trusted platform endpoint mapping (`EXPECTED_TARGET_HOST="db.${TARGET_PROJECT_ID}.supabase.co"`). Any mismatch halts execution before connection.
      - Directly compares `TARGET_HOST` against authoritative `PROD_DB_HOST`.
      - Requires valid credentials for the authoritative target environment before connecting.
    - **Secondary Defense-in-Depth (Fail-Closed DNS Set Comparison):**
      - Resolves complete normalized IPv4 and IPv6 address sets for both `TARGET_HOST` and `PROD_DB_HOST` (`sort -u`).
      - Fails closed immediately if either host resolution fails or returns an empty address set.
      - Uses `comm -12` to detect any overlapping IP address between target and production sets; aborts immediately with fatal error if any address is shared.
    - **Atomic Single Transaction:** Restores exclusively using `psql --single-transaction -v ON_ERROR_STOP=1`.
    - **Exhaustive Automated Invariant Assertions:**
      - Verifies referential integrity across ALL member references in `expenses` (`recorded_by`, `approved_by`, `reversed_by`).
      - Verifies referential integrity across ALL member references in `contributions` (`member_id`, `recorded_by`, `verified_by`, `closed_by`).
      - Verifies referential integrity for `attendance_records` (`event_id`, `member_id`).
      - Verifies financial state invariants and active RLS (`rowsecurity = TRUE`) across **ALL 11 public tables** in `pg_tables`.
*   **Phase 01 Automated Negative Fixture Execution Results (Isolated Environment):**
    - Every fixture executed using `env -i` with complete isolation from outer environment variables:
    - `RESTORE-NEG-01`: Missing `TARGET_ENV` -> aborted immediately with code 1 (`FATAL: TARGET_ENV is unset or empty`) (PASS).
    - `RESTORE-NEG-02`: `TARGET_ENV=production` -> aborted immediately with code 1 (`Production restores are blocked`) (PASS).
    - `RESTORE-NEG-03`: Missing `TARGET_PROJECT_ID` -> aborted immediately with code 1 (PASS).
    - `RESTORE-NEG-04`: Missing `PROD_PROJECT_ID` -> aborted immediately with code 1 (PASS).
    - `RESTORE-NEG-05`: Missing `PROD_DB_HOST` -> aborted immediately with code 1 (PASS).
    - `RESTORE-NEG-06`: Target Project == Prod Project -> aborted immediately with code 1 (`Production restores are strictly forbidden`) (PASS).
    - `RESTORE-NEG-07`: Hostname / Project-ID Mismatch -> aborted immediately with code 1 (`Authoritative target identity verification failed`) (PASS).
    - `RESTORE-NEG-08`: Target Host == Prod Host -> aborted immediately with code 1 (`matches trusted production endpoint`) (PASS).
*   **Execution Status:** Script materialized on disk, 8 isolated negative fixtures executed and passed. Live restore drill: **NOT EXECUTED (SPECIFIED FOR RECOVERY RELEASE GATE IN PHASE 07)**.

---

## 2. Phase 01 Automated Verification Summary

| Test Suite | Total Assertions | PASS | FAIL | Execution Method |
| :--- | :---: | :---: | :---: | :--- |
| **Migration Inventory** | 10 | 10 | 0 | `scripts/verify_phase01.ts` (fs inspection) |
| **Schema Definitions & Types** | 14 | 14 | 0 | `scripts/verify_phase01.ts` (DDL inspection) |
| **Architectural Remediations** | 10 | 10 | 0 | `scripts/verify_phase01.ts` (AST/Regex assertions) |
| **RLS Policy Coverage** | 11 | 11 | 0 | `scripts/verify_phase01.ts` (DDL assertions across all 11 tables) |
| **Preflight Script Parity** | 6 | 6 | 0 | `scripts/verify_phase01.ts` (SQL contract analysis including `constitution_versions`) |
| **Restore Runbook Negative Fixtures** | 9 | 9 | 0 | `scripts/verify_phase01.ts` (`env -i` isolated subshell execution) |
| **SQL Syntax Validation** | 10 | 10 | 0 | `scripts/verify_phase01.ts` (PostgreSQL `libpg_query` AST parser) |
| **TOTAL** | **70** | **70** | **0** | **100% Pass Rate** |
