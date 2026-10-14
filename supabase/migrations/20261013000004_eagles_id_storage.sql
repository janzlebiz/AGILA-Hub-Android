-- File: supabase/migrations/20261013000004_eagles_id_storage.sql
-- Description: Eagles ID cards table, verification status trigger, and verify_eagles_id_side RPC

CREATE TABLE IF NOT EXISTS public.eagles_id_cards (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    member_id UUID NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
    front_storage_path TEXT,
    front_uploaded_at TIMESTAMPTZ,
    back_storage_path TEXT,
    back_uploaded_at TIMESTAMPTZ,
    front_status public.id_verification_status NOT NULL DEFAULT 'not_uploaded',
    back_status public.id_verification_status NOT NULL DEFAULT 'not_uploaded',
    rejection_reason TEXT,
    verified_by UUID REFERENCES public.members(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE OR REPLACE FUNCTION public.protect_eagles_id_verification()
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

    IF NEW.member_id != v_caller.member_id AND (v_caller.user_role IS NULL OR v_caller.user_role NOT IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized: Cannot modify other members Eagles ID record.';
    END IF;

    IF (OLD.front_status IS DISTINCT FROM NEW.front_status OR 
        OLD.back_status IS DISTINCT FROM NEW.back_status OR
        OLD.verified_by IS DISTINCT FROM NEW.verified_by OR
        OLD.verified_at IS DISTINCT FROM NEW.verified_at OR
        OLD.rejection_reason IS DISTINCT FROM NEW.rejection_reason) THEN
        
        IF v_caller.user_role IS NULL OR v_caller.user_role NOT IN ('admin', 'super_admin') THEN
            RAISE EXCEPTION 'Unauthorized: Only administrators may modify verification status.';
        END IF;
    END IF;

    IF (OLD.front_storage_path IS DISTINCT FROM NEW.front_storage_path AND NEW.front_storage_path IS NOT NULL) THEN
        NEW.front_status := 'pending_verification';
        NEW.front_uploaded_at := timezone('utc', now());
    END IF;

    IF (OLD.back_storage_path IS DISTINCT FROM NEW.back_storage_path AND NEW.back_storage_path IS NOT NULL) THEN
        NEW.back_status := 'pending_verification';
        NEW.back_uploaded_at := timezone('utc', now());
    END IF;

    NEW.updated_at := timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_eagles_id_verification ON public.eagles_id_cards;
CREATE TRIGGER trg_protect_eagles_id_verification
BEFORE UPDATE ON public.eagles_id_cards
FOR EACH ROW
EXECUTE FUNCTION public.protect_eagles_id_verification();

CREATE OR REPLACE FUNCTION public.verify_eagles_id_side(
    p_card_id UUID,
    p_side VARCHAR(10),
    p_decision VARCHAR(10),
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_caller public.caller_auth_context;
    v_status public.id_verification_status;
    v_card RECORD;
BEGIN
    v_caller := public.get_caller_auth();

    IF v_caller.member_id IS NULL OR v_caller.account_status IS NULL OR v_caller.account_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Access Denied: Unauthenticated or inactive identity.';
    END IF;

    IF v_caller.user_role IS NULL OR v_caller.user_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Forbidden: Privileged operation restricted to administrators.';
    END IF;

    SELECT * INTO v_card FROM public.eagles_id_cards WHERE id = p_card_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target Eagles ID card record not found.';
    END IF;

    IF p_decision = 'verified' THEN
        v_status := 'verified';
    ELSIF p_decision = 'rejected' THEN
        v_status := 'rejected';
        IF p_rejection_reason IS NULL OR length(trim(p_rejection_reason)) < 5 THEN
            RAISE EXCEPTION 'Rejection requires a descriptive reason (minimum 5 characters).';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid decision: Must be verified or rejected.';
    END IF;

    IF p_side = 'front' THEN
        UPDATE public.eagles_id_cards
        SET front_status = v_status,
            rejection_reason = CASE WHEN p_decision = 'rejected' THEN p_rejection_reason ELSE rejection_reason END,
            verified_by = v_caller.member_id,
            verified_at = timezone('utc', now())
        WHERE id = p_card_id;
    ELSIF p_side = 'back' THEN
        UPDATE public.eagles_id_cards
        SET back_status = v_status,
            rejection_reason = CASE WHEN p_decision = 'rejected' THEN p_rejection_reason ELSE rejection_reason END,
            verified_by = v_caller.member_id,
            verified_at = timezone('utc', now())
        WHERE id = p_card_id;
    ELSE
        RAISE EXCEPTION 'Invalid side parameter: Must be front or back.';
    END IF;

    RETURN jsonb_build_object('success', true, 'card_id', p_card_id, 'side', p_side, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_eagles_id_side(UUID, VARCHAR, VARCHAR, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_eagles_id_side(UUID, VARCHAR, VARCHAR, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_eagles_id_side(UUID, VARCHAR, VARCHAR, TEXT) TO authenticated;
