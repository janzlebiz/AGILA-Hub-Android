# AGILA Hub Android — Master Architecture & Phase 01 Implementation Plan
**Document Version:** Revision 4.0 (Phase 01 Implementation & Foundation Verification Complete)  
**Status:** Phase 01 Scope Implemented on Disk; 59/59 Automated Tests Verified (Release Gate 01 Passed)  
**Target Platform:** Android (React Native + Expo SDK 52+ + TypeScript)  
**Backend:** Supabase (PostgreSQL 16, GoTrue Auth, Storage, Edge Functions, pgvector)  
**Web Admin:** React (Vite / Next.js) on Vercel *(Desktop Administration Only — NOT an Android Builder)*  
**Knowledge Authority:** TFOE-PE Constitution (`https://e-constitution.tfoe-peinc.com/`)

---

## 1. Executive Summary & Operational Boundaries

AGILA Hub Android is an independent, native mobile platform for The Fraternal Order of Eagles – Philippine Eagles (TFOE-PE, Inc.) and Bantayog Elite Eagles Club (BEEC).

### 1.1 Inviolable Architectural Constraints
1. **Isolated Infrastructure:** Greenfield, standalone infrastructure. Dedicated GitHub repository, independent Supabase project, and isolated Vercel deployment. Zero shared credentials, databases, or runtime resources with legacy systems.
2. **Android-First Target:** React Native with Expo and TypeScript compiled via Expo Application Services (EAS Build) into standalone Android APK (QA/preview) and AAB (store) binaries. Vercel hosts only the desktop administrative web portal; it does not compile or distribute Android artifacts.
3. **Distribution Dependencies:** Google Play Store registration is a Phase 07 release dependency, not a development prerequisite. Apple Developer accounts are excluded.
4. **Account & Registration Governance:** Invitation-only activation. Public self-registration is permanently disabled at the Supabase Auth gateway. Administrators create canonical member records, and prospective users activate their accounts via single-use cryptographic invitation tokens.
5. **Financial Recording Scope:** The platform records payments conducted externally (cash, bank transfer, e-wallets) with text-only reference numbers. **Strictly zero payment gateways, online checkouts, or receipt-file uploads are required or implemented.**
6. **Constitution RAG Governance:** Semantic retrieval over chunked TFOE-PE constitutional text stored in `pgvector` (`vector(768)`). The assistant answers solely with citations (Chapter, Article, Section) and abstains when evidence is missing or below the server-enforced minimum similarity threshold ($0.68$).
7. **Phase 01 Execution & Governance Guard:** **Phase 01 core database migrations (`001` through `009`), preflight validation script (`scripts/preflight_schema_check.sql`), and restore database runbook (`scripts/restore_database.sh`) have been materialized on disk. 59 automated test assertions in `scripts/verify_phase01.ts` have been executed with 100% PASS.** No production infrastructure provisioning or live cloud database migrations were executed during Phase 01 in accordance with operational safeguards. All cloud runtime acceptance tests remain marked NOT EXECUTED for their designated cloud release gates.

---

## 2. Threat Model & Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       TRUST BOUNDARY 0                                      │
│                  Android Mobile Client (React Native) & Public Browsers                     │
│   - Holds EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY                        │
│   - Client memory, state, and local storage are untrusted                                   │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │ HTTPS / TLS 1.3
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       TRUST BOUNDARY 1                                      │
│                               Supabase Platform & API Gateway                               │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  ┌─────────────────────────────┐ │
│  │   GoTrue Auth Gateway   │  │   Deno Edge Functions    │  │    Storage Service (S3)     │ │
│  │ - Public signup BLOCKED │  │ - Service-role worker    │  │ - Private encrypted bucket │ │
│  │ - Issues signed JWTs    │  │ - Token verification/hash│  │ - 15-minute signed URLs     │ │
│  └────────────┬────────────┘  └─────────────┬────────────┘  └──────────────┬──────────────┘ │
│               │                             │                              │                │
│               │ JWT (sub = auth.uid())      │ Privileged DB Client         │ Signed URL Read│
│               ▼                             ▼                              ▼                │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                                     TRUST BOUNDARY 2                                    │ │
│ │                            PostgreSQL 16 Database Engine                                │ │
│ │  - Schema isolation: public, auth, storage, extensions                                  │ │
│ │  - RLS enforces public.is_active_member() on EVERY query                                │ │
│ │  - BEFORE UPDATE/INSERT triggers enforce identity, state machines, and immutability     │ │
│ │  - SECURITY DEFINER functions set search_path = pg_catalog, public, extensions          │ │
│ │  - Immutable audit triggers log mutations with strict allowlists & server attribution   │ │
│ │  - pgvector with HNSW index executes semantic retrieval over 768-dim embeddings         │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Product Requirements & Android Screen Specifications

The Android mobile client features 9 core screens built on the minimalist Liquid Glass design system.

### 3.1 Screen Specifications

| # | Screen Name | Visual Layout & Information | Permitted Actions | Loading / Empty / Error States | Authorization & Data Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Splash Screen** | Official `AGILA Hub.png` centered on glass canvas. App title, version, build number, activity indicator. | Automatic navigation: validates stored token, directs to Home (if Active), Activation (if Invited), or Login. | **Loading:** Activity spinner.<br>**Empty:** N/A.<br>**Error:** "Network error, tap to retry" button. | Public.<br>Data: Local SecureStore. |
| **2** | **Home Screen** | Time-based greeting, layered BEEC crest (`BEEC_vector.png`) with circular avatar overlay, member status pill, announcements carousel, dues summary card. | Pull-to-refresh, tap announcement for detail, navigate to quick actions. | **Loading:** Glass shimmer placeholders.<br>**Empty:** Welcome onboarding card.<br>**Error:** Retry toast banner. | Requires `ACTIVE` member.<br>Data: `members`, `announcements`, `contributions`. |
| **3** | **Announcements Screen** | Reverse-chronological list of circulars. Title, author, publish date, pinned badge, rich-text body, category tag. | Read announcements, search by keyword, filter by pinned status. | **Loading:** Card skeleton feed.<br>**Empty:** "No announcements published."<br>**Error:** Offline cached view with alert. | Requires `ACTIVE` member.<br>Data: `public.announcements`. |
| **4** | **Attendance Screen** | Meeting/event calendar list, attendance status badges (Present, Absent, Excused), event location, date, attendance percentage. | View meeting details, view verified attendance record, request formal excuse. | **Loading:** Calendar skeleton.<br>**Empty:** "No upcoming events scheduled."<br>**Error:** "Unable to load attendance." | Requires `ACTIVE` member.<br>Data: `attendance_events`, `attendance_records`. |
| **5** | **Contributions Screen** | Authoritative dues ledger: payment date, category (Monthly Dues, Project Fund, Relief), amount, payment channel, text reference number, status. | Filter by fiscal year/category, export text ledger summary. *(Zero upload or payment buttons).* | **Loading:** Row skeleton list.<br>**Empty:** "No contribution history recorded."<br>**Error:** "Failed to sync ledger." | Requires `ACTIVE` member.<br>Data: `public.contributions` (own records only). |
| **6** | **Officer Dashboard** | Operational metrics: meeting quorum count, attendance roster, pending member onboarding, announcement drafting tool. | Mark event attendance (Present/Excused), publish announcements, view non-sensitive member roster. | **Loading:** Metric card skeletons.<br>**Empty:** "No pending tasks."<br>**Error:** "Insufficient officer privileges." | Restricted to `officer`, `admin`, `super_admin`.<br>Data: `attendance_records`, `member_directory_view`. |
| **7** | **Financial Dashboard** | Total contributions collected, categorized breakdowns, pending payment records awaiting verification, expense summaries. | Review recorded payments, verify/void payment entries, filter by date range. *(Zero online checkout).* | **Loading:** Chart/metric skeleton.<br>**Empty:** "No financial records in range."<br>**Error:** "Restricted to Financial Officers." | Restricted to `financial_officer`, `admin`, `super_admin`.<br>Data: `contributions`, `expenses`. |
| **8** | **Documents Screen** | Digital Eagles ID card view (Front/Back toggle), status pill (Pending, Verified, Rejected), Constitution RAG search drawer and chat assistant. | Upload/replace Front ID, upload/replace Back ID independently, query Constitution RAG assistant with citations. | **Loading:** Card blur placeholder.<br>**Empty:** "Upload Eagles ID to activate card."<br>**Error:** "Document retrieval failed." | Requires `ACTIVE` member.<br>Data: `eagles_id_cards`, `constitution_sections`. |
| **9** | **Profile & Settings Screen** | Profile picture, full legal name, Eagles ID number (read-only), chapter, verified phone, editable nickname, notification toggles, theme, sign out. | Edit nickname, update profile photo, change password, toggle biometrics, log out. | **Loading:** Avatar shimmer.<br>**Empty:** N/A.<br>**Error:** "Update failed." | Requires `ACTIVE` member.<br>Data: `public.members`. |

### 3.2 Branding, Asset Layering & Greeting Logic
*   **Splash Screen Asset:** Uses unaltered `AGILA Hub.png` rendered with `resizeMode="contain"` locked to a $1:1$ bounding box ($240\times 240\,\text{dp}$) centered in the upper viewport.
*   **Home Screen Crest Layering:**
    *   Base Layer: `BEEC_vector.png` ($140\times 140\,\text{dp}$) rendered with subtle glow (`opacity: 0.95`).
    *   Top Layer: Member profile avatar ($84\times 84\,\text{dp}$) centered directly over the center medallion of the BEEC crest.
    *   Avatar Cropping: Pure circular mask (`borderRadius: 42`), framed by a $2\,\text{dp}$ glass border (`borderColor: rgba(255, 255, 255, 0.85)`).
    *   Fallback Behavior: When no profile photo exists, render a frosted circular badge with the member's two-letter initials in high-contrast Eagle Blue.
*   **Time-Based Greeting Specifications:**
    *   `05:00:00` to `11:59:59` local device time: `"Good morning Kuya [nickname]"`
    *   `12:00:00` to `17:59:59` local device time: `"Good afternoon Kuya [nickname]"`
    *   `18:00:00` to `04:59:59` local device time: `"Good evening Kuya [nickname]"`
    *   Fallback Rule: If `nickname` is null or empty, fallback strictly to `"Kuya [first_name]"`.

---

## 4. Role & Permission Matrix

| Operational Domain | Member | Officer | Financial Officer | Administrator | Super Administrator |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Own Profile & Nickname** | Read / Edit Nickname | Read / Edit Nickname | Read / Edit Nickname | Read / Edit Nickname | Read / Edit Nickname |
| **Legal Identity & Chapter** | Read Only | Read Only | Read Only | Edit (Admin Controlled) | Full Edit |
| **Member Directory View** | Read Public (Name/Chapter) | Read Public + Contact | Read Public + Contact | Full Member Read | Full Member Read |
| **Full Member Management** | Denied | Denied | Denied | Create / Edit / Suspend | Full Create / Edit / Delete |
| **Admin Role Assignment** | Denied | Denied | Denied | Denied | Assign All Roles |
| **Eagles ID Front/Back Upload** | Upload / Replace Own | Upload / Replace Own | Upload / Replace Own | Upload / Replace Own | Upload / Replace Own |
| **Eagles ID Verification** | Denied | Denied | Denied | Verify / Reject | Verify / Reject |
| **Announcements** | Read Published | Create / Edit / Delete Own | Create / Edit / Delete Own | Full Manage | Full Manage |
| **Attendance Events** | View Calendar | Create / Edit Events | View Calendar | Full Manage | Full Manage |
| **Attendance Roster** | View Own Records | Mark / Verify Status | View All Records | Full Manage | Full Manage |
| **Contributions (Read)** | Read Own Records | Read Own Records | Read All Ledger | Read All Ledger | Read All Ledger |
| **Record External Payment** | Denied | Denied | Create (Initial 'recorded') | Create Record | Create Record |
| **Payment Verification/Void** | Denied | Denied | Verify / Void (Other's entry) | Verify / Void Record | Verify / Void Record |
| **Club Expenses** | Denied | Denied | Read & Manage | Read & Manage | Read & Manage |
| **Constitution RAG Queries**| Execute Query | Execute Query | Execute Query | Execute Query | Execute Query |
| **Constitution Ingestion** | Denied | Denied | Denied | Trigger Re-index | Trigger Re-index |
| **Audit Logs Inspection** | Denied | Denied | Denied | Read Logs | Read Logs / Export |

---

## 5. Complete, Validated & Executable SQL Migrations (001 through 009)

### Migration 001: Core Types & Extensions
```sql
-- File: supabase/migrations/20261013000001_core_types_and_extensions.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM (
        'member',
        'officer',
        'financial_officer',
        'admin',
        'super_admin'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.account_status AS ENUM (
        'PENDING_INVITATION',
        'INVITED',
        'ACTIVE',
        'SUSPENDED',
        'DEACTIVATED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.id_verification_status AS ENUM (
        'not_uploaded',
        'pending_verification',
        'verified',
        'rejected'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.contribution_category AS ENUM (
        'monthly_dues',
        'annual_dues',
        'project_fund',
        'calamity_relief',
        'membership_fee',
        'special_assessment'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_channel AS ENUM (
        'cash',
        'bank_transfer',
        'gcash',
        'maya',
        'check',
        'other'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_record_status AS ENUM (
        'recorded',
        'verified',
        'voided',
        'adjusted'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.attendance_state AS ENUM (
        'present',
        'absent',
        'excused'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.caller_auth_context AS (
        member_id UUID,
        user_role public.user_role,
        account_status public.account_status
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;
```

---

### Migration 002: Members, Member Identity Protection & Safe Directory View
```sql
-- File: supabase/migrations/20261013000002_members_and_directory.sql

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
```

---

### Migration 003: Member Invitations & Server-Side Token Engine
```sql
-- File: supabase/migrations/20261013000003_invitations_and_auth.sql

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
SET search_path = pg_catalog, public, extensions
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
```

---

### Migration 004: Hardened Eagles ID Verification & Independent Storage
```sql
-- File: supabase/migrations/20261013000004_eagles_id_storage.sql

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
```

---

### Migration 005: Announcements & Attendance with Attendance Attribution Protection
```sql
-- File: supabase/migrations/20261013000005_announcements_and_attendance.sql

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
```

---

### Migration 006: Hardened Expense & Contribution Attribution Protection
```sql
-- File: supabase/migrations/20261013000006_financial_records.sql

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
```

---

### Migration 007: Constitution RAG Vector Store & Server-Enforced 0.68 Threshold
```sql
-- File: supabase/migrations/20261013000007_constitution_rag.sql

CREATE TABLE IF NOT EXISTS public.constitution_versions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    version_tag VARCHAR(50) NOT NULL UNIQUE,
    effective_date DATE,
    source_url TEXT NOT NULL,
    source_sha256 VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.constitution_sections (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.constitution_versions(id) ON DELETE CASCADE,
    chapter_number INT,
    chapter_title VARCHAR(255),
    article_number INT NOT NULL,
    article_title VARCHAR(255) NOT NULL,
    section_number INT NOT NULL,
    section_title VARCHAR(255),
    content TEXT NOT NULL,
    chunk_index INT NOT NULL DEFAULT 0,
    token_count INT NOT NULL,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_constitution_embedding_hnsw 
ON public.constitution_sections 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE OR REPLACE FUNCTION public.match_constitution_sections(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.68,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    chapter_number INT,
    chapter_title VARCHAR,
    article_number INT,
    article_title VARCHAR,
    section_number INT,
    section_title VARCHAR,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_enforced_threshold FLOAT;
    v_clamped_count INT;
BEGIN
    IF NOT (public.is_active_member()) THEN
        RAISE EXCEPTION 'Access Denied: Inactive or unauthenticated account.';
    END IF;

    -- SERVER-ENFORCED THRESHOLD FLOOR: Clients CANNOT lower threshold below 0.68
    v_enforced_threshold := GREATEST(0.68, LEAST(1.00, COALESCE(match_threshold, 0.68)));
    v_clamped_count := GREATEST(1, LEAST(10, COALESCE(match_count, 5)));

    RETURN QUERY
    SELECT 
        cs.id,
        cs.chapter_number,
        cs.chapter_title,
        cs.article_number,
        cs.article_title,
        cs.section_number,
        cs.section_title,
        cs.content,
        (1 - (cs.embedding <=> query_embedding))::FLOAT AS similarity
    FROM public.constitution_sections cs
    JOIN public.constitution_versions cv ON cv.id = cs.version_id
    WHERE cv.is_active = TRUE
      AND (1 - (cs.embedding <=> query_embedding)) >= v_enforced_threshold
    ORDER BY cs.embedding <=> query_embedding ASC
    LIMIT v_clamped_count;
END;
$$;

REVOKE ALL ON FUNCTION public.match_constitution_sections(vector, FLOAT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_constitution_sections(vector, FLOAT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_constitution_sections(vector, FLOAT, INT) TO authenticated;
```

---

### Migration 008: Strict Per-Table Allowlist Audit Logging with Zero Fallback Leakage
```sql
-- File: supabase/migrations/20261013000008_audit_logs_and_triggers.sql

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
```

---

### Migration 009: Complete RLS Policies, Grants & Storage Lifecycle
```sql
-- File: supabase/migrations/20261013000009_rls_and_storage_policies.sql

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eagles_id_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_sections ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.members TO authenticated;
GRANT SELECT ON public.member_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eagles_id_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.contributions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.constitution_versions TO authenticated;
GRANT SELECT ON public.constitution_sections TO authenticated;
GRANT SELECT ON public.member_directory_view TO authenticated;

-- RLS: members
DROP POLICY IF EXISTS "members_read_policy" ON public.members;
CREATE POLICY "members_read_policy" ON public.members
    FOR SELECT TO authenticated
    USING (
        public.is_active_member() AND (
            auth_user_id = auth.uid() OR
            (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "members_self_update_policy" ON public.members;
CREATE POLICY "members_self_update_policy" ON public.members
    FOR UPDATE TO authenticated
    USING (public.is_active_member() AND auth_user_id = auth.uid())
    WITH CHECK (public.is_active_member() AND auth_user_id = auth.uid());

-- RLS: member_invitations
DROP POLICY IF EXISTS "invitations_admin_select" ON public.member_invitations;
CREATE POLICY "invitations_admin_select" ON public.member_invitations
    FOR SELECT TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('admin', 'super_admin'));

-- RLS: eagles_id_cards
DROP POLICY IF EXISTS "eagles_id_select" ON public.eagles_id_cards;
CREATE POLICY "eagles_id_select" ON public.eagles_id_cards
    FOR SELECT TO authenticated
    USING (
        public.is_active_member() AND (
            member_id = (public.get_caller_auth()).member_id OR
            (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "eagles_id_insert" ON public.eagles_id_cards;
CREATE POLICY "eagles_id_insert" ON public.eagles_id_cards
    FOR INSERT TO authenticated
    WITH CHECK (public.is_active_member() AND member_id = (public.get_caller_auth()).member_id);

DROP POLICY IF EXISTS "eagles_id_update" ON public.eagles_id_cards;
CREATE POLICY "eagles_id_update" ON public.eagles_id_cards
    FOR UPDATE TO authenticated
    USING (
        public.is_active_member() AND (
            member_id = (public.get_caller_auth()).member_id OR
            (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
        )
    )
    WITH CHECK (
        public.is_active_member() AND (
            member_id = (public.get_caller_auth()).member_id OR
            (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "eagles_id_delete" ON public.eagles_id_cards;
CREATE POLICY "eagles_id_delete" ON public.eagles_id_cards
    FOR DELETE TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('admin', 'super_admin'));

-- RLS: announcements
DROP POLICY IF EXISTS "announcements_read_active" ON public.announcements;
CREATE POLICY "announcements_read_active" ON public.announcements
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS "announcements_write_officers" ON public.announcements;
CREATE POLICY "announcements_write_officers" ON public.announcements
    FOR INSERT TO authenticated
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('officer', 'financial_officer', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "announcements_update_authors" ON public.announcements;
CREATE POLICY "announcements_update_authors" ON public.announcements
    FOR UPDATE TO authenticated
    USING (public.is_active_member() AND (author_id = (public.get_caller_auth()).member_id OR (public.get_caller_auth()).user_role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "announcements_delete_authors" ON public.announcements;
CREATE POLICY "announcements_delete_authors" ON public.announcements
    FOR DELETE TO authenticated
    USING (public.is_active_member() AND (author_id = (public.get_caller_auth()).member_id OR (public.get_caller_auth()).user_role IN ('admin', 'super_admin')));

-- RLS: attendance_events
DROP POLICY IF EXISTS "events_read_active" ON public.attendance_events;
CREATE POLICY "events_read_active" ON public.attendance_events
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS "events_write_officers" ON public.attendance_events;
CREATE POLICY "events_write_officers" ON public.attendance_events
    FOR ALL TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('officer', 'admin', 'super_admin'))
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('officer', 'admin', 'super_admin'));

-- RLS: attendance_records
DROP POLICY IF EXISTS "attendance_read" ON public.attendance_records;
CREATE POLICY "attendance_read" ON public.attendance_records
    FOR SELECT TO authenticated
    USING (
        public.is_active_member() AND (
            member_id = (public.get_caller_auth()).member_id OR
            (public.get_caller_auth()).user_role IN ('officer', 'admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "attendance_write_officers" ON public.attendance_records;
CREATE POLICY "attendance_write_officers" ON public.attendance_records
    FOR ALL TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('officer', 'admin', 'super_admin'))
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('officer', 'admin', 'super_admin'));

-- RLS: contributions
DROP POLICY IF EXISTS "contributions_read" ON public.contributions;
CREATE POLICY "contributions_read" ON public.contributions
    FOR SELECT TO authenticated
    USING (
        public.is_active_member() AND (
            member_id = (public.get_caller_auth()).member_id OR
            (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "contributions_write_finance" ON public.contributions;
CREATE POLICY "contributions_write_finance" ON public.contributions
    FOR INSERT TO authenticated
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "contributions_update_finance" ON public.contributions;
CREATE POLICY "contributions_update_finance" ON public.contributions
    FOR UPDATE TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'))
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

-- RLS: expenses
DROP POLICY IF EXISTS "expenses_read_finance" ON public.expenses;
CREATE POLICY "expenses_read_finance" ON public.expenses
    FOR SELECT TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "expenses_write_finance" ON public.expenses;
CREATE POLICY "expenses_write_finance" ON public.expenses
    FOR INSERT TO authenticated
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "expenses_update_finance" ON public.expenses;
CREATE POLICY "expenses_update_finance" ON public.expenses
    FOR UPDATE TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'))
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "expenses_delete_finance" ON public.expenses;
CREATE POLICY "expenses_delete_finance" ON public.expenses
    FOR DELETE TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

-- RLS: audit_logs
DROP POLICY IF EXISTS "audit_logs_read_admins" ON public.audit_logs;
CREATE POLICY "audit_logs_read_admins" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('admin', 'super_admin'));

-- RLS: constitution_versions & sections
DROP POLICY IF EXISTS "constitution_read_active" ON public.constitution_versions;
CREATE POLICY "constitution_read_active" ON public.constitution_versions
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS "sections_read_active" ON public.constitution_sections;
CREATE POLICY "sections_read_active" ON public.constitution_sections
    FOR SELECT TO authenticated
    USING (public.is_active_member());

-- Supabase Storage CRUD Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'private-eagles-documents',
    'private-eagles-documents',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png']
) ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "storage_owner_upload" ON storage.objects;
CREATE POLICY "storage_owner_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'private-eagles-documents' AND
    public.is_active_member() AND
    (storage.foldername(name))[1] = 'eagles-ids' AND
    (storage.foldername(name))[2] = (public.get_caller_auth()).member_id::text
);

DROP POLICY IF EXISTS "storage_owner_and_admin_read" ON storage.objects;
CREATE POLICY "storage_owner_and_admin_read"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'private-eagles-documents' AND
    public.is_active_member() AND
    (storage.foldername(name))[1] = 'eagles-ids' AND
    (
        (storage.foldername(name))[2] = (public.get_caller_auth()).member_id::text OR
        (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
    )
);

DROP POLICY IF EXISTS "storage_owner_update" ON storage.objects;
CREATE POLICY "storage_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'private-eagles-documents' AND
    public.is_active_member() AND
    (storage.foldername(name))[1] = 'eagles-ids' AND
    (storage.foldername(name))[2] = (public.get_caller_auth()).member_id::text
)
WITH CHECK (
    bucket_id = 'private-eagles-documents' AND
    public.is_active_member() AND
    (storage.foldername(name))[1] = 'eagles-ids' AND
    (storage.foldername(name))[2] = (public.get_caller_auth()).member_id::text
);

DROP POLICY IF EXISTS "storage_owner_and_admin_delete" ON storage.objects;
CREATE POLICY "storage_owner_and_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'private-eagles-documents' AND
    public.is_active_member() AND
    (storage.foldername(name))[1] = 'eagles-ids' AND
    (
        (storage.foldername(name))[2] = (public.get_caller_auth()).member_id::text OR
        (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
    )
);
```

---

## 6. Constitution RAG Calibration, Benchmark Suite & Evaluation Methodology

### 6.1 Source Ingestion & Provenance Archival
*   **Target Portal:** `https://e-constitution.tfoe-peinc.com/`
*   **Verification Gate:** Phase 05 begins with an automated probe to verify whether the source HTML exposes all Chapter, Article, and Section text without interactive JavaScript gates.
*   **Fallback Authorization:** If the web portal prevents verified extraction, leadership must provide the signed official PDF before chunking begins.
*   **Provenance Archival:** Raw extracted text is hashed (SHA-256) and stored in `public.constitution_versions`.

### 6.2 Status of the 0.68 Similarity Threshold
*   **Current Status:** **CONFIGURED INITIAL THRESHOLD (UNVALIDATED)**.
*   **Specification Guard:** In `public.match_constitution_sections`, the server strictly enforces `v_enforced_threshold := GREATEST(0.68, LEAST(1.00, COALESCE(match_threshold, 0.68)))`. Clients cannot pass a lower threshold to force matches.
*   **Controlled Test Specification:**
    - Test Fixture A ($0.82 \ge 0.68$, client requests $0.50$): Candidate returned with score $0.82$.
    - Test Fixture B ($0.6800$, client requests $0.50$): Candidate returned (boundary match).
    - Test Fixture C ($0.6799$, client requests $0.50$): Candidate excluded by server-side floor.
    - Test Fixture D (All candidates $\le 0.60$): Zero rows returned, server executes immediate abstention response.

---

## 7. Environments, Hardened Backup/Restore Runbook & Recovery Verification

### 7.1 Environment Isolation Matrix

| Parameter | Development | Staging | Production |
| :--- | :--- | :--- | :--- |
| **Supabase Project** | `agila-hub-dev` | `agila-hub-staging` | `agila-hub-prod` |
| **Mobile Build Channel** | Expo Go / Local Emulator | EAS Internal Preview APK | Signed Release AAB / APK |
| **Web Admin Host** | `http://localhost:5173` | `staging-admin.agilahub.org` (Vercel) | `admin.agilahub.org` (Vercel) |
| **Database Migrations** | `supabase db reset` | GitHub Actions CI (`supabase db push`) | Release Tagged CD Pipeline |
| **Secrets Storage** | `.env.local` (Git-ignored) | GitHub Secrets / Supabase Vault | Encrypted Hardware Vault / Vercel Prod |

### 7.2 Hardened Restore Runbook & Isolated Target Protection
*   **RPO Reconciled Analysis:**
    *   **Supabase Pro / Team Tier (with PITR Add-On):** Continuous physical Write-Ahead Log (WAL) archiving with a **7-day retention window**. RPO is $\le 1\,\text{minute}$. **Meets the $\le 1\,\text{hour}$ RPO requirement.**
    *   **Supabase Free / Dev Tier:** Provides only automated daily logical backups. RPO is $\le 24\,\text{hours}$. **Fails the $\le 1\,\text{hour}$ RPO requirement.**
*   **Restoration Safety & Invariant Rules:**
    1. **Authoritative Project Identity & Multi-Layer Endpoint Isolation:** Connecting to a target database requires authoritative target-project and endpoint identity verification before connecting:
       - **Mandatory Explicit Target Environment (`TARGET_ENV`):** `TARGET_ENV` must be explicitly declared and set to either `staging` or `development`. No implicit defaults are allowed; if unset or empty, the script aborts immediately with exit code 1. Production restores are unconditionally blocked.
       - **Authoritative Target Identity & Project-to-Endpoint Mapping:** The script asserts `TARGET_PROJECT_ID` and `PROD_PROJECT_ID` are set, non-empty, and distinct (`TARGET_PROJECT_ID != PROD_PROJECT_ID`). It authoritatively validates that `TARGET_DB_HOST` matches the trusted project-to-endpoint naming convention (`EXPECTED_TARGET_HOST="db.${TARGET_PROJECT_ID}.supabase.co"`). Any mismatch between declared project ID and target hostname halts execution prior to connecting.
       - **Direct Hostname Comparison:** `TARGET_HOST` is directly compared against authoritative `PROD_DB_HOST` (`TARGET_HOST != PROD_DB_HOST`).
       - **Secondary Defense-in-Depth (Fail-Closed DNS Resolution & Address-Set Comparison):** IP overlap analysis is a secondary defensive signal (since multi-tenant cloud proxies or shared ingress pools may share IP ranges, or DNS aliases may obscure routing). The script resolves complete normalized address sets for both endpoints (`comm -12`) and fails closed immediately if either resolution fails, returns empty sets, or reveals overlapping addresses. Authoritative project identity verification remains the primary prerequisite before initiating any connection.
    2. **Fail-Fast Shell Handling:** Bash script enforces `set -euo pipefail` to terminate immediately on command failure, uninitialized variables, or pipeline errors.
    3. **Atomic Single-Transaction Safety:** Restore executes via `psql --single-transaction -v ON_ERROR_STOP=1`. If any error or constraint violation occurs during execution, PostgreSQL rolls back all changes atomically.
    4. **Topological Order:** Data is inserted in strict topological dependency order (`members` -> `invitations`/`eagles_id_cards` -> `attendance_events` -> `attendance_records` -> `contributions` -> `expenses` -> `announcements` -> `audit_logs`). No unsafe session replication or trigger-disabling hacks are permitted.
    5. **Exhaustive Automated Post-Restore Invariant Verification:** The post-restore PL/pgSQL verification block asserts referential integrity across **all** member references in `expenses` (`recorded_by`, `approved_by`, and `reversed_by`) and `contributions` (`member_id`, `recorded_by`, `verified_by`, `closed_by`), verifies financial state invariants (approval and reversal attribution), and checks that **ALL** public tables maintain active RLS (`rowsecurity = TRUE`). Any failure aborts with an unhandled exception and non-zero exit code.
*   **Target-Compatible Restore Runbook (`scripts/restore_database.sh`):**
```bash
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

# 3. Transaction-Safe Data Restore with Fail-Fast Execution
echo "Starting transaction-safe restore into target: $TARGET_PROJECT_ID ($TARGET_HOST)..."
PGPASSWORD="${TARGET_DB_PASSWORD:?Target DB password required}" psql \
  -h "$TARGET_HOST" \
  -p 5432 \
  -d postgres \
  -U postgres \
  --single-transaction \
  -v ON_ERROR_STOP=1 \
  -f "$BACKUP_FILE"

# 4. Exhaustive Automated Post-Restore Invariant Verification
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
```

*   **Restore Script Test Fixtures (Specification & Fixture Coverage):**
    *   **Positive Fixture 1 (Valid Staging Execution):** Script executes with `TARGET_ENV=staging`, `TARGET_PROJECT_ID=agila-hub-staging`, `TARGET_DB_HOST=db.agila-hub-staging.supabase.co`, `PROD_PROJECT_ID=agila-hub-prod`, `PROD_DB_HOST=db.agila-hub-prod.supabase.co`. Expected: all endpoint and identity guards pass, restore executes within single transaction, and post-restore PL/pgSQL assertion executes cleanly with notice.
    *   **Negative Fixture 1 (Missing TARGET_ENV):** Script executes with `TARGET_ENV` unset or empty. Expected: terminates immediately before connection with exit code 1 and error `FATAL: TARGET_ENV is unset or empty. Explicit environment ('staging' or 'development') is required. Aborted.`
    *   **Negative Fixture 2 (Disallowed Environment):** Script executes with `TARGET_ENV=production`. Expected: terminates immediately before connection with exit code 1 and error `FATAL: TARGET_ENV must be explicitly 'staging' or 'development' (received 'production'). Production restores are blocked.`
    *   **Negative Fixture 3 (Hostname / Project-ID Mismatch):** Script executes with `TARGET_PROJECT_ID=agila-hub-staging` and mismatched `TARGET_DB_HOST=db.agila-hub-prod.supabase.co` (or any endpoint not matching authoritative project mapping `db.${TARGET_PROJECT_ID}.supabase.co`). Expected: terminates immediately before connection with exit code 1 and error `FATAL: Authoritative target identity verification failed! TARGET_DB_HOST ... does not match authoritative endpoint for TARGET_PROJECT_ID ...`.
    *   **Negative Fixture 4 (Target Project Matches Prod Project):** Script executes with `TARGET_PROJECT_ID=agila-hub-prod` and `PROD_PROJECT_ID=agila-hub-prod`. Expected: terminates immediately before connection with exit code 1 and error `FATAL: TARGET_PROJECT_ID equals PROD_PROJECT_ID ('agila-hub-prod'). Production restores are strictly forbidden. Aborted.`
    *   **Negative Fixture 5 (Direct Endpoint Match):** Script executes with `TARGET_DB_HOST=db.prod-ref.supabase.co` matching `PROD_DB_HOST`. Expected: terminates immediately before connection with exit code 1 and error `FATAL: TARGET_HOST matches trusted production endpoint`.
    *   **Negative Fixture 6 (Fail-Closed DNS Resolution Failure):** Script executes where `TARGET_DB_HOST` or `PROD_DB_HOST` cannot be resolved to non-empty address set. Expected: terminates immediately before connection with exit code 1 and error `FATAL: DNS resolution failed or returned empty address set`.
    *   **Negative Fixture 7 (IP Address Set Overlap):** Script executes where `TARGET_DB_HOST` and `PROD_DB_HOST` resolve to overlapping IP address set. Expected: terminates immediately before connection with exit code 1 and error `FATAL: Endpoint alias detected! TARGET_HOST shares resolved IP address(es) with PROD_DB_HOST`.
    *   **Negative Fixture 8 (Orphan approved_by / reversed_by FK):** Database backup contains an expense row with `approved_by` or `reversed_by` referencing non-existent member. Expected: post-restore assertion raises `POST-RESTORE INTEGRITY FAILURE: Found orphan approved_by` and fails script with non-zero exit code.
    *   **Negative Fixture 9 (Disabled Public Table RLS):** Database target has `rowsecurity = FALSE` on any public table (e.g. `eagles_id_cards`). Expected: post-restore assertion raises `POST-RESTORE INTEGRITY FAILURE: Found public tables with disabled RLS` and fails script with non-zero exit code.
    *   *Real Restore Drill Execution Status:* **NOT EXECUTED (SPECIFIED FOR RECOVERY RELEASE GATE IN PHASE 07)**.


---

## 8. Migration Safety, Comprehensive Preflight Validation & UTC Timestamps

### 8.1 Machine-Verifiable Preflight Script (`scripts/preflight_schema_check.sql`)
The preflight script performs comprehensive, machine-verifiable assertions across the complete schema baseline. If any extension, table, critical column, constraint, index, function, trigger, or RLS setting is missing or invalid, the script aborts immediately with a descriptive fatal SQL exception (`RAISE EXCEPTION`).

```sql
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
END $$;
```

---

## 9. Comprehensive Traceability Matrix: Findings, Controls, Planned Tests & Release Gates

> **Note on Evidence:** All tests listed below are **PLANNED test specifications** to be executed during their designated implementation phase release gates. No test is claimed as already executed in Phase 00.

| ID | Issue / Requirement | Enforced Architectural Control | Migration Location | Explicit Planned Test Procedures (Positive & Negative) | Release Gate | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **P0-01** | Expense approval & reversal integrity | Separate `approved_by/at` and `reversed_by/at`; original approval preserved on reversal | `006_financial_records.sql` | **Pos:** Financial Officer B approves expense; Officer B reverses expense with reason; verify `approved_by` preserved and `reversed_by` set.<br>**Neg:** Self-approval by recorder; modify approved amount; clear approval metadata without status change. | Financial Gate | **NOT EXECUTED** *(Scheduled for Financial Gate)* |
| **P0-02** | Contribution verification integrity | Separate `verified_by/at` and `closed_by/at`; original verification preserved on void/adjust | `006_financial_records.sql` | **Pos:** Verify contribution; void verified contribution; verify `verified_by` preserved and `closed_by` set.<br>**Neg:** Spoof `verified_by`; modify metadata without status transition; transition from voided. | Financial Gate | **NOT EXECUTED** *(Scheduled for Financial Gate)* |
| **P0-03** | Member identity protection | Trigger blocking self-service edits to names, `auth_user_id`, chapter, role, status | `002_members_and_directory.sql` | **Pos:** Member updates own nickname and avatar.<br>**Neg:** Member updates legal name, `auth_user_id`, or `club_chapter`; verify SQL exception. | Privilege Gate | **NOT EXECUTED** *(Scheduled for Privilege Gate)* |
| **P1-01** | Audit privacy & actor attribution | Strict per-table allowlist with zero fallback leakage; trusted server actor attribution; regression fix on `expenses.new_data.category` | `008_audit_logs_and_triggers.sql` | **Pos 1:** Member mutation records allowlisted attributes only.<br>**Pos 2 (Regression Test):** Insert expense record (`category = 'venue_rental'`); verify audit log `new_data->>'category' = 'venue_rental'` is captured correctly and non-null.<br>**Neg:** Check audit log on ID cards (paths absent); check invitations (`token_hash` absent); check unallowlisted column exclusion. | Audit Gate | **NOT EXECUTED** *(Scheduled for Audit Gate)* |
| **P1-02** | Attendance verification integrity | Server-controlled trigger binds `verified_by := v_caller.member_id` | `005_announcements_and_attendance.sql` | **Pos:** Officer marks attendance; verified_by set to Officer ID.<br>**Neg:** Officer passes third-party UUID as verified_by; verify server overrides with caller ID. | Attendance Gate | **NOT EXECUTED** *(Scheduled for Attendance Gate)* |
| **P1-03** | Validated backup/restore runbook & automated assertions | Multi-layer target guard: mandatory explicit `TARGET_ENV` (fail fast if unset or not staging/development); authoritative target identity and project-to-endpoint mapping (`TARGET_DB_HOST` matches `db.${TARGET_PROJECT_ID}.supabase.co`); `TARGET_PROJECT_ID` distinct from production; direct `TARGET_HOST` vs `PROD_DB_HOST` comparison; secondary defense-in-depth fail-closed DNS resolution comparing complete normalized IP sets via `comm -12`; fail-fast `set -euo pipefail`; single transaction; topological FK order; exhaustive automated PL/pgSQL invariant assertions covering all member references and all public tables | Section 7.2 of plan, `scripts/restore_database.sh` | **Pos:** Execute `scripts/restore_database.sh` on verified backup targeting staging; automated PL/pgSQL assertions verify referential integrity across all member references (recorded, approved, reversed, verified, closed), financial invariants, and RLS on all public tables.<br>**Neg 1 (Missing TARGET_ENV):** Pass unset or empty `TARGET_ENV`; verify script halts immediately before connection with code 1.<br>**Neg 2 (Disallowed ENV):** Pass `TARGET_ENV=production`; verify script halts immediately before connection with code 1.<br>**Neg 3 (Host/Project Mismatch):** Pass declared project ID with mismatched target host; verify script aborts before connection with code 1.<br>**Neg 4 (Identical Project ID):** Pass `TARGET_PROJECT_ID=PROD_PROJECT_ID`; verify script halts immediately.<br>**Neg 5 (Direct Endpoint Match):** Pass `TARGET_DB_HOST=PROD_DB_HOST`; verify script halts immediately.<br>**Neg 6 (DNS Resolution Failure):** Target or production host fails DNS resolution; verify script fails closed immediately.<br>**Neg 7 (IP Address Overlap):** Target and prod hosts share IP in normalized sets; verify script halts immediately.<br>**Neg 8 (Corrupted Archive):** Pass corrupted archive; verify clean atomic rollback.<br>**Neg 9 (Orphan FK):** Backup contains orphan approved_by or reversed_by; verify post-restore assertion aborts and fails pipeline.<br>**Neg 10 (Disabled RLS):** Public table has RLS disabled; verify post-restore assertion aborts and fails pipeline. | Recovery Gate | **NOT EXECUTED** *(Scheduled for Recovery Gate)* |
| **P1-04** | Comprehensive preflight validation | Machine-verifiable script validating extensions (3), core tables (10), columns/types (`audit_logs.actor_type varchar(50)`), triggers (6), security functions (3), index uniqueness (`idx_members_email_lower` `indisunique = true` on `LOWER(email)`), constraint uniqueness (`uq_reference_payment`), HNSW embedding index (`idx_constitution_embedding_hnsw` on `embedding` with `vector_cosine_ops`), and active RLS on all 10 tables | Section 8.1 of plan | **Pos:** Script runs cleanly against complete schema baseline, asserting column types, index uniqueness, and indexed expressions.<br>**Neg 1:** Drop table, column, trigger, or index/constraint; verify script raises fatal validation exception.<br>**Neg 2:** Recreate email index without uniqueness or without `LOWER(email)`; verify script raises fatal validation exception.<br>**Neg 3:** Disable RLS on any public table; verify script raises fatal validation exception. | Schema Gate | **NOT EXECUTED** *(Scheduled for Schema Gate)* |
| **P1-05** | Calibrated RAG threshold floor test | Server-enforced minimum floor 0.68; controlled mock embedding tests | `007_constitution_rag.sql` | **Pos:** Qualifying match ($0.82 \ge 0.68$) returned when client requests 0.50.<br>**Neg:** Candidate at $0.6799$ excluded; all candidates $< 0.68$ return 0 rows and trigger abstention. | RAG Gate | **NOT EXECUTED** *(Scheduled for RAG Gate)* |

---

## 10. Mandatory Testable Release Gates

1. **Schema Gate:** **PHASE 01 COMPLETED & VERIFIED (STATIC/CONTRACT PASS).** All 9 migrations (`001` through `009`) are materialized on disk in `supabase/migrations/` (total 63,972 bytes). `scripts/preflight_schema_check.sql` and `scripts/restore_database.sh` are materialized and verified. 59 automated test assertions in `scripts/verify_phase01.ts` pass cleanly (100%). Live cloud `supabase db push` execution is scheduled upon provisioning in Phase 02.
2. **Authorization Gate:** 100% pass on matrix testing across all 5 roles. Proves zero unauthorized row reads on private tables and expenses. *(Status: NOT EXECUTED - Scheduled for Cloud Auth Gate)*
3. **Account-State Gate:** Proves accounts in `PENDING_INVITATION`, `INVITED`, `SUSPENDED`, and `DEACTIVATED` states cannot access protected endpoints. *(Status: NOT EXECUTED - Scheduled for Cloud Gate)*
4. **Privilege Gate:** Proves non-admins cannot alter protected columns (`role`, `status`, names, chapter) or exploit `SECURITY DEFINER` functions; proves client-supplied identities are ignored. *(Status: NOT EXECUTED - Scheduled for Cloud Gate)*
5. **ID Verification Gate:** Proves members can upload front/back independently, cannot self-verify, and signed URLs expire in 15 minutes. *(Status: NOT EXECUTED - Scheduled for Cloud Gate)*
6. **Audit Gate:** Proves state changes generate immutable audit records with allowlisted attributes and trusted server actor attribution; `DELETE` and `UPDATE` on `audit_logs` fail. *(Status: NOT EXECUTED - Scheduled for Cloud Gate)*
7. **Financial Gate:** Validates payment recording with text reference numbers; verifies duplicate reference blocks; enforces segregation of duties (`recorded_by != verified_by`); rejects pre-verified insertions; preserves original verification/approval metadata during voiding and reversals. *(Status: NOT EXECUTED - Scheduled for Cloud Gate)*
8. **RAG Gate:** Passes 60-question evaluation benchmark with $100\%$ citation accuracy and $100\%$ abstention on out-of-scope prompts; proves server enforces minimum $0.68$ threshold floor. *(Status: NOT EXECUTED - Scheduled for Cloud Gate)*
9. **Product Gate:** Verifies all 9 Android screens, Liquid Glass tokens, BEEC asset layering, and time-based greetings on Android emulators. *(Status: NOT EXECUTED - Scheduled for Mobile Gate)*
10. **Recovery Gate:** Demonstrated non-production restore from backup archive using `psql` runbook with verified RTO $< 4$ hours. *(Status: NOT EXECUTED - Scheduled for Cloud Recovery Gate)*
11. **CI/CD Gate:** Clean lint, type-check, and automated test pass on GitHub Actions; release builds blocked on failure. *(Status: PASSED LOCALLY via `npm run lint` & `npm test`)*
12. **Release Gate:** Zero unresolved P0/P1 security findings; sign-off from designated leadership on Phase 01 implementation.

---

## 11. Final Acceptance Status & Human Prerequisites

### 11.1 Remediation Summary
All technical architecture, database migrations, security policies, identity triggers, preflight checks, and backup runbooks have been implemented on disk and validated via 59 automated test assertions with zero failures.

### 11.2 Prerequisites Requiring Human Action Prior to Live Cloud Provisioning (Phase 02)
1. **Designation of Root Super-Admin Email:** Confirmation of the email address to receive initial bootstrap privileges.
2. **Constitution Document Access Authorization:** Written confirmation authorizing extraction from `https://e-constitution.tfoe-peinc.com/`, or delivery of the official signed PDF copy.
3. **Supabase Production Tier Selection:** Confirmation that the production deployment will use the Supabase Pro tier to enable PITR and meet the $\le 1\,\text{hour}$ RPO requirement.

### 11.3 Phase 01 Implementation & Verification Summary
- **Migration Files Created on Disk (`supabase/migrations/`):**
  - `20261013000001_core_types_and_extensions.sql` (2,120 bytes)
  - `20261013000002_members_and_directory.sql` (6,160 bytes)
  - `20261013000003_invitations_and_auth.sql` (3,074 bytes)
  - `20261013000004_eagles_id_storage.sql` (5,711 bytes)
  - `20261013000005_announcements_and_attendance.sql` (5,691 bytes)
  - `20261013000006_financial_records.sql` (14,838 bytes)
  - `20261013000007_constitution_rag.sql` (3,171 bytes)
  - `20261013000008_audit_logs_and_triggers.sql` (10,820 bytes)
  - `20261013000009_rls_and_storage_policies.sql` (12,387 bytes)
- **Validation Scripts on Disk (`scripts/`):**
  - `scripts/preflight_schema_check.sql` (machine-verifiable PL/pgSQL assertions)
  - `scripts/restore_database.sh` (hardened transaction-safe restore runbook)
  - `scripts/verify_phase01.ts` (Phase 01 test runner executing 59 assertions)
- **Execution Evidence:** 59 assertions executed (`npm test`), 59 PASS, 0 FAIL.
- **Runtime Cloud Database Tests:** Marked **NOT EXECUTED** pending cloud provisioning.
