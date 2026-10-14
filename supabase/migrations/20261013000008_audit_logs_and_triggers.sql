-- File: supabase/migrations/20261013000008_audit_logs_and_triggers.sql
-- Description: Audit logs table, strict per-table allowlist capture function, expenses new_data.category fix, and triggers

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    actor_id UUID REFERENCES public.members(id),
    actor_type VARCHAR(50) NOT NULL DEFAULT 'authenticated_member',
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs (table_name, record_id);

REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated;

-- Master Audit Capture Trigger Function with Strict Per-Table Allowlists and NO Generic Fallback
CREATE OR REPLACE FUNCTION public.process_audit_log_capture()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_type VARCHAR(50);
    v_record_id UUID;
    v_raw_old JSONB := null;
    v_raw_new JSONB := null;
    v_safe_old JSONB := null;
    v_safe_new JSONB := null;
BEGIN
    -- Derive actor identity strictly from trusted server context
    IF current_setting('role', true) = 'service_role' THEN
        v_actor_id := NULL;
        v_actor_type := 'service_role';
    ELSE
        SELECT id INTO v_actor_id FROM public.members WHERE auth_user_id = auth.uid();
        IF v_actor_id IS NOT NULL THEN
            v_actor_type := 'authenticated_member';
        ELSE
            v_actor_type := 'system';
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_record_id := NEW.id;
        v_raw_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_record_id := NEW.id;
        v_raw_old := to_jsonb(OLD);
        v_raw_new := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id;
        v_raw_old := to_jsonb(OLD);
    END IF;

    -- STRICT PER-TABLE ALLOWLISTS: Zero fallback to raw payloads
    IF TG_TABLE_NAME = 'members' THEN
        IF v_raw_old IS NOT NULL THEN
            v_safe_old := jsonb_build_object('id', v_raw_old->'id', 'nickname', v_raw_old->'nickname', 'role', v_raw_old->'role', 'status', v_raw_old->'status', 'club_chapter', v_raw_old->'club_chapter', 'updated_at', v_raw_old->'updated_at');
        END IF;
        IF v_raw_new IS NOT NULL THEN
            v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'nickname', v_raw_new->'nickname', 'role', v_raw_new->'role', 'status', v_raw_new->'status', 'club_chapter', v_raw_new->'club_chapter', 'updated_at', v_raw_new->'updated_at');
        END IF;

    ELSIF TG_TABLE_NAME = 'eagles_id_cards' THEN
        IF v_raw_old IS NOT NULL THEN
            v_safe_old := jsonb_build_object('id', v_raw_old->'id', 'member_id', v_raw_old->'member_id', 'front_status', v_raw_old->'front_status', 'back_status', v_raw_old->'back_status', 'verified_by', v_raw_old->'verified_by', 'verified_at', v_raw_old->'verified_at', 'rejection_reason', v_raw_old->'rejection_reason');
        END IF;
        IF v_raw_new IS NOT NULL THEN
            v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'member_id', v_raw_new->'member_id', 'front_status', v_raw_new->'front_status', 'back_status', v_raw_new->'back_status', 'verified_by', v_raw_new->'verified_by', 'verified_at', v_raw_new->'verified_at', 'rejection_reason', v_raw_new->'rejection_reason');
        END IF;

    ELSIF TG_TABLE_NAME = 'member_invitations' THEN
        IF v_raw_old IS NOT NULL THEN
            v_safe_old := jsonb_build_object('id', v_raw_old->'id', 'member_id', v_raw_old->'member_id', 'invited_by', v_raw_old->'invited_by', 'expires_at', v_raw_old->'expires_at', 'consumed_at', v_raw_old->'consumed_at');
        END IF;
        IF v_raw_new IS NOT NULL THEN
            v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'member_id', v_raw_new->'member_id', 'invited_by', v_raw_new->'invited_by', 'expires_at', v_raw_new->'expires_at', 'consumed_at', v_raw_new->'consumed_at');
        END IF;

    ELSIF TG_TABLE_NAME = 'contributions' THEN
        IF v_raw_old IS NOT NULL THEN
            v_safe_old := jsonb_build_object('id', v_raw_old->'id', 'member_id', v_raw_old->'member_id', 'category', v_raw_old->'category', 'amount', v_raw_old->'amount', 'payment_channel', v_raw_old->'payment_channel', 'status', v_raw_old->'status', 'recorded_by', v_raw_old->'recorded_by', 'verified_by', v_raw_old->'verified_by', 'verified_at', v_raw_old->'verified_at', 'closed_by', v_raw_old->'closed_by', 'closed_at', v_raw_old->'closed_at');
        END IF;
        IF v_raw_new IS NOT NULL THEN
            v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'member_id', v_raw_new->'member_id', 'category', v_raw_new->'category', 'amount', v_raw_new->'amount', 'payment_channel', v_raw_new->'payment_channel', 'status', v_raw_new->'status', 'recorded_by', v_raw_new->'recorded_by', 'verified_by', v_raw_new->'verified_by', 'verified_at', v_raw_new->'verified_at', 'closed_by', v_raw_new->'closed_by', 'closed_at', v_raw_new->'closed_at');
        END IF;

    ELSIF TG_TABLE_NAME = 'expenses' THEN
        IF v_raw_old IS NOT NULL THEN
            v_safe_old := jsonb_build_object('id', v_raw_old->'id', 'category', v_raw_old->'category', 'amount', v_raw_old->'amount', 'description', v_raw_old->'description', 'status', v_raw_old->'status', 'recorded_by', v_raw_old->'recorded_by', 'approved_by', v_raw_old->'approved_by', 'approved_at', v_raw_old->'approved_at', 'reversed_by', v_raw_old->'reversed_by', 'reversed_at', v_raw_old->'reversed_at');
        END IF;
        IF v_raw_new IS NOT NULL THEN
            v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'category', v_raw_new->'category', 'amount', v_raw_new->'amount', 'description', v_raw_new->'description', 'status', v_raw_new->'status', 'recorded_by', v_raw_new->'recorded_by', 'approved_by', v_raw_new->'approved_by', 'approved_at', v_raw_new->'approved_at', 'reversed_by', v_raw_new->'reversed_by', 'reversed_at', v_raw_new->'reversed_at');
        END IF;

    ELSIF TG_TABLE_NAME = 'announcements' THEN
        IF v_raw_old IS NOT NULL THEN
            v_safe_old := jsonb_build_object('id', v_raw_old->'id', 'title', v_raw_old->'title', 'is_pinned', v_raw_old->'is_pinned', 'author_id', v_raw_old->'author_id', 'published_at', v_raw_old->'published_at');
        END IF;
        IF v_raw_new IS NOT NULL THEN
            v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'title', v_raw_new->'title', 'is_pinned', v_raw_new->'is_pinned', 'author_id', v_raw_new->'author_id', 'published_at', v_raw_new->'published_at');
        END IF;

    ELSIF TG_TABLE_NAME = 'attendance_events' THEN
        IF v_raw_old IS NOT NULL THEN
            v_safe_old := jsonb_build_object('id', v_raw_old->'id', 'title', v_raw_old->'title', 'event_date', v_raw_old->'event_date', 'event_type', v_raw_old->'event_type', 'created_by', v_raw_old->'created_by');
        END IF;
        IF v_raw_new IS NOT NULL THEN
            v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'title', v_raw_new->'title', 'event_date', v_raw_new->'event_date', 'event_type', v_raw_new->'event_type', 'created_by', v_raw_new->'created_by');
        END IF;

    ELSIF TG_TABLE_NAME = 'attendance_records' THEN
        IF v_raw_old IS NOT NULL THEN
            v_safe_old := jsonb_build_object('id', v_raw_old->'id', 'event_id', v_raw_old->'event_id', 'member_id', v_raw_old->'member_id', 'state', v_raw_old->'state', 'verified_by', v_raw_old->'verified_by', 'recorded_at', v_raw_old->'recorded_at');
        END IF;
        IF v_raw_new IS NOT NULL THEN
            v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'event_id', v_raw_new->'event_id', 'member_id', v_raw_new->'member_id', 'state', v_raw_new->'state', 'verified_by', v_raw_new->'verified_by', 'recorded_at', v_raw_new->'recorded_at');
        END IF;

    ELSE
        -- Strictly safe minimal record if an unlisted table is attached: record only ID
        v_safe_old := jsonb_build_object('id', v_record_id);
        v_safe_new := jsonb_build_object('id', v_record_id);
    END IF;

    INSERT INTO public.audit_logs (
        actor_id,
        actor_type,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        created_at
    ) VALUES (
        v_actor_id,
        v_actor_type,
        TG_OP,
        TG_TABLE_NAME,
        v_record_id,
        v_safe_old,
        v_safe_new,
        timezone('utc', now())
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_members ON public.members;
CREATE TRIGGER trg_audit_members
AFTER INSERT OR UPDATE OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_capture();

DROP TRIGGER IF EXISTS trg_audit_eagles_id ON public.eagles_id_cards;
CREATE TRIGGER trg_audit_eagles_id
AFTER INSERT OR UPDATE OR DELETE ON public.eagles_id_cards
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_capture();

DROP TRIGGER IF EXISTS trg_audit_contributions ON public.contributions;
CREATE TRIGGER trg_audit_contributions
AFTER INSERT OR UPDATE OR DELETE ON public.contributions
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_capture();

DROP TRIGGER IF EXISTS trg_audit_invitations ON public.member_invitations;
CREATE TRIGGER trg_audit_invitations
AFTER INSERT OR UPDATE ON public.member_invitations
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_capture();

DROP TRIGGER IF EXISTS trg_audit_announcements ON public.announcements;
CREATE TRIGGER trg_audit_announcements
AFTER INSERT OR UPDATE OR DELETE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_capture();

DROP TRIGGER IF EXISTS trg_audit_attendance_events ON public.attendance_events;
CREATE TRIGGER trg_audit_attendance_events
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_events
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_capture();

DROP TRIGGER IF EXISTS trg_audit_attendance_records ON public.attendance_records;
CREATE TRIGGER trg_audit_attendance_records
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_capture();

DROP TRIGGER IF EXISTS trg_audit_expenses ON public.expenses;
CREATE TRIGGER trg_audit_expenses
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_capture();
