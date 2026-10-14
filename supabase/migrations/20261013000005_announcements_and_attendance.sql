-- File: supabase/migrations/20261013000005_announcements_and_attendance.sql
-- Description: Announcements, attendance events, attendance records, and verified attribution triggers

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    author_id UUID NOT NULL REFERENCES public.members(id),
    published_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_announcements_feed ON public.announcements (is_pinned DESC, published_at DESC);

CREATE OR REPLACE FUNCTION public.validate_announcement_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_caller public.caller_auth_context;
    v_is_service BOOLEAN;
BEGIN
    v_is_service := (current_setting('role', true) = 'service_role');
    IF v_is_service THEN
        RETURN NEW;
    END IF;

    v_caller := public.get_caller_auth();
    IF v_caller.member_id IS NULL OR v_caller.account_status IS NULL OR v_caller.account_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Access Denied: Unauthenticated or inactive identity.';
    END IF;

    IF v_caller.user_role IS NULL OR v_caller.user_role NOT IN ('officer', 'financial_officer', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only Officers or Admins may create or modify announcements.';
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.author_id := v_caller.member_id;
        NEW.published_at := timezone('utc', now());
        NEW.created_at := timezone('utc', now());
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.author_id IS DISTINCT FROM NEW.author_id THEN
            RAISE EXCEPTION 'Illegal Operation: Announcement author_id is immutable.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_announcement_mutation ON public.announcements;
CREATE TRIGGER trg_validate_announcement_mutation
BEFORE INSERT OR UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.validate_announcement_mutation();

CREATE TABLE IF NOT EXISTS public.attendance_events (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    location TEXT,
    created_by UUID NOT NULL REFERENCES public.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE OR REPLACE FUNCTION public.validate_attendance_event_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_caller public.caller_auth_context;
    v_is_service BOOLEAN;
BEGIN
    v_is_service := (current_setting('role', true) = 'service_role');
    IF v_is_service THEN
        RETURN NEW;
    END IF;

    v_caller := public.get_caller_auth();
    IF v_caller.member_id IS NULL OR v_caller.account_status IS NULL OR v_caller.account_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Access Denied: Unauthenticated or inactive identity.';
    END IF;

    IF v_caller.user_role IS NULL OR v_caller.user_role NOT IN ('officer', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only Officers or Admins may create attendance events.';
    END IF;

    NEW.created_by := v_caller.member_id;
    NEW.created_at := timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_attendance_event_insert ON public.attendance_events;
CREATE TRIGGER trg_validate_attendance_event_insert
BEFORE INSERT ON public.attendance_events
FOR EACH ROW
EXECUTE FUNCTION public.validate_attendance_event_insert();

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.attendance_events(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    state public.attendance_state NOT NULL DEFAULT 'present',
    notes TEXT,
    verified_by UUID REFERENCES public.members(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_event_member_attendance UNIQUE (event_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_member ON public.attendance_records (member_id, event_id);

CREATE OR REPLACE FUNCTION public.validate_attendance_record_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_caller public.caller_auth_context;
    v_is_service BOOLEAN;
BEGIN
    v_is_service := (current_setting('role', true) = 'service_role');
    IF v_is_service THEN
        RETURN NEW;
    END IF;

    v_caller := public.get_caller_auth();
    IF v_caller.member_id IS NULL OR v_caller.account_status IS NULL OR v_caller.account_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Access Denied: Unauthenticated or inactive identity.';
    END IF;

    IF v_caller.user_role IS NULL OR v_caller.user_role NOT IN ('officer', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only Officers or Admins may record or verify attendance.';
    END IF;

    NEW.verified_by := v_caller.member_id;
    NEW.recorded_at := timezone('utc', now());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_attendance_record_mutation ON public.attendance_records;
CREATE TRIGGER trg_validate_attendance_record_mutation
BEFORE INSERT OR UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.validate_attendance_record_mutation();
