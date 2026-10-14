-- File: supabase/migrations/20261013000002_members_and_directory.sql
-- Description: Members table, email lowercase unique index, is_active_member(), get_caller_auth(), sensitive column trigger, and safe directory view

CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    auth_user_id UUID UNIQUE,
    eagles_id_number VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    suffix VARCHAR(20),
    nickname VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    avatar_url TEXT,
    club_chapter VARCHAR(150) NOT NULL DEFAULT 'Bantayog Elite Eagles Club',
    role public.user_role NOT NULL DEFAULT 'member',
    status public.account_status NOT NULL DEFAULT 'PENDING_INVITATION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT fk_auth_user FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_lower ON public.members (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_eagles_id_unique ON public.members (eagles_id_number) WHERE eagles_id_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_status_role ON public.members (status, role);

CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT CASE 
        WHEN auth.uid() IS NULL THEN FALSE
        ELSE EXISTS (
            SELECT 1 FROM public.members 
            WHERE auth_user_id = auth.uid() 
              AND status = 'ACTIVE'
        )
    END;
$$;

REVOKE ALL ON FUNCTION public.is_active_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_member() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_member() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_caller_auth()
RETURNS public.caller_auth_context
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_res public.caller_auth_context;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN ROW(NULL::UUID, NULL::public.user_role, NULL::public.account_status)::public.caller_auth_context;
    END IF;

    SELECT id, role, status 
    INTO v_res.member_id, v_res.user_role, v_res.account_status
    FROM public.members 
    WHERE auth_user_id = auth.uid() 
    LIMIT 1;

    IF v_res.member_id IS NULL THEN
        RETURN ROW(NULL::UUID, NULL::public.user_role, NULL::public.account_status)::public.caller_auth_context;
    END IF;

    RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.get_caller_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_caller_auth() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_caller_auth() TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_member_sensitive_columns()
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
        RAISE EXCEPTION 'Access Denied: Unauthenticated or inactive caller.';
    END IF;

    IF (OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id) AND (v_caller.user_role NOT IN ('super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized: auth_user_id linkage is administrator-controlled.';
    END IF;

    IF (OLD.first_name IS DISTINCT FROM NEW.first_name OR 
        OLD.middle_name IS DISTINCT FROM NEW.middle_name OR 
        OLD.last_name IS DISTINCT FROM NEW.last_name OR 
        OLD.suffix IS DISTINCT FROM NEW.suffix) AND (v_caller.user_role NOT IN ('super_admin', 'admin')) THEN
        RAISE EXCEPTION 'Unauthorized Modification: Legal name fields require administrator verification.';
    END IF;

    IF (OLD.club_chapter IS DISTINCT FROM NEW.club_chapter) AND (v_caller.user_role NOT IN ('super_admin', 'admin')) THEN
        RAISE EXCEPTION 'Unauthorized Modification: Club chapter is administrator-controlled.';
    END IF;

    IF (OLD.role IS DISTINCT FROM NEW.role) AND (v_caller.user_role != 'super_admin') THEN
        RAISE EXCEPTION 'Privilege Escalation Blocked: Caller cannot modify user role.';
    END IF;

    IF (OLD.status IS DISTINCT FROM NEW.status) AND (v_caller.user_role NOT IN ('super_admin', 'admin')) THEN
        RAISE EXCEPTION 'Unauthorized State Change: Caller cannot alter account status.';
    END IF;

    IF (OLD.eagles_id_number IS DISTINCT FROM NEW.eagles_id_number) AND (v_caller.user_role NOT IN ('super_admin', 'admin')) THEN
        RAISE EXCEPTION 'Unauthorized Modification: Eagles ID number is administrator-controlled.';
    END IF;

    IF (OLD.email IS DISTINCT FROM NEW.email) AND (v_caller.user_role NOT IN ('super_admin', 'admin')) THEN
        RAISE EXCEPTION 'Unauthorized Modification: Email modification requires administrative verification.';
    END IF;

    NEW.updated_at := timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_member_columns ON public.members;
CREATE TRIGGER trg_protect_member_columns
BEFORE UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.protect_member_sensitive_columns();

CREATE OR REPLACE VIEW public.member_directory_view AS
SELECT 
    m.id,
    m.first_name,
    m.last_name,
    m.nickname,
    m.avatar_url,
    m.club_chapter,
    m.role,
    m.status,
    CASE 
        WHEN (public.get_caller_auth()).user_role IN ('officer', 'financial_officer', 'admin', 'super_admin') 
        THEN m.phone 
        ELSE NULL 
    END AS phone,
    CASE 
        WHEN (public.get_caller_auth()).user_role IN ('officer', 'financial_officer', 'admin', 'super_admin') 
        THEN m.email 
        ELSE NULL 
    END AS email
FROM public.members m
WHERE m.status = 'ACTIVE' 
  AND public.is_active_member() = TRUE;
