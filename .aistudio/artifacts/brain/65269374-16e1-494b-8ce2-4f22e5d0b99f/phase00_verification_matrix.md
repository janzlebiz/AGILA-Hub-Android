# AGILA Hub Android — Phase 00 Verification Matrix (Revision 3.7)
**Document:** Final Phase 00 Verification Checklist (`phase00_verification_matrix.md`)  
**Status:** Completed Phase 00 Planning Evaluation (Awaiting Stakeholder Approval)  
**Rule Applied:** Unexecuted runtime tests and recovery drills are strictly and explicitly marked **NOT EXECUTED (Scheduled for [Gate Name])**. Approval of the Phase 00 planning baseline is clearly distinguished from runtime or production-readiness certification.

---

## 1. Final Acceptance Checklist

| Item ID | Acceptance Requirement | Evaluation Target | Verification Evidence / Inspection | Specification Status | Runtime Execution Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **REV-01-A** | Strict per-table audit allowlist & payload integrity | `process_audit_log_capture` in Migration 008 | Explicit allowlists for all 8 audited tables; `expenses.new_data.category` correctly sourced from `v_raw_new->'category'`; fallback records ID only | **PASS (By Specification & DDL)** | **NOT EXECUTED** *(Scheduled for Audit Gate)* |
| **REV-01-B** | Audit privacy & expense category regression tests | Allowlist execution & regression test | Positive/negative test procedures and category regression test specified in plan; requires live database for execution | **PASS (By Specification)** | **NOT EXECUTED** *(Scheduled for Audit Gate)* |
| **REV-02-A** | Comprehensive preflight schema assertions | `scripts/preflight_schema_check.sql` | Exhaustively checks 3 extensions, all 10 core tables, critical columns/types, 6 triggers, 3 security functions, 2 unique indexes, and active RLS | **PASS (By Specification & DDL)** | **NOT EXECUTED** *(Scheduled for Schema Gate)* |
| **REV-02-B** | Preflight schema validation tests | Passing baseline & failure fixtures | Fixture specifications defined in plan; requires live database instance in Phase 01 | **PASS (By Specification)** | **NOT EXECUTED** *(Scheduled for Schema Gate)* |
| **REV-03-A** | Expense approval & reversal attribution | `public.expenses` schema & triggers | `approved_by/at` preserved on reversal; distinct `reversed_by/at` columns enforced in `006_financial_records.sql` | **PASS (By Specification & DDL)** | **NOT EXECUTED** *(Scheduled for Financial Gate)* |
| **REV-03-B** | Expense attribution runtime tests | Approval & reversal state transitions | Positive/negative test procedures specified; requires live database for execution | **PASS (By Specification)** | **NOT EXECUTED** *(Scheduled for Financial Gate)* |
| **REV-04-A** | Contribution verification attribution | `public.contributions` schema & triggers | `verified_by/at` preserved on void/adjust; distinct `closed_by/at` columns enforced in `006_financial_records.sql` | **PASS (By Specification & DDL)** | **NOT EXECUTED** *(Scheduled for Financial Gate)* |
| **REV-04-B** | Contribution attribution runtime tests | Verification & voiding state transitions | Positive/negative test procedures specified; requires live database for execution | **PASS (By Specification)** | **NOT EXECUTED** *(Scheduled for Financial Gate)* |
| **REV-05-A** | Hardened restore runbook & automated assertions | Section 7.2 & `scripts/restore_database.sh` | Multi-point production guard, `set -euo pipefail`, single transaction, and automated PL/pgSQL invariant assertions | **PASS (By Specification)** | **NOT EXECUTED** *(Scheduled for Recovery Gate)* |
| **REV-05-B** | Live restore runbook execution & drill | Staging restore & PITR drill | Runbook and invariant assertions specified; requires live Supabase Pro instance to execute restore drill in Phase 07 | **PASS (By Specification)** | **NOT EXECUTED** *(Scheduled for Recovery Gate)* |
| **P0-03-A** | Member identity protection trigger | `protect_member_sensitive_columns` in Migration 002 | Self-service restricted to nickname/avatar; legal names, `auth_user_id`, chapter locked | **PASS (By Specification & DDL)** | **NOT EXECUTED** *(Scheduled for Privilege Gate)* |
| **P0-03-B** | Member identity runtime tests | Positive/negative self-service edit tests | Positive/negative test procedures specified; requires live database for execution | **PASS (By Specification)** | **NOT EXECUTED** *(Scheduled for Privilege Gate)* |
| **P1-02-A** | Attendance verification attribution | `validate_attendance_record_mutation` in Migration 005 | Server forces `verified_by := v_caller.member_id`; client attribution spoofing blocked | **PASS (By Specification & DDL)** | **NOT EXECUTED** *(Scheduled for Attendance Gate)* |
| **P1-02-B** | Attendance verification runtime tests | Verification spoofing tests | Positive/negative test procedures specified; requires live database for execution | **PASS (By Specification)** | **NOT EXECUTED** *(Scheduled for Attendance Gate)* |
| **P1-05-A** | RAG threshold floor enforcement & fixtures | `match_constitution_sections` in Migration 007 | Server clamps `GREATEST(0.68, ...)`; controlled test fixtures defined in plan | **PASS (By Specification & DDL)** | **NOT EXECUTED** *(Scheduled for RAG Gate)* |
| **P1-05-B** | RAG threshold floor runtime tests | Mock embedding threshold tests | Mock fixture specifications defined; requires executing against pgvector in Phase 05 | **PASS (By Specification)** | **NOT EXECUTED** *(Scheduled for RAG Gate)* |

---

## 2. Summary of Verification Status

*   **Total Checklist Items Evaluated:** 16
*   **PASS (Architectural Specification & Executable DDL Baseline):** 16 items ($100\%$) — All architectural controls, SQL DDL migrations, security triggers, preflight assertion blocks, and operational recovery runbooks are completely specified, verified, and syntax-valid.
*   **NOT EXECUTED (Runtime Release Gate Tests & Live Drills):** 16 items ($100\%$) — All corresponding positive and negative runtime test suites and live disaster recovery drills are fully specified with explicit test procedures and assertions, but remain strictly **NOT EXECUTED** because Phase 00 prohibits provisioning live infrastructure or applying live migrations.
*   **FAIL:** 0 items ($0\%$) — All identified source defects (including the expense category audit payload bug, preflight coverage gaps, and restore script safeguards) are resolved.

---

## 3. Remaining Blockers Requiring Human Action Prior to Phase 01 Execution
1. **Designation of Root Super-Admin Email:** Required for initial bootstrap seed migration.
2. **Constitution Document Access Authorization:** Required before live text extraction in Phase 05.
3. **Supabase Pro Tier Selection:** Required to enable continuous PITR and meet the $\le 1\,\text{hour}$ RPO target.

---

## 4. Final Recommendation

**RECOMMENDATION: APPROVE PHASE 00 PLANNING BASELINE / REJECT PHASE 00 RUNTIME PRODUCTION CERTIFICATION**

- **Planning Baseline Status:** **APPROVE PHASE 00 PLANNING BASELINE.** The architectural specifications, SQL migrations, security triggers, comprehensive preflight assertions, and operational runbooks are complete, reconciled, and verified.
- **Production / Runtime Readiness Status:** **NOT CERTIFIED (DEFERRED TO SCHEDULED PHASE GATES).** Runtime acceptance tests and disaster recovery drills cannot and have not been executed on live cloud infrastructure during planning-only Phase 00. They are scheduled for execution at their respective phase release gates upon infrastructure provisioning in Phase 01 through Phase 07.
