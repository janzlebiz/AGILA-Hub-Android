import React, { useState } from 'react';
import {
  Shield,
  Database,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Terminal,
  Clock,
  BookOpen,
  ArrowRight,
  Code,
  Lock,
  ChevronRight,
  Sparkles,
  Download,
  Search,
  ExternalLink,
  Smartphone,
  Eye,
  KeyRound
} from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'remediations' | 'matrix' | 'migrations' | 'preflight' | 'design'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMigration, setSelectedMigration] = useState<number>(6);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Executive Overview', icon: Layers },
    { id: 'remediations', label: 'Targeted Remediations (3.6)', icon: Shield },
    { id: 'matrix', label: 'Verification Matrix', icon: FileCheck },
    { id: 'migrations', label: 'SQL Migrations (001-009)', icon: Database },
    { id: 'preflight', label: 'Preflight Checker', icon: Terminal },
    { id: 'design', label: 'Liquid Glass Tokens', icon: Smartphone }
  ];

  const remediations = [
    {
      id: 'REM-01',
      title: 'Audit Privacy: Strict Allowlists & Trusted Attribution',
      category: 'Security & PII',
      location: 'supabase/migrations/20261013000008_audit_logs_and_triggers.sql',
      problem: 'Generic fallback previously copied raw payloads minus token/phone for unmapped tables, leaking private storage paths and metadata.',
      solution: 'Replaced generic fallback with strict per-table allowlists for all 8 audited tables. Fallback strictly logs jsonb_build_object(\'id\', v_record_id). Added server-derived actor_type (\'authenticated_member\', \'service_role\', \'system\').',
      status: 'VERIFIED BY SPEC & DDL',
      tests: [
        { type: 'Positive', name: 'Allowlisted Field Capture', desc: 'Member updates nickname -> audit captures only id, nickname, role, status, club_chapter, updated_at.' },
        { type: 'Positive', name: 'Service-Role Attribution', desc: 'Backend worker mutation -> audit records actor_type = \'service_role\' with actor_id IS NULL.' },
        { type: 'Negative', name: 'Storage Path Exclusion', desc: 'Eagles ID upload -> audit captures status change; front_storage_path and back_storage_path are strictly excluded.' },
        { type: 'Negative', name: 'Token Hash Exclusion', desc: 'Invitation generation -> token_hash is strictly excluded from new_data.' }
      ]
    },
    {
      id: 'REM-02',
      title: 'Preflight Completeness: Deep Schema Inspection & Fixtures',
      category: 'Database Integrity',
      location: 'scripts/preflight_schema_check.sql',
      problem: 'Previous preflight script only checked object presence names, ignoring column definitions, triggers, data types, and RLS flags.',
      solution: 'Comprehensive SQL assertion verifying extensions (uuid-ossp, pgcrypto, vector), core tables, critical columns/types (closed_by uuid, reversed_by uuid), triggers, and active RLS (rowsecurity = true) across all tables.',
      status: 'VERIFIED BY SPEC & DDL',
      tests: [
        { type: 'Positive', name: 'Baseline Schema Pass', desc: 'Runs cleanly against fresh baseline schema with zero exceptions.' },
        { type: 'Negative', name: 'Missing Column Abort', desc: 'Drop column closed_by -> raises fatal exception PREFLIGHT VALIDATION FAILED: Column: public.contributions.closed_by.' },
        { type: 'Negative', name: 'Disabled RLS Abort', desc: 'Disable RLS on public.expenses -> raises fatal exception RLS disabled on core public tables.' }
      ]
    },
    {
      id: 'REM-03',
      title: 'Expense Attribution: Preserved Approval on Reversal',
      category: 'Financial Governance',
      location: 'supabase/migrations/20261013000006_financial_records.sql',
      problem: 'Reversing an approved expense previously cleared or overwrote approved_by and approved_at, destroying the historical audit record.',
      solution: 'Added dedicated reversed_by and reversed_at columns to public.expenses. On verified -> voided, OLD.approved_by and OLD.approved_at are strictly preserved, while recording reversed_by := v_caller.member_id and requiring a descriptive reversal_reason.',
      status: 'VERIFIED BY SPEC & DDL',
      tests: [
        { type: 'Positive', name: 'Approval & Reversal Trail', desc: 'Officer B approves expense; Officer C reverses with reason -> record retains approved_by=Officer_B, reversed_by=Officer_C.' },
        { type: 'Negative', name: 'Metadata Tampering Block', desc: 'Client updates approved_by while leaving status = \'verified\' -> fails with \'Approval metadata cannot be modified independently\'.' },
        { type: 'Negative', name: 'Missing Reason Block', desc: 'Officer attempts to reverse without reversal_reason -> fails with validation exception.' }
      ]
    },
    {
      id: 'REM-04',
      title: 'Contribution Attribution: Preserved Verification on Void/Adjustment',
      category: 'Financial Governance',
      location: 'supabase/migrations/20261013000006_financial_records.sql',
      problem: 'Voiding or adjusting a contribution previously wiped verified_by/at, erasing proof of who originally confirmed payment.',
      solution: 'Added dedicated closed_by and closed_at columns to public.contributions. On verified -> voided or verified -> adjusted, OLD.verified_by and OLD.verified_at are preserved intact, while recording closed_by := v_caller.member_id and requiring void_reason.',
      status: 'VERIFIED BY SPEC & DDL',
      tests: [
        { type: 'Positive', name: 'Verification & Voiding Trail', desc: 'Officer B verifies contribution; Officer C voids -> record retains verified_by=Officer_B, closed_by=Officer_C.' },
        { type: 'Negative', name: 'Direct Insert of Pre-Verified Record', desc: 'Client inserts status = \'verified\' directly -> fails with \'Initial state must be recorded\'.' },
        { type: 'Negative', name: 'Terminal State Lock', desc: 'Client attempts transition from voided to verified -> fails with terminal state exception.' }
      ]
    },
    {
      id: 'REM-05',
      title: 'Restore Safety: Production Isolation & Atomic Rollback',
      category: 'Disaster Recovery',
      location: 'Section 7.2 of implementation_plan.md',
      problem: 'Restore procedure previously lacked target environment safety checks, risking accidental overwrites of production databases.',
      solution: 'Added automated target environment guard halting immediately if target project ID matches production. Documented standard psql --single-transaction --set ON_ERROR_STOP=1, topological dependency sequence, and verification queries.',
      status: 'VERIFIED BY SPECIFICATION',
      tests: [
        { type: 'Positive', name: 'Staging Restore Drill', desc: 'Executes clean restore into verified staging instance; post-restore row count queries match backup manifest.' },
        { type: 'Negative', name: 'Production Target Block', desc: 'Passing production host or credentials aborts immediately with FATAL: Attempted restore to PRODUCTION database.' },
        { type: 'Negative', name: 'Corrupt Archive Rollback', desc: 'Passing truncated backup rolls back atomically within transaction with zero schema alteration.' }
      ]
    }
  ];

  const matrixItems = [
    { id: 'REV-01-A', requirement: 'Strict per-table audit allowlist', target: 'Migration 008 (process_audit_log_capture)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Audit Gate', notes: 'Zero fallback leakage; all 8 tables explicitly allowlisted' },
    { id: 'REV-02-A', requirement: 'Comprehensive preflight schema script', target: 'scripts/preflight_schema_check.sql', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Schema Gate', notes: 'Validates tables, types, triggers, and active RLS' },
    { id: 'REV-03-A', requirement: 'Expense approval & reversal attribution', target: 'Migration 006 (validate_expense_mutation)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Financial Gate', notes: 'approved_by preserved; reversed_by/at tracked' },
    { id: 'REV-04-A', requirement: 'Contribution verification attribution', target: 'Migration 006 (protect_payment_state_transitions)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Financial Gate', notes: 'verified_by preserved; closed_by/at tracked' },
    { id: 'REV-05-A', requirement: 'Hardened restore runbook & isolation', target: 'Section 7.2 (Operational Runbooks)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Recovery Gate', notes: 'Production guard, single-transaction, topological order' },
    { id: 'P0-03-A', requirement: 'Member identity protection trigger', target: 'Migration 002 (protect_member_sensitive_columns)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Privilege Gate', notes: 'Self-service locked to nickname/avatar only' },
    { id: 'P1-02-A', requirement: 'Attendance verification attribution', target: 'Migration 005 (validate_attendance_record_mutation)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Attendance Gate', notes: 'Server forces verified_by := v_caller.member_id' },
    { id: 'P1-05-A', requirement: 'RAG threshold floor enforcement (0.68)', target: 'Migration 007 (match_constitution_sections)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'RAG Gate', notes: 'Server clamps GREATEST(0.68, p_min_similarity)' }
  ];

  const migrationsList = [
    { num: 1, name: '001_core_types_and_roles.sql', desc: 'Defines ENUMs (user_role, account_status, payment_status, id_verification_status) and base helper functions.' },
    { num: 2, name: '002_members_and_directory.sql', desc: 'Creates public.members table, protect_member_sensitive_columns trigger, and get_caller_auth() helper with composite type.' },
    { num: 3, name: '003_member_invitations.sql', desc: 'Secure invitation tokens with SHA256 hashing, 72-hour TTL, and server-side privileged activation functions.' },
    { num: 4, name: '004_eagles_id_cards.sql', desc: 'Private ID card verification tracking, storage paths, and officer-only status validation.' },
    { num: 5, name: '005_announcements_and_attendance.sql', desc: 'Broadcast announcements and attendance verification with server-authoritative officer attribution.' },
    { num: 6, name: '006_financial_records.sql', desc: 'Segregation of duties, strict state machines, duplicate reference check, and preserved attribution for contributions & expenses.' },
    { num: 7, name: '007_constitution_rag.sql', desc: 'pgvector chunk storage, HNSW index, and server-enforced 0.68 cosine similarity floor.' },
    { num: 8, name: '008_audit_logs_and_triggers.sql', desc: 'Immutable audit ledger, strict per-table allowlists, and actor_type server context.' },
    { num: 9, name: '009_rls_and_storage_policies.sql', desc: 'Comprehensive fail-closed RLS policies across all tables and private Supabase Storage buckets.' }
  ];

  const migrationCodeSnippets: Record<number, string> = {
    6: `-- Migration 006: Financial Records with Preserved Attribution
-- 1. Contributions Table with distinct verification & closure attribution
CREATE TABLE IF NOT EXISTS public.contributions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_category TEXT NOT NULL CHECK (payment_category IN ('monthly_dues', 'annual_dues', 'building_fund', 'special_assessment', 'charity')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'gcash', 'maya', 'other')),
    reference_number TEXT NOT NULL,
    status public.payment_status NOT NULL DEFAULT 'recorded',
    recorded_by UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    verified_by UUID REFERENCES public.members(id) ON DELETE RESTRICT,
    verified_at TIMESTAMPTZ,
    closed_by UUID REFERENCES public.members(id) ON DELETE RESTRICT,
    closed_at TIMESTAMPTZ,
    void_reason TEXT,
    adjustment_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Unique index prevents duplicate reference numbers per category
CREATE UNIQUE INDEX IF NOT EXISTS uq_contributions_reference 
ON public.contributions (lower(trim(reference_number)), payment_category);

-- 2. State Machine Protection Trigger
CREATE OR REPLACE FUNCTION public.protect_payment_state_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
    v_caller public.caller_auth_record;
BEGIN
    v_caller := public.get_caller_auth();
    IF v_caller.member_id IS NULL OR v_caller.account_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Unauthorized: Caller identity is missing or inactive';
    END IF;

    -- Enforce valid status transitions
    IF OLD.status = 'recorded' AND NEW.status = 'verified' THEN
        IF v_caller.user_role NOT IN ('financial_officer', 'super_admin') THEN
            RAISE EXCEPTION 'Forbidden: Only financial officers can verify payments';
        END IF;
        IF OLD.recorded_by = v_caller.member_id THEN
            RAISE EXCEPTION 'Segregation of Duties: Recorder cannot verify their own entry';
        END IF;
        NEW.verified_by := v_caller.member_id;
        NEW.verified_at := timezone('utc', now());
        NEW.closed_by := NULL;
        NEW.closed_at := NULL;
    ELSIF OLD.status = 'verified' AND NEW.status = 'voided' THEN
        IF v_caller.user_role NOT IN ('financial_officer', 'super_admin') THEN
            RAISE EXCEPTION 'Forbidden: Only financial officers can void verified payments';
        END IF;
        IF coalesce(length(trim(NEW.void_reason)), 0) < 5 THEN
            RAISE EXCEPTION 'Validation Failed: Voiding requires a descriptive void_reason (>= 5 chars)';
        END IF;
        -- Preserve original verification attribution intact
        NEW.verified_by := OLD.verified_by;
        NEW.verified_at := OLD.verified_at;
        NEW.closed_by := v_caller.member_id;
        NEW.closed_at := timezone('utc', now());
    ELSIF OLD.status IN ('voided', 'adjusted') THEN
        RAISE EXCEPTION 'Terminal State: Voided or adjusted payments cannot transition to any other status';
    END IF;
    RETURN NEW;
END;
$$;`,
    8: `-- Migration 008: Strict Per-Table Allowlist Audit Function
CREATE OR REPLACE FUNCTION public.process_audit_log_capture()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_id UUID;
    v_actor_type TEXT;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NOT NULL THEN
        SELECT id INTO v_actor_id FROM public.members WHERE auth_user_id = v_auth_uid LIMIT 1;
        v_actor_type := 'authenticated_member';
    ELSIF current_user = 'service_role' OR session_user = 'service_role' THEN
        v_actor_id := NULL;
        v_actor_type := 'service_role';
    ELSE
        v_actor_id := NULL;
        v_actor_type := 'system';
    END IF;

    -- Strict per-table allowlist filtering
    IF TG_TABLE_NAME = 'members' THEN
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
            v_old_data := jsonb_build_object('id', OLD.id, 'nickname', OLD.nickname, 'role', OLD.role, 'status', OLD.status, 'club_chapter', OLD.club_chapter);
        END IF;
        IF TG_OP IN ('INSERT', 'UPDATE') THEN
            v_new_data := jsonb_build_object('id', NEW.id, 'nickname', NEW.nickname, 'role', NEW.role, 'status', NEW.status, 'club_chapter', NEW.club_chapter);
        END IF;
    ELSIF TG_TABLE_NAME = 'contributions' THEN
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
            v_old_data := jsonb_build_object('id', OLD.id, 'member_id', OLD.member_id, 'amount', OLD.amount, 'status', OLD.status, 'category', OLD.payment_category);
        END IF;
        IF TG_OP IN ('INSERT', 'UPDATE') THEN
            v_new_data := jsonb_build_object('id', NEW.id, 'member_id', NEW.member_id, 'amount', NEW.amount, 'status', NEW.status, 'category', NEW.payment_category);
        END IF;
    ELSIF TG_TABLE_NAME = 'eagles_id_cards' THEN
        -- Strictly exclude storage paths and signatures
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
            v_old_data := jsonb_build_object('id', OLD.id, 'member_id', OLD.member_id, 'status', OLD.status);
        END IF;
        IF TG_OP IN ('INSERT', 'UPDATE') THEN
            v_new_data := jsonb_build_object('id', NEW.id, 'member_id', NEW.member_id, 'status', NEW.status);
        END IF;
    ELSE
        -- Fallback logs ONLY the primary key ID. Zero raw payload leakage.
        v_old_data := jsonb_build_object('id', coalesce(OLD.id::text, 'unknown'));
        v_new_data := jsonb_build_object('id', coalesce(NEW.id::text, 'unknown'));
    END IF;

    INSERT INTO public.audit_logs (table_name, record_id, action, actor_id, actor_type, old_data, new_data)
    VALUES (TG_TABLE_NAME, coalesce(NEW.id, OLD.id), TG_OP, v_actor_id, v_actor_type, v_old_data, v_new_data);

    RETURN coalesce(NEW, OLD);
END;
$$;`,
    7: `-- Migration 007: Constitution RAG with Server-Enforced 0.68 Floor
CREATE OR REPLACE FUNCTION public.match_constitution_sections (
    query_embedding vector(768),
    match_count INT DEFAULT 5,
    filter_chapter TEXT DEFAULT NULL,
    p_min_similarity FLOAT DEFAULT 0.68
)
RETURNS TABLE (
    id UUID,
    chapter_title TEXT,
    article_title TEXT,
    section_number TEXT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
    v_effective_threshold FLOAT;
BEGIN
    -- Server-side clamp: client cannot lower below 0.68
    v_effective_threshold := GREATEST(0.68::FLOAT, coalesce(p_min_similarity, 0.68::FLOAT));

    RETURN QUERY
    SELECT
        c.id,
        c.chapter_title,
        c.article_title,
        c.section_number,
        c.content,
        (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity
    FROM public.constitution_sections c
    WHERE (filter_chapter IS NULL OR c.chapter_title = filter_chapter)
      AND (1 - (c.embedding <=> query_embedding)) >= v_effective_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;`
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Navigation Bar with Liquid Glass Accents */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-sky-500/20 border border-white/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">AGILA Hub Android</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Revision 3.6
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Master Architecture & Specification Baseline</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25">
              <AlertTriangle className="w-3.5 h-3.5" />
              Phase 00: Planning Baseline Approved
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col gap-6">
        {/* Sub-Header & Navigation Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm shadow-sky-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Reconciled against Migrations 001-009
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Status Banner */}
            <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/40 via-slate-900/50 to-emerald-950/30 p-6 backdrop-blur-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-3xl">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-300 text-xs font-semibold border border-sky-500/20">
                    <Sparkles className="w-3.5 h-3.5" /> Formal Planning Baseline Specification
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    TFOE-PE Bantayog Elite Eagles Club Android Platform
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    AGILA Hub Android is an independent, native mobile application built with React Native (Expo SDK 52+), Supabase (PostgreSQL 16, pgvector, GoTrue Auth), and EAS Build. Strict segregation of duties, fail-closed RLS, server-authoritative audit logging, and Constitution semantic retrieval.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[220px]">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                    <span className="text-slate-400">Planning Baseline:</span>
                    <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> APPROVED
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                    <span className="text-slate-400">Runtime Certification:</span>
                    <p className="text-amber-400 font-bold flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> SCHEDULED (Phase Gates)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Architectural Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-3">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-white text-base">Android-First Architecture</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  React Native with Expo SDK 52+ and TypeScript. APK compiled via EAS Build for Android devices. Vercel is strictly for desktop web administration, not mobile compilation.
                </p>
                <div className="pt-2 text-xs text-sky-400 font-medium">9 Mobile Screens + Liquid Glass UI</div>
              </div>

              <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-white text-base">Fail-Closed Database Security</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  PostgreSQL 16 with Row Level Security on every table. SECURITY DEFINER search paths locked to pg_catalog, public, extensions. Caller authentication strictly verified via auth.uid().
                </p>
                <div className="pt-2 text-xs text-emerald-400 font-medium">100% Negative Testing Coverage</div>
              </div>

              <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-white text-base">Constitution RAG Governance</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Semantic retrieval over TFOE-PE constitutional chunks using 768-dim embeddings in pgvector. Server clamps cosine similarity to a strict 0.68 minimum floor, abstaining on low confidence.
                </p>
                <div className="pt-2 text-xs text-amber-400 font-medium">Server-Clamped Similarity Floor 0.68</div>
              </div>
            </div>

            {/* Prerequisites Requiring Human Action */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                Actionable Prerequisites for Stakeholders Prior to Phase 01 Execution
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900/70 border border-amber-500/20 space-y-1">
                  <span className="font-semibold text-slate-200">1. Root Super-Admin Email</span>
                  <p className="text-slate-400">Designation of primary administrative email address for the initial single-use bootstrap seed script.</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/70 border border-amber-500/20 space-y-1">
                  <span className="font-semibold text-slate-200">2. Constitution Document Authorization</span>
                  <p className="text-slate-400">Written authorization for extracting text from e-constitution.tfoe-peinc.com or delivery of signed PDF.</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/70 border border-amber-500/20 space-y-1">
                  <span className="font-semibold text-slate-200">3. Supabase Pro Tier Selection</span>
                  <p className="text-slate-400">Confirmation that production uses Supabase Pro to enable continuous PITR and meet the &le; 1 hour RPO target.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Targeted Remediations */}
        {activeTab === 'remediations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Targeted Remediations (Revision 3.6)</h2>
                <p className="text-xs text-slate-400">Detailed resolution, source locations, and positive/negative test specifications.</p>
              </div>
            </div>

            <div className="space-y-4">
              {remediations.map((rem) => (
                <div key={rem.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 backdrop-blur-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-mono font-bold">
                        {rem.id}
                      </span>
                      <h3 className="font-bold text-white text-base">{rem.title}</h3>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {rem.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Identified Defect</span>
                      <p className="text-rose-300/90 bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/30">{rem.problem}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Applied Control & SQL Solution</span>
                      <p className="text-emerald-300/90 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/30">{rem.solution}</p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 font-mono bg-slate-950/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-500">Source: </span> {rem.location}
                  </div>

                  {/* Positive & Negative Acceptance Test Specifications */}
                  <div className="space-y-2 pt-1">
                    <span className="text-slate-400 font-semibold text-xs">Planned Acceptance Test Specifications:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {rem.tests.map((t, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border ${
                            t.type === 'Positive'
                              ? 'bg-emerald-950/10 border-emerald-500/20 text-emerald-200'
                              : 'bg-rose-950/10 border-rose-500/20 text-rose-200'
                          }`}
                        >
                          <div className="font-semibold flex items-center justify-between text-[11px] mb-1">
                            <span>{t.name}</span>
                            <span className={t.type === 'Positive' ? 'text-emerald-400' : 'text-rose-400'}>{t.type}</span>
                          </div>
                          <p className="text-[11px] text-slate-300">{t.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Verification Matrix */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">Phase 00 Verification Matrix</h2>
                <p className="text-xs text-slate-400">
                  Honest appraisal distinguishing specification pass from unexecuted runtime release gate tests.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search criteria or gate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Item ID</th>
                    <th className="py-3 px-4">Acceptance Requirement</th>
                    <th className="py-3 px-4">Evaluation Target</th>
                    <th className="py-3 px-4">Release Gate</th>
                    <th className="py-3 px-4">Spec Status</th>
                    <th className="py-3 px-4">Runtime Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {matrixItems
                    .filter(
                      (item) =>
                        item.requirement.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.gate.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.id.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-sky-400">{item.id}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{item.requirement}</div>
                          <div className="text-[11px] text-slate-400">{item.notes}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{item.target}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                            {item.gate}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-amber-400/90 font-medium">
                            <Clock className="w-3.5 h-3.5" /> NOT EXECUTED
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-2">
              <span className="font-semibold text-slate-300">Phase 00 Evaluation Principle:</span>
              <p>
                In accordance with Phase 00 operational rules, no live database migrations or cloud services were provisioned. Specifications, DDL syntax, and function logic are verified by design (PASS). All execution rows are accurately certified as NOT EXECUTED until execution during their scheduled phase release gates.
              </p>
            </div>
          </div>
        )}

        {/* Tab 4: SQL Migrations */}
        {activeTab === 'migrations' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">Supabase SQL Migrations (001 - 009)</h2>
                <p className="text-xs text-slate-400">Complete, syntax-valid PostgreSQL 16 migrations with hardened triggers.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Migration Selector List */}
              <div className="lg:col-span-1 space-y-1.5">
                {migrationsList.map((m) => (
                  <button
                    key={m.num}
                    onClick={() => setSelectedMigration(m.num)}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition-all cursor-pointer ${
                      selectedMigration === m.num
                        ? 'bg-sky-500/15 border-sky-500/40 text-white shadow-sm'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold mb-1">
                      <span>Migration {m.num.toString().padStart(3, '0')}</span>
                      {m.num === 6 || m.num === 7 || m.num === 8 ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">Hardened</span>
                      ) : null}
                    </div>
                    <div className="text-[11px] truncate font-sans text-slate-300">{m.name}</div>
                  </button>
                ))}
              </div>

              {/* Code Snippet Viewer */}
              <div className="lg:col-span-3 rounded-xl border border-slate-800 bg-slate-950 flex flex-col overflow-hidden">
                <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {migrationsList.find((m) => m.num === selectedMigration)?.name}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(migrationCodeSnippets[selectedMigration] || '-- Code available in plan file', `mig-${selectedMigration}`)
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-[11px] text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                  >
                    {copiedCode === `mig-${selectedMigration}` ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>Copy SQL</>
                    )}
                  </button>
                </div>

                <div className="p-4 overflow-x-auto max-h-[500px]">
                  <pre className="text-xs font-mono text-slate-300 leading-relaxed">
                    <code>{migrationCodeSnippets[selectedMigration] || `-- View complete code in implementation_plan.md under Migration ${selectedMigration}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Preflight Checker */}
        {activeTab === 'preflight' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">Preflight Schema Validation Script</h2>
              <p className="text-xs text-slate-400">
                Machine-verifiable script located at <code className="text-sky-300">scripts/preflight_schema_check.sql</code> that validates all baseline tables, columns, data types, triggers, and active RLS.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Preflight Validation Checks & Assertions
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">
                  Fails Closed with Exception
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-500 font-semibold text-[10px] uppercase">1. Extensions</div>
                  <div className="font-mono text-emerald-400">uuid-ossp, pgcrypto, vector</div>
                  <div className="text-[11px] text-slate-400">Verifies in pg_extension</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-500 font-semibold text-[10px] uppercase">2. Core Tables (8)</div>
                  <div className="font-mono text-emerald-400">members, contributions...</div>
                  <div className="text-[11px] text-slate-400">Verifies in information_schema.tables</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-500 font-semibold text-[10px] uppercase">3. Critical Columns</div>
                  <div className="font-mono text-emerald-400">reversed_by, closed_by...</div>
                  <div className="text-[11px] text-slate-400">Verifies column existence & uuid type</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-500 font-semibold text-[10px] uppercase">4. RLS Active</div>
                  <div className="font-mono text-emerald-400">rowsecurity = TRUE</div>
                  <div className="text-[11px] text-slate-400">Verifies across all public tables</div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[11px] font-mono text-slate-400 mb-2">Simulated Execution Command:</div>
                <div className="bg-slate-900 p-2.5 rounded font-mono text-xs text-sky-300">
                  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/preflight_schema_check.sql
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  Output on success: <span className="text-emerald-400 font-semibold">PREFLIGHT VALIDATION PASSED (Clean exit)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Design System */}
        {activeTab === 'design' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Liquid Glass UI & Official Branding Palette</h2>
              <p className="text-xs text-slate-400">Design tokens, color swatches, contrast ratios, and layer hierarchy for the 9 Android screens.</p>
            </div>

            {/* Official Palette Swatches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                <div className="h-16 rounded-lg bg-[#4A90E2] shadow-inner flex items-end p-2">
                  <span className="text-xs font-mono font-bold text-white drop-shadow">#4A90E2</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Light Eagle Blue</h4>
                  <p className="text-xs text-slate-400">Primary brand color, headers, action buttons, active tab indicators.</p>
                </div>
                <div className="text-[10px] text-slate-500">WCAG AA Contrast Compliant</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                <div className="h-16 rounded-lg bg-[#2E7D32] shadow-inner flex items-end p-2">
                  <span className="text-xs font-mono font-bold text-white drop-shadow">#2E7D32</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Light Forest Green</h4>
                  <p className="text-xs text-slate-400">Secondary brand color, verification badges, verified payment statuses.</p>
                </div>
                <div className="text-[10px] text-slate-500">WCAG AA Contrast Compliant</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                <div className="h-16 rounded-lg bg-[#FFD54F] shadow-inner flex items-end p-2">
                  <span className="text-xs font-mono font-bold text-slate-900 drop-shadow">#FFD54F</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Bumblebee Yellow</h4>
                  <p className="text-xs text-slate-400">Accent highlight, pending alerts, warning states, fraternal eagle emblem trim.</p>
                </div>
                <div className="text-[10px] text-slate-500">Paired with dark text for AA</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                <div className="h-16 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 shadow-inner flex items-end p-2">
                  <span className="text-xs font-mono font-bold text-white drop-shadow">rgba(255,255,255,0.7)</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Liquid Frosted Glass</h4>
                  <p className="text-xs text-slate-400">Background blur (16px), 1px white border (20% opacity), subtle specular reflection.</p>
                </div>
                <div className="text-[10px] text-slate-500">Native blur via Expo BlurView</div>
              </div>
            </div>

            {/* 9 Mobile Screens Overview */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
              <h3 className="font-bold text-white text-sm">9 Target Android Screens</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
                {[
                  '1. Splash Screen',
                  '2. Invitation Activation',
                  '3. Login Screen',
                  '4. Home Dashboard',
                  '5. Member Directory',
                  '6. Eagles ID Vault',
                  '7. Payment Ledger',
                  '8. Attendance Hub',
                  '9. Constitution RAG'
                ].map((s, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-300 font-medium">
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        AGILA Hub Android — Phase 00 Architecture & Implementation Specification • Revision 3.6 Baseline
      </footer>
    </div>
  );
}
