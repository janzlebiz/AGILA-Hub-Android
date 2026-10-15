-- File: supabase/migrations/20261013000003_invitations_and_auth.sql
-- Description: Member invitations table and server-side token activation engine

CREATE TABLE IF NOT EXISTS public.member_invitations (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES public.members(id),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_invitations_lookup ON public.member_invitations (token_hash, consumed_at, expires_at);

CREATE OR REPLACE FUNCTION public.activate_invited_account(
    p_token VARCHAR(64),
    p_auth_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_token_hash VARCHAR(64);
    v_invitation RECORD;
    v_member RECORD;
    v_auth_email TEXT;
BEGIN
    IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
        RAISE EXCEPTION 'Invalid token parameter.';
    END IF;

    IF p_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'Target Supabase Auth user ID cannot be null.';
    END IF;

    v_token_hash := encode(extensions.digest(p_token::bytea, 'sha256'), 'hex');

    SELECT * INTO v_invitation 
    FROM public.member_invitations
    WHERE token_hash = v_token_hash 
      AND consumed_at IS NULL 
      AND expires_at > timezone('utc', now())
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or previously redeemed invitation token.';
    END IF;

    SELECT * INTO v_member 
    FROM public.members 
    WHERE id = v_invitation.member_id 
    FOR UPDATE;

    IF v_member.status NOT IN ('PENDING_INVITATION', 'INVITED') THEN
        RAISE EXCEPTION 'Member profile is not in an invitable state.';
    END IF;

    SELECT email INTO v_auth_email FROM auth.users WHERE id = p_auth_user_id;
    IF v_auth_email IS NULL THEN
        RAISE EXCEPTION 'Target Supabase Auth user does not exist.';
    END IF;

    IF LOWER(v_auth_email) != LOWER(v_member.email) THEN
        RAISE EXCEPTION 'Authenticated email does not match invitation record.';
    END IF;

    UPDATE public.member_invitations
    SET consumed_at = timezone('utc', now())
    WHERE id = v_invitation.id;

    UPDATE public.members
    SET auth_user_id = p_auth_user_id,
        status = 'ACTIVE',
        updated_at = timezone('utc', now())
    WHERE id = v_member.id;

    RETURN jsonb_build_object(
        'success', true,
        'member_id', v_member.id,
        'email', v_member.email,
        'status', 'ACTIVE'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_invited_account(VARCHAR, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_invited_account(VARCHAR, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.activate_invited_account(VARCHAR, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.activate_invited_account(VARCHAR, UUID) TO service_role;
