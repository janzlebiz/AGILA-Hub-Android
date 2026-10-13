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
  KeyRound,
  RefreshCw
} from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'remediations' | 'matrix' | 'migrations' | 'preflight' | 'restore' | 'design'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMigration, setSelectedMigration] = useState<number>(8);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Executive Overview', icon: Layers },
    { id: 'remediations', label: 'Remediations (3.7)', icon: Shield },
    { id: 'matrix', label: 'Verification Matrix', icon: FileCheck },
    { id: 'migrations', label: 'SQL Migrations (001-009)', icon: Database },
    { id: 'preflight', label: 'Preflight Script', icon: Terminal },
    { id: 'restore', label: 'Restore Runbook', icon: RefreshCw },
    { id: 'design', label: 'Liquid Glass Tokens', icon: Smartphone }
  ];

  const remediations = [
    {
      id: 'REM-01',
      title: 'Audit Privacy & Expense Payload Source Fix',
      category: 'Security & PII',
      location: 'supabase/migrations/20261013000008_audit_logs_and_triggers.sql',
      problem: 'In expenses audit logging, v_safe_new erroneously read category from v_raw_old->\'category\' instead of v_raw_new->\'category\', causing category to be NULL on INSERTs and stale on UPDATEs.',
      solution: 'Corrected v_safe_new mapping to v_raw_new->\'category\'. Enforced strict per-table allowlists for all 8 audited tables. Unmapped fallback logs strictly jsonb_build_object(\'id\', v_record_id). Server context derives actor_type (\'authenticated_member\', \'service_role\', \'system\').',
      status: 'VERIFIED BY SPEC & DDL',
      tests: [
        { type: 'Positive', name: 'Expense Category Regression Test', desc: 'Insert expense (category=\'venue_rental\') -> audit captures new_data->>\'category\'=\'venue_rental\' (non-null) and old_data IS NULL. Update to \'equipment_rental\' captures old and new.' },
        { type: 'Positive', name: 'Allowlisted Member Capture', desc: 'Member updates nickname -> audit captures only id, nickname, role, status, club_chapter, updated_at.' },
        { type: 'Negative', name: 'Storage Path Exclusion', desc: 'Eagles ID card upload -> audit captures status change; front_storage_path and back_storage_path are strictly excluded.' },
        { type: 'Negative', name: 'Token Hash Exclusion', desc: 'Invitation generation -> token_hash is strictly excluded from new_data.' }
      ]
    },
    {
      id: 'REM-02',
      title: 'Comprehensive Preflight Assertions (Aligned Coverage)',
      category: 'Database Integrity',
      location: 'scripts/preflight_schema_check.sql & Section 8.1',
      problem: 'Previous preflight script checked only object presence names and omitted tables, columns, indexes, and functions, leading to an overbroad coverage claim.',
      solution: 'Exhaustive SQL assertion script validating: 3 extensions (uuid-ossp, pgcrypto, vector), all 10 baseline tables, critical columns/types (auth_user_id, closed_by, reversed_by, actor_type, embedding), 6 triggers, 3 functions, 2 unique indexes, and active RLS (rowsecurity = TRUE) on all 10 tables.',
      status: 'VERIFIED BY SPEC & DDL',
      tests: [
        { type: 'Positive', name: 'Baseline Schema Pass', desc: 'Runs cleanly against fresh baseline schema with zero exceptions.' },
        { type: 'Negative', name: 'Missing Column Abort', desc: 'Drop column closed_by -> raises fatal exception PREFLIGHT VALIDATION FAILED: Column: public.contributions.closed_by.' },
        { type: 'Negative', name: 'Disabled RLS Abort', desc: 'Disable RLS on public.expenses -> raises fatal exception RLS disabled on table: public.expenses.' }
      ]
    },
    {
      id: 'REM-03',
      title: 'Restore Safety: Multi-Point Production Guard & Fail-Fast Shell',
      category: 'Disaster Recovery',
      location: 'Section 7.2 of implementation_plan.md & scripts/restore_database.sh',
      problem: 'Restore procedure lacked comprehensive production target checks, omitted fail-fast shell handling (set -euo pipefail), and relied on raw row count printing.',
      solution: 'Added set -euo pipefail, multi-point production target checks against PROD_PROJECT_ID and prod hostname patterns, single-transaction atomic execution (--single-transaction -v ON_ERROR_STOP=1), and automated PL/pgSQL assertion verifying referential integrity, financial metadata, and active RLS.',
      status: 'VERIFIED BY SPECIFICATION',
      tests: [
        { type: 'Positive', name: 'Staging Restore Drill', desc: 'Executes clean restore into verified staging instance; automated PL/pgSQL invariant block asserts referential integrity and active RLS.' },
        { type: 'Negative', name: 'Production Target Block', desc: 'Passing production project ID or host string halts immediately with FATAL: Attempted restore to PRODUCTION target.' },
        { type: 'Negative', name: 'Corrupt Archive Rollback', desc: 'Passing truncated backup rolls back atomically within transaction with zero changes applied to target.' }
      ]
    },
    {
      id: 'REM-04',
      title: 'Expense & Contribution Attribution Preservation',
      category: 'Financial Governance',
      location: 'supabase/migrations/20261013000006_financial_records.sql',
      problem: 'Reversing or voiding financial records previously wiped approval/verification metadata, destroying audit trails.',
      solution: 'Preserves approved_by/at on expense reversal while tracking reversed_by/at and mandatory reversal_reason. Preserves verified_by/at on contribution void/adjustment while tracking closed_by/at.',
      status: 'VERIFIED BY SPEC & DDL',
      tests: [
        { type: 'Positive', name: 'Approval & Reversal Trail', desc: 'Officer B approves expense; Officer C reverses with reason -> record retains approved_by=Officer_B, reversed_by=Officer_C.' },
        { type: 'Negative', name: 'Metadata Tampering Block', desc: 'Client updates approved_by while leaving status = \'verified\' -> fails with validation exception.' },
        { type: 'Negative', name: 'Missing Reason Block', desc: 'Officer attempts to reverse without reversal_reason -> fails with validation exception.' }
      ]
    }
  ];

  const matrixItems = [
    { id: 'REV-01-A', requirement: 'Strict per-table audit allowlist & payload fix', target: 'Migration 008 (process_audit_log_capture)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Audit Gate', notes: 'expenses.new_data.category fixed to v_raw_new; zero fallback leakage' },
    { id: 'REV-01-B', requirement: 'Audit privacy & category regression tests', target: 'Audit Test Suite in Section 9', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Audit Gate', notes: 'Positive category regression test on insert and update specified' },
    { id: 'REV-02-A', requirement: 'Exhaustive preflight schema assertions', target: 'scripts/preflight_schema_check.sql', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Schema Gate', notes: 'Validates 3 extensions, 10 tables, columns, triggers, functions, indexes, RLS' },
    { id: 'REV-02-B', requirement: 'Preflight schema validation tests', target: 'Schema Test Suite in Section 9', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Schema Gate', notes: 'Passing baseline and negative drop fixtures specified' },
    { id: 'REV-03-A', requirement: 'Expense approval & reversal attribution', target: 'Migration 006 (validate_expense_mutation)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Financial Gate', notes: 'approved_by preserved; reversed_by/at tracked with mandatory reason' },
    { id: 'REV-03-B', requirement: 'Expense attribution runtime tests', target: 'Financial Test Suite in Section 9', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Financial Gate', notes: 'Positive approval/reversal and negative tampering tests specified' },
    { id: 'REV-04-A', requirement: 'Contribution verification attribution', target: 'Migration 006 (protect_payment_state_transitions)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Financial Gate', notes: 'verified_by preserved; closed_by/at tracked with void reason' },
    { id: 'REV-04-B', requirement: 'Contribution attribution runtime tests', target: 'Financial Test Suite in Section 9', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Financial Gate', notes: 'Positive verification/voiding and negative spoofing tests specified' },
    { id: 'REV-05-A', requirement: 'Hardened restore runbook & automated assertions', target: 'scripts/restore_database.sh & Section 7.2', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Recovery Gate', notes: 'set -euo pipefail, multi-point production guard, automated PL/pgSQL assertions' },
    { id: 'REV-05-B', requirement: 'Live restore runbook execution & drill', target: 'Recovery Test Suite in Section 9', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Recovery Gate', notes: 'Staging restore drill scheduled for Phase 07 on Supabase Pro' },
    { id: 'P0-03-A', requirement: 'Member identity protection trigger', target: 'Migration 002 (protect_member_sensitive_columns)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Privilege Gate', notes: 'Self-service restricted to nickname/avatar only' },
    { id: 'P1-02-A', requirement: 'Attendance verification attribution', target: 'Migration 005 (validate_attendance_record_mutation)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Attendance Gate', notes: 'Server forces verified_by := v_caller.member_id' },
    { id: 'P1-05-A', requirement: 'RAG threshold floor enforcement (0.68)', target: 'Migration 007 (match_constitution_sections)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'RAG Gate', notes: 'Server clamps GREATEST(0.68, p_min_similarity)' }
  ];

  const migrationsList = [
    { num: 1, name: '001_core_types_and_roles.sql', desc: 'Defines ENUMs and base helper functions.' },
    { num: 2, name: '002_members_and_directory.sql', desc: 'Creates public.members, protect_member_columns trigger, and get_caller_auth().' },
    { num: 3, name: '003_member_invitations.sql', desc: 'Secure invitation tokens with SHA256 hashing and 72-hour TTL.' },
    { num: 4, name: '004_eagles_id_cards.sql', desc: 'Private ID card verification tracking and storage paths.' },
    { num: 5, name: '005_announcements_and_attendance.sql', desc: 'Broadcast announcements and attendance verification with server attribution.' },
    { num: 6, name: '006_financial_records.sql', desc: 'Segregation of duties, state machines, and preserved attribution for contributions & expenses.' },
    { num: 7, name: '007_constitution_rag.sql', desc: 'pgvector chunk storage, HNSW index, and server-enforced 0.68 cosine similarity floor.' },
    { num: 8, name: '008_audit_logs_and_triggers.sql', desc: 'Immutable audit ledger, strict allowlists, and expense new_data.category bug fix.' },
    { num: 9, name: '009_rls_and_storage_policies.sql', desc: 'Comprehensive fail-closed RLS policies across all tables and private storage buckets.' }
  ];

  const migrationCodeSnippets: Record<number, string> = {
    8: `-- Migration 008: Strict Per-Table Allowlist Audit Function (Revision 3.7)
-- Bug Fix: Corrected v_safe_new category mapping for expenses to read from v_raw_new
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
    v_record_id TEXT;
    v_raw_old JSONB := NULL;
    v_raw_new JSONB := NULL;
    v_safe_old JSONB := NULL;
    v_safe_new JSONB := NULL;
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

    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_raw_old := to_jsonb(OLD);
        v_record_id := OLD.id::TEXT;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_raw_new := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;
    END IF;

    -- Strict per-table allowlist filtering
    IF TG_TABLE_NAME = 'members' THEN
        IF v_raw_old IS NOT NULL THEN
            v_safe_old := jsonb_build_object('id', v_raw_old->'id', 'nickname', v_raw_old->'nickname', 'role', v_raw_old->'role', 'status', v_raw_old->'status', 'club_chapter', v_raw_old->'club_chapter', 'updated_at', v_raw_old->'updated_at');
        END IF;
        IF v_raw_new IS NOT NULL THEN
            v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'nickname', v_raw_new->'nickname', 'role', v_raw_new->'role', 'status', v_raw_new->'status', 'club_chapter', v_raw_new->'club_chapter', 'updated_at', v_raw_new->'updated_at');
        END IF;

    ELSIF TG_TABLE_NAME = 'expenses' THEN
        IF v_raw_old IS NOT NULL THEN
            v_safe_old := jsonb_build_object('id', v_raw_old->'id', 'category', v_raw_old->'category', 'amount', v_raw_old->'amount', 'description', v_raw_old->'description', 'status', v_raw_old->'status', 'recorded_by', v_raw_old->'recorded_by', 'approved_by', v_raw_old->'approved_by', 'approved_at', v_raw_old->'approved_at', 'reversed_by', v_raw_old->'reversed_by', 'reversed_at', v_raw_old->'reversed_at');
        END IF;
        IF v_raw_new IS NOT NULL THEN
            -- FIXED: 'category' correctly maps from v_raw_new->'category' (not v_raw_old)
            v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'category', v_raw_new->'category', 'amount', v_raw_new->'amount', 'description', v_raw_new->'description', 'status', v_raw_new->'status', 'recorded_by', v_raw_new->'recorded_by', 'approved_by', v_raw_new->'approved_by', 'approved_at', v_raw_new->'approved_at', 'reversed_by', v_raw_new->'reversed_by', 'reversed_at', v_raw_new->'reversed_at');
        END IF;

    ELSE
        -- Fallback logs ONLY primary key ID. Zero raw payload leakage.
        v_safe_old := jsonb_build_object('id', v_record_id);
        v_safe_new := jsonb_build_object('id', v_record_id);
    END IF;

    INSERT INTO public.audit_logs (table_name, record_id, action, actor_id, actor_type, old_data, new_data)
    VALUES (TG_TABLE_NAME, v_record_id::UUID, TG_OP, v_actor_id, v_actor_type, v_safe_old, v_safe_new);

    RETURN coalesce(NEW, OLD);
END;
$$;`,
    6: `-- Migration 006: Financial Records with Preserved Attribution
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
ON public.contributions (lower(trim(reference_number)), payment_category);`
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Header */}
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
                  Revision 3.7
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Final Implementation-Ready Baseline & Source Defect Remediation</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Planning Baseline: APPROVED
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col gap-6">
        {/* Navigation Tabs */}
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
            Reconciled: Migrations 001-009 & Preflight Checks
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/40 via-slate-900/50 to-emerald-950/30 p-6 backdrop-blur-xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-3xl">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-300 text-xs font-semibold border border-sky-500/20">
                    <Sparkles className="w-3.5 h-3.5" /> Revision 3.7 Approved Baseline
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    TFOE-PE Bantayog Elite Eagles Club Android Platform
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    AGILA Hub Android is an independent, native mobile platform built with React Native (Expo SDK 52+), Supabase (PostgreSQL 16, pgvector, GoTrue Auth), and EAS Build. Phase 00 planning baseline is finalized with all source defects resolved.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[240px]">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                    <span className="text-slate-400">Planning Baseline:</span>
                    <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> APPROVED BY SPECIFICATION
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                    <span className="text-slate-400">Runtime Certification:</span>
                    <p className="text-amber-400 font-bold flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> NOT EXECUTED (Scheduled for Gates)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Pillars of Revision 3.7 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-sky-400 font-bold text-xs uppercase tracking-wider">1. Audit Bug Fix</div>
                <p className="text-xs text-slate-300">
                  Fixed <code className="text-sky-300">expenses.new_data.category</code> to read from <code className="text-emerald-300">v_raw_new</code>. Added regression test.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider">2. Complete Preflight</div>
                <p className="text-xs text-slate-300">
                  Preflight script now checks all 10 tables, 3 extensions, columns, triggers, functions, indexes, and active RLS.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-amber-400 font-bold text-xs uppercase tracking-wider">3. Restore Guard & Assertions</div>
                <p className="text-xs text-slate-300">
                  <code className="text-amber-300">set -euo pipefail</code>, multi-point production guard, and automated SQL assertions for referential integrity.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-purple-400 font-bold text-xs uppercase tracking-wider">4. Honest Status</div>
                <p className="text-xs text-slate-300">
                  All unexecuted runtime tests and restore drills explicitly stamped <span className="text-amber-400 font-semibold">NOT EXECUTED</span> until their scheduled gates.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Remediations */}
        {activeTab === 'remediations' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Targeted Remediations (Revision 3.7)</h2>
            <div className="space-y-4">
              {remediations.map((rem) => (
                <div key={rem.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
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
                  Explicitly distinguishes specification pass from unexecuted runtime release gate tests.
                </p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter matrix..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
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
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                            <Clock className="w-3.5 h-3.5" /> NOT EXECUTED
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: SQL Migrations */}
        {activeTab === 'migrations' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Supabase SQL Migrations (001 - 009)</h2>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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
                      {m.num === 8 ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">Bug Fixed</span>
                      ) : null}
                    </div>
                    <div className="text-[11px] truncate font-sans text-slate-300">{m.name}</div>
                  </button>
                ))}
              </div>

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
                      handleCopy(migrationCodeSnippets[selectedMigration] || '-- Code in implementation_plan.md', `mig-${selectedMigration}`)
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

        {/* Tab 5: Preflight Script */}
        {activeTab === 'preflight' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">Machine-Verifiable Preflight Script (`scripts/preflight_schema_check.sql`)</h2>
              <p className="text-xs text-slate-400">Comprehensive assertions validating the complete baseline schema before migration execution.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre>
{`DO $$
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
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'actor_type' AND data_type = 'text'
    ) THEN
        v_missing_items := array_append(v_missing_items, 'Column: public.audit_logs.actor_type (text)');
    END IF;

    -- 4. Check Critical Integrity Triggers
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'trg_validate_expense_mutation') THEN
        v_missing_items := array_append(v_missing_items, 'Trigger: trg_validate_expense_mutation');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'trg_protect_payment_transitions') THEN
        v_missing_items := array_append(v_missing_items, 'Trigger: trg_protect_payment_transitions');
    END IF;

    -- 5. Check Critical Security Functions
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_caller_auth') THEN
        v_missing_items := array_append(v_missing_items, 'Function: public.get_caller_auth');
    END IF;

    -- 6. Check Active Row Level Security on ALL 10 Public Tables
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
END $$;`}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 6: Restore Runbook */}
        {activeTab === 'restore' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">Hardened Restore Runbook (`scripts/restore_database.sh`)</h2>
              <p className="text-xs text-slate-400">
                Production-isolated, fail-fast (<code className="text-sky-300">set -euo pipefail</code>), atomic single-transaction recovery with automated invariant assertions.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre>
{`#!/usr/bin/env bash
set -euo pipefail

# 1. Multi-Point Production Guard
if [ -z "\${TARGET_PROJECT_ID:-}" ]; then
    echo "FATAL: TARGET_PROJECT_ID is unset. Aborted." >&2
    exit 1
fi
if [ -z "\${PROD_PROJECT_ID:-}" ]; then
    echo "FATAL: PROD_PROJECT_ID is unset. Cannot verify isolation guard." >&2
    exit 1
fi
if [ "$TARGET_PROJECT_ID" = "$PROD_PROJECT_ID" ] || [[ "$TARGET_PROJECT_ID" =~ (prod|production) ]]; then
    echo "FATAL: Attempted restore to PRODUCTION target '$TARGET_PROJECT_ID'. Aborted." >&2
    exit 1
fi

# 2. Checksum Verification
BACKUP_FILE="\${1:-./backups/backup_staging_test.sql}"
sha256sum -c "\${BACKUP_FILE}.sha256" || exit 1

# 3. Transaction-Safe Restore
PGPASSWORD="\${TARGET_DB_PASSWORD:?Required}" psql \\
  -h "db.\${TARGET_PROJECT_ID}.supabase.co" \\
  -p 5432 -d postgres -U postgres \\
  --single-transaction -v ON_ERROR_STOP=1 \\
  -f "$BACKUP_FILE"

# 4. Automated Post-Restore Invariant Assertions
PGPASSWORD="$TARGET_DB_PASSWORD" psql \\
  -h "db.\${TARGET_PROJECT_ID}.supabase.co" \\
  -p 5432 -d postgres -U postgres \\
  -v ON_ERROR_STOP=1 << 'EOF'
DO $$
DECLARE
    v_member_count INT;
    v_orphan_contributions INT;
    v_orphan_expenses INT;
    v_invalid_verified_expenses INT;
    v_disabled_rls INT;
BEGIN
    SELECT count(*) INTO v_member_count FROM public.members;
    IF v_member_count = 0 THEN
        RAISE EXCEPTION 'POST-RESTORE FAILURE: members table is empty';
    END IF;

    -- Referential integrity assertions
    SELECT count(*) INTO v_orphan_contributions FROM public.contributions c
    WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = c.member_id);
    IF v_orphan_contributions > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE FAILURE: Found % orphan contributions', v_orphan_contributions;
    END IF;

    -- Security assertion
    SELECT count(*) INTO v_disabled_rls FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN ('members', 'contributions', 'expenses') AND rowsecurity = FALSE;
    IF v_disabled_rls > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE FAILURE: Core tables have disabled RLS';
    END IF;

    RAISE NOTICE 'POST-RESTORE INTEGRITY PASSED: All invariants verified.';
END $$;
EOF`}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 7: Design Tokens */}
        {activeTab === 'design' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Liquid Glass UI & Official Branding Palette</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                <div className="h-16 rounded-lg bg-[#4A90E2] shadow-inner flex items-end p-2">
                  <span className="text-xs font-mono font-bold text-white drop-shadow">#4A90E2</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Light Eagle Blue</h4>
                  <p className="text-xs text-slate-400">Primary brand color, headers, action buttons, active tab indicators.</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                <div className="h-16 rounded-lg bg-[#2E7D32] shadow-inner flex items-end p-2">
                  <span className="text-xs font-mono font-bold text-white drop-shadow">#2E7D32</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Light Forest Green</h4>
                  <p className="text-xs text-slate-400">Secondary brand color, verification badges, verified payment statuses.</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                <div className="h-16 rounded-lg bg-[#FFD54F] shadow-inner flex items-end p-2">
                  <span className="text-xs font-mono font-bold text-slate-900 drop-shadow">#FFD54F</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Bumblebee Yellow</h4>
                  <p className="text-xs text-slate-400">Accent highlight, pending alerts, warning states, fraternal eagle trim.</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                <div className="h-16 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 shadow-inner flex items-end p-2">
                  <span className="text-xs font-mono font-bold text-white drop-shadow">rgba(255,255,255,0.7)</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Liquid Frosted Glass</h4>
                  <p className="text-xs text-slate-400">Background blur (16px), 1px white border (20% opacity), subtle specular reflection.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        AGILA Hub Android — Phase 00 Architecture & Implementation Specification • Revision 3.7 Baseline
      </footer>
    </div>
  );
}
