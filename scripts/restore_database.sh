#!/usr/bin/env bash
# AGILA Hub — Transaction-Safe Restore Runbook (Staging / Recovery Testing Only)
# Revision 3.11: Enforces explicit TARGET_ENV and authoritative target-project identity mapping
set -euo pipefail

# 1. Enforce Mandatory TARGET_ENV (No implicit default allowed)
if [ -z "${TARGET_ENV:-}" ]; then
    echo "FATAL: TARGET_ENV is unset or empty. Explicit environment ('staging' or 'development') is required. Aborted." >&2
    exit 1
fi

if [ "$TARGET_ENV" != "staging" ] && [ "$TARGET_ENV" != "development" ]; then
    echo "FATAL: TARGET_ENV must be explicitly 'staging' or 'development' (received '$TARGET_ENV'). Production restores are blocked." >&2
    exit 1
fi

# 2. Enforce Mandatory Project IDs & Authoritative Production Endpoint
if [ -z "${TARGET_PROJECT_ID:-}" ]; then
    echo "FATAL: TARGET_PROJECT_ID is unset or empty. Aborted." >&2
    exit 1
fi

if [ -z "${PROD_PROJECT_ID:-}" ]; then
    echo "FATAL: PROD_PROJECT_ID is unset or empty. Cannot verify production isolation guard." >&2
    exit 1
fi

if [ -z "${PROD_DB_HOST:-}" ]; then
    echo "FATAL: PROD_DB_HOST is unset or empty. Authoritative production endpoint required for isolation verification." >&2
    exit 1
fi

# Primary Gate 1: Authoritative target-project identity check (reject identical project IDs)
if [ "$TARGET_PROJECT_ID" = "$PROD_PROJECT_ID" ]; then
    echo "FATAL: TARGET_PROJECT_ID equals PROD_PROJECT_ID ('$TARGET_PROJECT_ID'). Production restores are strictly forbidden. Aborted." >&2
    exit 1
fi

# Primary Gate 2: Authoritative Project-to-Endpoint Mapping Verification
# TARGET_DB_HOST must authoritatively belong to the declared TARGET_PROJECT_ID
EXPECTED_TARGET_HOST="db.${TARGET_PROJECT_ID}.supabase.co"
TARGET_HOST="${TARGET_DB_HOST:-$EXPECTED_TARGET_HOST}"

if [ "$TARGET_HOST" != "$EXPECTED_TARGET_HOST" ]; then
    echo "FATAL: Authoritative target identity verification failed! TARGET_DB_HOST ('$TARGET_HOST') does not match authoritative endpoint for TARGET_PROJECT_ID ('$TARGET_PROJECT_ID') [Expected: '$EXPECTED_TARGET_HOST']. Aborted." >&2
    exit 1
fi

# Primary Gate 3: Direct authoritative endpoint comparison against production endpoint
if [ "$TARGET_HOST" = "$PROD_DB_HOST" ]; then
    echo "FATAL: TARGET_HOST ('$TARGET_HOST') matches trusted production endpoint ('$PROD_DB_HOST'). Aborted." >&2
    exit 1
fi

# Secondary Defense-in-Depth: Fail-closed complete address set verification (detects CNAME/proxy/IP aliases)
# Note: IP overlap is a secondary signal (multi-tenant edge proxies may share IPs, or aliases may route to prod).
# Authoritative project identity, environment check, and project-to-endpoint mapping above remain the primary gate before connecting.
TARGET_IPS=$( (getent ahosts "$TARGET_HOST" 2>/dev/null || getent hosts "$TARGET_HOST" 2>/dev/null || true) | awk '{print $1}' | sort -u | grep -v '^$' )
PROD_IPS=$( (getent ahosts "$PROD_DB_HOST" 2>/dev/null || getent hosts "$PROD_DB_HOST" 2>/dev/null || true) | awk '{print $1}' | sort -u | grep -v '^$' )

# Fail closed: Both endpoints must resolve successfully to non-empty address sets
if [ -z "$TARGET_IPS" ]; then
    echo "FATAL: DNS resolution failed or returned empty address set for TARGET_HOST '$TARGET_HOST'. Fail-closed abort." >&2
    exit 1
fi

if [ -z "$PROD_IPS" ]; then
    echo "FATAL: DNS resolution failed or returned empty address set for PROD_DB_HOST '$PROD_DB_HOST'. Fail-closed abort." >&2
    exit 1
fi

# Compare complete normalized address sets for any overlapping IP address
OVERLAPPING_IPS=$(comm -12 <(echo "$TARGET_IPS") <(echo "$PROD_IPS"))
if [ -n "$OVERLAPPING_IPS" ]; then
    echo "FATAL: Endpoint alias detected! TARGET_HOST ('$TARGET_HOST') shares resolved IP address(es) with PROD_DB_HOST ('$PROD_DB_HOST'):" >&2
    echo "$OVERLAPPING_IPS" >&2
    echo "Restore aborted by secondary endpoint isolation policy." >&2
    exit 1
fi

# 3. Validate Explicit Single Backup File & Checksum
BACKUP_FILE="${1:-./backups/backup_staging_test.sql}"
if [ ! -s "$BACKUP_FILE" ]; then
    echo "FATAL: Backup file '$BACKUP_FILE' does not exist or is empty." >&2
    exit 1
fi

if [ ! -f "${BACKUP_FILE}.sha256" ]; then
    echo "FATAL: Checksum file '${BACKUP_FILE}.sha256' is missing." >&2
    exit 1
fi

sha256sum -c "${BACKUP_FILE}.sha256" || {
    echo "FATAL: Checksum validation failed for '$BACKUP_FILE'." >&2
    exit 1
}

# 4. Transaction-Safe Data Restore with Fail-Fast Execution
echo "Starting transaction-safe restore into target: $TARGET_PROJECT_ID ($TARGET_HOST) in environment: $TARGET_ENV..."
PGPASSWORD="${TARGET_DB_PASSWORD:?Target DB password required}" psql \
  -h "$TARGET_HOST" \
  -p 5432 \
  -d postgres \
  -U postgres \
  --single-transaction \
  -v ON_ERROR_STOP=1 \
  -f "$BACKUP_FILE"

# 5. Exhaustive Automated Post-Restore Invariant Verification
echo "Executing automated post-restore integrity assertions..."
PGPASSWORD="$TARGET_DB_PASSWORD" psql \
  -h "$TARGET_HOST" \
  -p 5432 \
  -d postgres \
  -U postgres \
  -v ON_ERROR_STOP=1 \
  << 'EOF'
DO $$
DECLARE
    v_member_count INT;
    v_orphan_contributions_member INT;
    v_orphan_contributions_rec INT;
    v_orphan_contributions_ver INT;
    v_orphan_contributions_cls INT;
    v_orphan_expenses_rec INT;
    v_orphan_expenses_app INT;
    v_orphan_expenses_rev INT;
    v_orphan_attendance_event INT;
    v_orphan_attendance_member INT;
    v_invalid_verified_expenses INT;
    v_invalid_voided_expenses INT;
    v_invalid_verified_contribs INT;
    v_disabled_rls INT;
BEGIN
    -- Check 1: Non-zero baseline data check
    SELECT count(*) INTO v_member_count FROM public.members;
    IF v_member_count = 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: members table is empty';
    END IF;

    -- Check 2: Referential integrity for contributions (all member references)
    SELECT count(*) INTO v_orphan_contributions_member
    FROM public.contributions c
    WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = c.member_id);
    IF v_orphan_contributions_member > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % contributions with orphan member_id', v_orphan_contributions_member;
    END IF;

    SELECT count(*) INTO v_orphan_contributions_rec
    FROM public.contributions c
    WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = c.recorded_by);
    IF v_orphan_contributions_rec > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % contributions with orphan recorded_by', v_orphan_contributions_rec;
    END IF;

    SELECT count(*) INTO v_orphan_contributions_ver
    FROM public.contributions c
    WHERE c.verified_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = c.verified_by);
    IF v_orphan_contributions_ver > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % contributions with orphan verified_by', v_orphan_contributions_ver;
    END IF;

    SELECT count(*) INTO v_orphan_contributions_cls
    FROM public.contributions c
    WHERE c.closed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = c.closed_by);
    IF v_orphan_contributions_cls > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % contributions with orphan closed_by', v_orphan_contributions_cls;
    END IF;

    -- Check 3: Referential integrity for expenses (recorded_by, approved_by, reversed_by)
    SELECT count(*) INTO v_orphan_expenses_rec
    FROM public.expenses e
    WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = e.recorded_by);
    IF v_orphan_expenses_rec > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % expenses with orphan recorded_by', v_orphan_expenses_rec;
    END IF;

    SELECT count(*) INTO v_orphan_expenses_app
    FROM public.expenses e
    WHERE e.approved_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = e.approved_by);
    IF v_orphan_expenses_app > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % expenses with orphan approved_by', v_orphan_expenses_app;
    END IF;

    SELECT count(*) INTO v_orphan_expenses_rev
    FROM public.expenses e
    WHERE e.reversed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = e.reversed_by);
    IF v_orphan_expenses_rev > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % expenses with orphan reversed_by', v_orphan_expenses_rev;
    END IF;

    -- Check 4: Referential integrity for attendance_records
    SELECT count(*) INTO v_orphan_attendance_event
    FROM public.attendance_records a
    WHERE NOT EXISTS (SELECT 1 FROM public.attendance_events e WHERE e.id = a.event_id);
    IF v_orphan_attendance_event > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % attendance records with orphan event_id', v_orphan_attendance_event;
    END IF;

    SELECT count(*) INTO v_orphan_attendance_member
    FROM public.attendance_records a
    WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = a.member_id);
    IF v_orphan_attendance_member > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % attendance records with orphan member_id', v_orphan_attendance_member;
    END IF;

    -- Check 5: Financial state invariant - verified expenses must have approved_by & approved_at
    SELECT count(*) INTO v_invalid_verified_expenses
    FROM public.expenses
    WHERE status = 'verified' AND (approved_by IS NULL OR approved_at IS NULL);
    IF v_invalid_verified_expenses > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % verified expenses lacking approval metadata', v_invalid_verified_expenses;
    END IF;

    -- Check 6: Financial state invariant - voided expenses that were previously approved must preserve approved_by and have reversed_by
    SELECT count(*) INTO v_invalid_voided_expenses
    FROM public.expenses
    WHERE status = 'voided' AND approved_by IS NOT NULL AND (reversed_by IS NULL OR reversed_at IS NULL OR reversal_reason IS NULL);
    IF v_invalid_voided_expenses > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % reversed expenses lacking reversal metadata', v_invalid_voided_expenses;
    END IF;

    -- Check 7: Financial state invariant - verified contributions must have verified_by & verified_at
    SELECT count(*) INTO v_invalid_verified_contribs
    FROM public.contributions
    WHERE status = 'verified' AND (verified_by IS NULL OR verified_at IS NULL);
    IF v_invalid_verified_contribs > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % verified contributions lacking verification metadata', v_invalid_verified_contribs;
    END IF;

    -- Check 8: Security invariant - ALL public tables must maintain active RLS
    SELECT count(*) INTO v_disabled_rls
    FROM pg_tables
    WHERE schemaname = 'public' 
      AND rowsecurity = FALSE;
    IF v_disabled_rls > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE INTEGRITY FAILURE: Found % public tables with disabled RLS', v_disabled_rls;
    END IF;

    RAISE NOTICE 'POST-RESTORE INTEGRITY PASSED: All referential, state, and security invariants validated across all public tables.';
END $$;
EOF

echo "Restore and post-restore integrity assertions completed successfully."
