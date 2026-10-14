-- File: supabase/migrations/20261013000001_core_types_and_extensions.sql
-- Description: AGILA Hub — Core Extensions and Enumerated Types

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
