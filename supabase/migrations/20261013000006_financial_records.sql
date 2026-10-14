-- File: supabase/migrations/20261013000006_financial_records.sql
-- Description: Hardened contributions & expenses tables, segregated state transitions, and preserved attribution

-- 1. Master Contributions Table with Preserved Verification & Separate Closing Attribution
CREATE TABLE IF NOT EXISTS public.contributions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES public.members(id),
    category public.contribution_category NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    payment_channel public.payment_channel NOT NULL,
    reference_number VARCHAR(100) NOT NULL,
    notes TEXT,
    status public.payment_record_status NOT NULL DEFAULT 'recorded',
    recorded_by UUID NOT NULL REFERENCES public.members(id),
    verified_by UUID REFERENCES public.members(id),
    verified_at TIMESTAMPTZ,
    closed_by UUID REFERENCES public.members(id),     -- Distinct voiding/adjustment actor
    closed_at TIMESTAMPTZ,                            -- Distinct voiding/adjustment timestamp
    void_reason TEXT,
    payment_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_reference_payment UNIQUE (payment_channel, reference_number)
);

CREATE INDEX IF NOT EXISTS idx_contributions_member ON public.contributions (member_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON public.contributions (status, category);

-- 2. Master Expenses Table with Preserved Approval & Separate Reversal Attribution
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    reference_number VARCHAR(100),
    status public.payment_record_status NOT NULL DEFAULT 'recorded',
    recorded_by UUID NOT NULL REFERENCES public.members(id),
    approved_by UUID REFERENCES public.members(id),
    approved_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES public.members(id),   -- Distinct reversal actor
    reversed_at TIMESTAMPTZ,                          -- Distinct reversal timestamp
    reversal_reason TEXT,
    incurred_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Contribution Insert Guard
CREATE OR REPLACE FUNCTION public.validate_contribution_insert()
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

    IF v_caller.user_role IS NULL OR v_caller.user_role NOT IN ('financial_officer', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only Financial Officers or Admins may record contributions.';
    END IF;

    IF NEW.status != 'recorded' THEN
        RAISE EXCEPTION 'Invalid Initial State: Direct insertion of pre-verified or voided records is forbidden. Must start as recorded.';
    END IF;

    NEW.recorded_by := v_caller.member_id;
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
    NEW.closed_by := NULL;
    NEW.closed_at := NULL;
    NEW.void_reason := NULL;
    NEW.created_at := timezone('utc', now());
    NEW.updated_at := timezone('utc', now());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_contribution_insert ON public.contributions;
CREATE TRIGGER trg_validate_contribution_insert
BEFORE INSERT ON public.contributions
FOR EACH ROW
EXECUTE FUNCTION public.validate_contribution_insert();

-- Contribution Update Guard: Preserves verified_by/at during voiding/adjustment
CREATE OR REPLACE FUNCTION public.protect_payment_state_transitions()
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
        RAISE EXCEPTION 'Access Denied: Inactive or unauthenticated caller.';
    END IF;

    -- Strict immutability of recorded_by under ALL circumstances
    IF OLD.recorded_by IS DISTINCT FROM NEW.recorded_by THEN
        RAISE EXCEPTION 'Illegal Operation: recorded_by cannot be altered.';
    END IF;

    -- If status is NOT changing, metadata CANNOT be modified independently
    IF OLD.status = NEW.status THEN
        IF (OLD.verified_by IS DISTINCT FROM NEW.verified_by) OR 
           (OLD.verified_at IS DISTINCT FROM NEW.verified_at) OR 
           (OLD.closed_by IS DISTINCT FROM NEW.closed_by) OR 
           (OLD.closed_at IS DISTINCT FROM NEW.closed_at) OR 
           (OLD.void_reason IS DISTINCT FROM NEW.void_reason) THEN
            RAISE EXCEPTION 'Illegal Operation: Verification metadata cannot be modified without a valid status transition.';
        END IF;
    END IF;

    -- State Transition Matrix
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        IF v_caller.user_role IS NULL OR v_caller.user_role NOT IN ('financial_officer', 'admin', 'super_admin') THEN
            RAISE EXCEPTION 'Unauthorized: Only Financial Officers or Admins may alter payment verification status.';
        END IF;

        IF OLD.status IN ('voided', 'adjusted') THEN
            RAISE EXCEPTION 'Terminal State: Voided or adjusted payments cannot transition to any other status.';
        END IF;

        -- Transition: recorded -> verified
        IF OLD.status = 'recorded' AND NEW.status = 'verified' THEN
            IF OLD.recorded_by = v_caller.member_id AND v_caller.user_role != 'super_admin' THEN
                RAISE EXCEPTION 'Segregation of Duties Violation: The user who recorded the payment cannot verify it.';
            END IF;
            NEW.verified_by := v_caller.member_id;
            NEW.verified_at := timezone('utc', now());
            NEW.closed_by := NULL;
            NEW.closed_at := NULL;
            NEW.void_reason := NULL;

        -- Transition: recorded -> voided (Voided before verification)
        ELSIF OLD.status = 'recorded' AND NEW.status = 'voided' THEN
            IF NEW.void_reason IS NULL OR length(trim(NEW.void_reason)) < 5 THEN
                RAISE EXCEPTION 'Validation Failed: Voiding a payment requires a descriptive void_reason (minimum 5 chars).';
            END IF;
            NEW.verified_by := NULL;
            NEW.verified_at := NULL;
            NEW.closed_by := v_caller.member_id;
            NEW.closed_at := timezone('utc', now());

        -- Transition: verified -> voided (Voided after verification: PRESERVE verified_by/at)
        ELSIF OLD.status = 'verified' AND NEW.status = 'voided' THEN
            IF NEW.void_reason IS NULL OR length(trim(NEW.void_reason)) < 5 THEN
                RAISE EXCEPTION 'Validation Failed: Voiding a verified payment requires a descriptive void_reason (minimum 5 chars).';
            END IF;
            -- PRESERVE original verification attribution
            NEW.verified_by := OLD.verified_by;
            NEW.verified_at := OLD.verified_at;
            NEW.closed_by := v_caller.member_id;
            NEW.closed_at := timezone('utc', now());

        -- Transition: verified -> adjusted (PRESERVE verified_by/at)
        ELSIF OLD.status = 'verified' AND NEW.status = 'adjusted' THEN
            IF NEW.void_reason IS NULL OR length(trim(NEW.void_reason)) < 5 THEN
                RAISE EXCEPTION 'Validation Failed: Adjusting a verified payment requires a descriptive adjustment note in void_reason.';
            END IF;
            -- PRESERVE original verification attribution
            NEW.verified_by := OLD.verified_by;
            NEW.verified_at := OLD.verified_at;
            NEW.closed_by := v_caller.member_id;
            NEW.closed_at := timezone('utc', now());

        ELSE
            RAISE EXCEPTION 'Illegal Status Transition: Transition from % to % is forbidden.', OLD.status, NEW.status;
        END IF;
    END IF;

    -- Core financial fields immutable once verified, voided, or adjusted
    IF OLD.status IN ('verified', 'voided', 'adjusted') AND (
        OLD.amount IS DISTINCT FROM NEW.amount OR 
        OLD.reference_number IS DISTINCT FROM NEW.reference_number OR
        OLD.member_id IS DISTINCT FROM NEW.member_id OR
        OLD.payment_channel IS DISTINCT FROM NEW.payment_channel OR
        OLD.payment_date IS DISTINCT FROM NEW.payment_date
    ) THEN
        RAISE EXCEPTION 'Illegal Operation: Core financial fields are immutable once verified or closed. Void or adjust instead.';
    END IF;

    NEW.updated_at := timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_transitions ON public.contributions;
CREATE TRIGGER trg_protect_payment_transitions
BEFORE UPDATE ON public.contributions
FOR EACH ROW
EXECUTE FUNCTION public.protect_payment_state_transitions();

-- Expense Mutation Guard: Preserves approved_by/at during reversal
CREATE OR REPLACE FUNCTION public.validate_expense_mutation()
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

    IF v_caller.user_role IS NULL OR v_caller.user_role NOT IN ('financial_officer', 'admin', 'super_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only Financial Officers or Admins may record or approve expenses.';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status != 'recorded' THEN
            RAISE EXCEPTION 'Invalid Initial State: Expenses must be recorded before approval.';
        END IF;
        NEW.recorded_by := v_caller.member_id;
        NEW.approved_by := NULL;
        NEW.approved_at := NULL;
        NEW.reversed_by := NULL;
        NEW.reversed_at := NULL;
        NEW.reversal_reason := NULL;
        NEW.created_at := timezone('utc', now());
        NEW.updated_at := timezone('utc', now());

    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.recorded_by IS DISTINCT FROM NEW.recorded_by THEN
            RAISE EXCEPTION 'Illegal Operation: recorded_by is immutable on expenses.';
        END IF;

        IF OLD.status = NEW.status THEN
            IF (OLD.approved_by IS DISTINCT FROM NEW.approved_by) OR 
               (OLD.approved_at IS DISTINCT FROM NEW.approved_at) OR 
               (OLD.reversed_by IS DISTINCT FROM NEW.reversed_by) OR 
               (OLD.reversed_at IS DISTINCT FROM NEW.reversed_at) OR 
               (OLD.reversal_reason IS DISTINCT FROM NEW.reversal_reason) THEN
                RAISE EXCEPTION 'Illegal Operation: Approval metadata cannot be modified independently of a valid status transition.';
            END IF;
        END IF;

        IF OLD.status IS DISTINCT FROM NEW.status THEN
            IF OLD.status = 'voided' THEN
                RAISE EXCEPTION 'Terminal State: Voided expenses cannot transition to any other status.';
            END IF;

            -- Transition: recorded -> verified (Approved)
            IF OLD.status = 'recorded' AND NEW.status = 'verified' THEN
                IF OLD.recorded_by = v_caller.member_id AND v_caller.user_role != 'super_admin' THEN
                    RAISE EXCEPTION 'Segregation of Duties Violation: Expense recorder cannot approve own expense.';
                END IF;
                NEW.approved_by := v_caller.member_id;
                NEW.approved_at := timezone('utc', now());
                NEW.reversed_by := NULL;
                NEW.reversed_at := NULL;
                NEW.reversal_reason := NULL;

            -- Transition: verified -> voided (Reversed after approval: PRESERVE approved_by/at)
            ELSIF OLD.status = 'verified' AND NEW.status = 'voided' THEN
                IF NEW.reversal_reason IS NULL OR length(trim(NEW.reversal_reason)) < 5 THEN
                    RAISE EXCEPTION 'Validation Failed: Reversing an approved expense requires a descriptive reversal_reason (minimum 5 chars).';
                END IF;
                -- PRESERVE original approval attribution
                NEW.approved_by := OLD.approved_by;
                NEW.approved_at := OLD.approved_at;
                NEW.reversed_by := v_caller.member_id;
                NEW.reversed_at := timezone('utc', now());

            -- Transition: recorded -> voided (Cancelled prior to approval)
            ELSIF OLD.status = 'recorded' AND NEW.status = 'voided' THEN
                IF NEW.reversal_reason IS NULL OR length(trim(NEW.reversal_reason)) < 5 THEN
                    RAISE EXCEPTION 'Validation Failed: Voiding an expense requires a descriptive reversal_reason (minimum 5 chars).';
                END IF;
                NEW.approved_by := NULL;
                NEW.approved_at := NULL;
                NEW.reversed_by := v_caller.member_id;
                NEW.reversed_at := timezone('utc', now());

            ELSE
                RAISE EXCEPTION 'Illegal Status Transition: Transition from % to % is forbidden for expenses.', OLD.status, NEW.status;
            END IF;
        END IF;

        IF OLD.status IN ('verified', 'voided') AND (
            OLD.amount IS DISTINCT FROM NEW.amount OR 
            OLD.category IS DISTINCT FROM NEW.category OR 
            OLD.description IS DISTINCT FROM NEW.description OR 
            OLD.incurred_date IS DISTINCT FROM NEW.incurred_date
        ) THEN
            RAISE EXCEPTION 'Illegal Operation: Core expense fields are immutable once approved or voided.';
        END IF;

        NEW.updated_at := timezone('utc', now());
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_expense_mutation ON public.expenses;
CREATE TRIGGER trg_validate_expense_mutation
BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.validate_expense_mutation();
