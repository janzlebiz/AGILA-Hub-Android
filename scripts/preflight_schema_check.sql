-- File: scripts/preflight_schema_check.sql
-- AGILA Hub Android — Phase 01 Schema Gate Preflight Validation Script
-- Validates: 3 extensions, 10 core tables, critical columns/types, triggers, functions, indexes, and active RLS

DO $$
DECLARE
    v_missing_items TEXT[] := ARRAY[]::TEXT[];
    v_expected_table TEXT;
    v_expected_tables TEXT[] := ARRAY[
        'members', 'member_invitations', 'eagles_id_cards', 'announcements', 
        'attendance_events', 'attendance_records', 'contributions', 'expenses', 
        'constitution_sections', 'audit_logs'
    ];
BEGIN
    -- 1. Check Required Extensions
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        v_missing_items := array_append(v_missing_items, 'Extension: vector');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        v_missing_items := array_append(v_missing_items, 'Extension: pgcrypto');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        v_missing_items := array_append(v_missing_items, 'Extension: uuid-ossp');
    END IF;

    -- 2. Check All 10 Baseline Core Tables
    FOREACH v_expected_table IN ARRAY v_expected_tables LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_expected_table) THEN
            v_missing_items := array_append(v_missing_items, 'Table: public.' || v_expected_table);
        END IF;
    END LOOP;

    -- 3. Check Critical Columns, Types & Definitions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'auth_user_id' AND data_type = 'uuid'
    ) THEN
        v_missing_items := array_append(v_missing_items, 'Column: public.members.auth_user_id (uuid)');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'contributions' AND column_name = 'closed_by' AND data_type = 'uuid'
    ) THEN
        v_missing_items := array_append(v_missing_items, 'Column: public.contributions.closed_by (uuid)');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'reversed_by' AND data_type = 'uuid'
    ) THEN
        v_missing_items := array_append(v_missing_items, 'Column: public.expenses.reversed_by (uuid)');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'audit_logs' 
          AND column_name = 'actor_type' 
          AND data_type = 'character varying'
          AND character_maximum_length = 50
    ) THEN
        v_missing_items := array_append(v_missing_items, 'Column: public.audit_logs.actor_type (varchar(50))');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'constitution_sections' AND column_name = 'embedding'
    ) THEN
        v_missing_items := array_append(v_missing_items, 'Column: public.constitution_sections.embedding');
    END IF;

    -- 4. Check Critical Integrity Triggers
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'trg_validate_expense_mutation') THEN
        v_missing_items := array_append(v_missing_items, 'Trigger: trg_validate_expense_mutation');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'trg_protect_payment_transitions') THEN
        v_missing_items := array_append(v_missing_items, 'Trigger: trg_protect_payment_transitions');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'trg_protect_member_columns') THEN
        v_missing_items := array_append(v_missing_items, 'Trigger: trg_protect_member_columns');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'trg_validate_attendance_record_mutation') THEN
        v_missing_items := array_append(v_missing_items, 'Trigger: trg_validate_attendance_record_mutation');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'trg_audit_expenses') THEN
        v_missing_items := array_append(v_missing_items, 'Trigger: trg_audit_expenses');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'trg_audit_members') THEN
        v_missing_items := array_append(v_missing_items, 'Trigger: trg_audit_members');
    END IF;

    -- 5. Check Critical Security Functions
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_caller_auth') THEN
        v_missing_items := array_append(v_missing_items, 'Function: public.get_caller_auth');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'match_constitution_sections') THEN
        v_missing_items := array_append(v_missing_items, 'Function: public.match_constitution_sections');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'process_audit_log_capture') THEN
        v_missing_items := array_append(v_missing_items, 'Function: public.process_audit_log_capture');
    END IF;

    -- 6. Check Critical Indexes & Unique Constraints (verifying names, uniqueness, and indexed expressions/columns)
    -- Check 6a: Unique index on LOWER(email) in public.members (asserts uniqueness and expression)
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_indexes pi ON pi.schemaname = n.nspname AND pi.tablename = t.relname AND pi.indexname = c.relname
        WHERE n.nspname = 'public'
          AND t.relname = 'members'
          AND c.relname = 'idx_members_email_lower'
          AND i.indisunique = TRUE
          AND pi.indexdef ILIKE '%lower(%email%)%'
    ) THEN
        v_missing_items := array_append(v_missing_items, 'Index: public.members.idx_members_email_lower (UNIQUE on LOWER(email))');
    END IF;

    -- Check 6b: Unique constraint on public.contributions (payment_channel, reference_number)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'contributions'
          AND con.conname = 'uq_reference_payment'
          AND con.contype = 'u'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_indexes pi ON pi.schemaname = n.nspname AND pi.tablename = t.relname AND pi.indexname = c.relname
        WHERE n.nspname = 'public'
          AND t.relname = 'contributions'
          AND c.relname = 'uq_reference_payment'
          AND i.indisunique = TRUE
          AND pi.indexdef ILIKE '%payment_channel%reference_number%'
    ) THEN
        v_missing_items := array_append(v_missing_items, 'Constraint: public.contributions.uq_reference_payment (UNIQUE on payment_channel, reference_number)');
    END IF;

    -- Check 6c: HNSW Cosine Similarity Index on public.constitution_sections (asserts table, index name, HNSW access method, and embedding with vector_cosine_ops)
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes
        WHERE schemaname = 'public' 
          AND tablename = 'constitution_sections' 
          AND indexname = 'idx_constitution_embedding_hnsw'
          AND indexdef ILIKE '%hnsw%'
          AND indexdef ILIKE '%(embedding%vector_cosine_ops)%'
    ) THEN
        v_missing_items := array_append(v_missing_items, 'Index: public.constitution_sections.idx_constitution_embedding_hnsw (HNSW on embedding with vector_cosine_ops)');
    END IF;

    -- 7. Check Active Row Level Security on ALL 10 Public Tables
    FOREACH v_expected_table IN ARRAY v_expected_tables LOOP
        IF EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' AND tablename = v_expected_table AND rowsecurity = FALSE
        ) THEN
            v_missing_items := array_append(v_missing_items, 'RLS disabled on table: public.' || v_expected_table);
        END IF;
    END LOOP;

    IF array_length(v_missing_items, 1) > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT VALIDATION FAILED: Missing baseline objects: %', array_to_string(v_missing_items, ', ');
    END IF;

    RAISE NOTICE 'PREFLIGHT VALIDATION PASSED: All 10 tables, 3 extensions, columns, triggers, functions, unique/HNSW indexes, and active RLS verified successfully.';
END $$;
