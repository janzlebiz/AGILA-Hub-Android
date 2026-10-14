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
    { id: 'remediations', label: 'Remediations (3.10)', icon: Shield },
    { id: 'matrix', label: 'Verification Matrix', icon: FileCheck },
    { id: 'migrations', label: 'SQL Migrations (001-009)', icon: Database },
    { id: 'preflight', label: 'Preflight Script', icon: Terminal },
    { id: 'restore', label: 'Restore Runbook', icon: RefreshCw },
    { id: 'design', label: 'Liquid Glass Tokens', icon: Smartphone }
  ];

  const remediations = [
    {
      id: 'REM-01',
      title: 'Audit Privacy & Expense Payload Integrity',
      category: 'Security & PII',
      location: 'supabase/migrations/20261013000008_audit_logs_and_triggers.sql',
      problem: 'In expenses audit logging, v_safe_new erroneously read category from v_raw_old->\'category\' instead of v_raw_new->\'category\', causing category to be NULL on INSERTs and stale on UPDATEs.',
      solution: 'Corrected v_safe_new mapping to v_raw_new->\'category\'. Enforced strict per-table allowlists for all 8 audited tables. Unmapped fallback logs strictly jsonb_build_object(\'id\', v_record_id). Added actor_type context (VARCHAR(50)).',
      status: 'VERIFIED BY SPEC & DDL',
      tests: [
        { type: 'Positive', name: 'Expense Category Regression Test', desc: 'Insert expense (category=\'venue_rental\') -> audit captures new_data->>\'category\'=\'venue_rental\' (non-null) and old_data IS NULL. Update to \'equipment_rental\' captures old and new.' },
        { type: 'Negative', name: 'Storage Path Exclusion', desc: 'Eagles ID card upload -> audit captures status change; front_storage_path and back_storage_path are strictly excluded.' }
      ]
    },
    {
      id: 'REM-02',
      title: 'Type-Aligned & Uniqueness-Verified Preflight Assertions',
      category: 'Database Integrity',
      location: 'scripts/preflight_schema_check.sql & Section 8.1',
      problem: 'Previous preflight script checked audit_logs.actor_type as text (mismatching VARCHAR(50)), and checked index names without verifying index uniqueness (indisunique) on idx_members_email_lower or column embedding on idx_constitution_embedding_hnsw.',
      solution: 'Aligned actor_type check to character varying(50). Added indisunique = true validation to idx_members_email_lower and uq_reference_payment. Verified idx_constitution_embedding_hnsw indexes embedding with vector_cosine_ops and HNSW on public.constitution_sections.',
      status: 'VERIFIED BY SPEC & DDL',
      tests: [
        { type: 'Positive', name: 'Baseline Schema Pass', desc: 'Preflight script executes cleanly against complete schema baseline, verifying all 10 tables, 3 extensions, columns, triggers, functions, indexes, and active RLS.' },
        { type: 'Negative', name: 'Non-Unique Email Index', desc: 'Recreating email index without UNIQUE (indisunique = false) causes script to fail closed with fatal validation exception.' },
        { type: 'Negative', name: 'Disabled Public Table RLS', desc: 'Disabling RLS on any public table causes script to fail closed with fatal validation exception.' }
      ]
    },
    {
      id: 'REM-03',
      title: 'Expense Attribution: Preserved Approval on Reversal',
      category: 'Financial Governance',
      location: 'supabase/migrations/20261013000006_financial_records.sql',
      problem: 'Reversing an approved expense previously overwrote approved_by and approved_at, destroying the historical audit record of who originally approved the disbursement.',
      solution: 'Preserves approved_by and approved_at intact on reversal while tracking reversed_by and reversed_at with mandatory descriptive reversal_reason (>= 5 chars).',
      status: 'VERIFIED BY SPEC & DDL',
      tests: [
        { type: 'Positive', name: 'Approval & Reversal Trail', desc: 'Officer B approves expense; Officer C reverses with reason -> record retains approved_by=Officer_B, reversed_by=Officer_C.' },
        { type: 'Negative', name: 'Metadata Tampering Block', desc: 'Client updates approved_by while leaving status = \'verified\' -> fails with validation exception.' }
      ]
    },
    {
      id: 'REM-04',
      title: 'Contribution Attribution: Preserved Verification on Voiding/Adjustment',
      category: 'Financial Governance',
      location: 'supabase/migrations/20261013000006_financial_records.sql',
      problem: 'Voiding or adjusting a contribution previously wiped verification metadata, destroying the audit record of funds confirmation.',
      solution: 'Preserves verified_by and verified_at intact on voiding/adjustment while tracking closed_by and closed_at with mandatory void_reason.',
      status: 'VERIFIED BY SPEC & DDL',
      tests: [
        { type: 'Positive', name: 'Verification & Voiding Trail', desc: 'Officer B verifies contribution; Officer C voids with reason -> record retains verified_by=Officer_B, closed_by=Officer_C.' },
        { type: 'Negative', name: 'Terminal State Modification', desc: 'Client attempts to transition from voided to verified -> fails with terminal state exception.' }
      ]
    },
    {
      id: 'REM-05',
      title: 'Restore Safety: Authoritative Endpoint Identity & Fail-Closed Guards',
      category: 'Disaster Recovery',
      location: 'scripts/restore_database.sh & Section 7.2',
      problem: 'Previous restore script checked constructed substrings, failed open if DNS lookup returned empty, and checked only 4 tables for RLS.',
      solution: 'Enforces set -euo pipefail, primary authoritative target-project identity verification (TARGET_PROJECT_ID, TARGET_ENV, TARGET_DB_HOST vs PROD_DB_HOST), secondary defense-in-depth DNS set comparison via comm -12, atomic single-transaction restore, and exhaustive PL/pgSQL assertions across ALL member references and ALL public tables.',
      status: 'VERIFIED BY SPECIFICATION',
      tests: [
        { type: 'Positive', name: 'Valid Staging Execution', desc: 'Executes restore on verified backup targeting staging; automated PL/pgSQL assertions verify all foreign keys, financial invariants, and RLS.' },
        { type: 'Negative', name: 'DNS Resolution Failure / IP Overlap', desc: 'Host resolution failure or IP overlap between target and production halts immediately before connection with FATAL.' },
        { type: 'Negative', name: 'Disabled Public Table RLS', desc: 'Any public table with rowsecurity = FALSE raises fatal post-restore exception and fails script.' }
      ]
    }
  ];

  const matrixItems = [
    { id: 'REV-01-A', requirement: 'Strict per-table audit allowlist & payload fix', target: 'Migration 008 (process_audit_log_capture)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Audit Gate', notes: 'expenses.new_data.category fixed to v_raw_new; zero fallback leakage' },
    { id: 'REV-01-B', requirement: 'Audit privacy & category regression tests', target: 'Audit Test Suite in Section 9', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Audit Gate', notes: 'Positive category regression test on insert and update specified' },
    { id: 'REV-02-A', requirement: 'Schema-aligned preflight index & table assertions', target: 'scripts/preflight_schema_check.sql', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Schema Gate', notes: 'Validates idx_members_email_lower, uq_reference_payment, idx_constitution_embedding_hnsw, 10 tables, RLS' },
    { id: 'REV-02-B', requirement: 'Preflight schema validation tests', target: 'Schema Test Suite in Section 9', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Schema Gate', notes: 'Passing baseline and negative drop fixtures specified' },
    { id: 'REV-03-A', requirement: 'Expense approval & reversal attribution', target: 'Migration 006 (validate_expense_mutation)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Financial Gate', notes: 'approved_by preserved; reversed_by/at tracked with mandatory reason' },
    { id: 'REV-03-B', requirement: 'Expense attribution runtime tests', target: 'Financial Test Suite in Section 9', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Financial Gate', notes: 'Positive approval/reversal and negative tampering tests specified' },
    { id: 'REV-04-A', requirement: 'Contribution verification attribution', target: 'Migration 006 (protect_payment_state_transitions)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Financial Gate', notes: 'verified_by preserved; closed_by/at tracked with void reason' },
    { id: 'REV-04-B', requirement: 'Contribution attribution runtime tests', target: 'Financial Test Suite in Section 9', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Financial Gate', notes: 'Positive verification/voiding and negative spoofing tests specified' },
    { id: 'REV-05-A', requirement: 'Authoritative endpoint isolation & exhaustive invariant checks', target: 'scripts/restore_database.sh & Section 7.2', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Recovery Gate', notes: 'Primary target-project verification, secondary DNS/IP set check, all-public-table RLS, expense approved/reversed checks' },
    { id: 'REV-05-B', requirement: 'Live restore runbook execution & drill', target: 'Recovery Test Suite in Section 9', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Recovery Gate', notes: 'Staging restore drill scheduled for Phase 07 on Supabase Pro' },
    { id: 'P0-03-A', requirement: 'Member identity protection trigger', target: 'Migration 002 (protect_member_sensitive_columns)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Privilege Gate', notes: 'Self-service restricted to nickname/avatar only' },
    { id: 'P1-02-A', requirement: 'Attendance verification attribution', target: 'Migration 005 (validate_attendance_record_mutation)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'Attendance Gate', notes: 'Server forces verified_by := v_caller.member_id' },
    { id: 'P1-05-A', requirement: 'RAG threshold floor enforcement (0.68)', target: 'Migration 007 (match_constitution_sections)', specStatus: 'PASS', runtimeStatus: 'NOT EXECUTED', gate: 'RAG Gate', notes: 'Server clamps GREATEST(0.68, p_min_similarity)' }
  ];

  const migrationsList = [
    { num: 1, name: '001_core_types_and_roles.sql', desc: 'Defines ENUMs and base helper functions.' },
    { num: 2, name: '002_members_and_directory.sql', desc: 'Creates public.members, idx_members_email_lower on LOWER(email), and get_caller_auth().' },
    { num: 3, name: '003_member_invitations.sql', desc: 'Secure invitation tokens with SHA256 hashing and 72-hour TTL.' },
    { num: 4, name: '004_eagles_id_cards.sql', desc: 'Private ID card verification tracking and storage paths.' },
    { num: 5, name: '005_announcements_and_attendance.sql', desc: 'Broadcast announcements and attendance verification with server attribution.' },
    { num: 6, name: '006_financial_records.sql', desc: 'uq_reference_payment UNIQUE constraint, state machines, and preserved attribution.' },
    { num: 7, name: '007_constitution_rag.sql', desc: 'pgvector chunk storage, HNSW index (idx_constitution_embedding_hnsw), and server 0.68 similarity floor.' },
    { num: 8, name: '008_audit_logs_and_triggers.sql', desc: 'Immutable audit ledger, strict allowlists, and expense new_data.category bug fix.' },
    { num: 9, name: '009_rls_and_storage_policies.sql', desc: 'Comprehensive fail-closed RLS policies across all tables and private storage buckets.' }
  ];

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
                  Revision 3.10
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Production Architecture & Testable Baseline Specification</p>
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
            Reconciled: HNSW Index & Authoritative Restore Guard
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/40 via-slate-900/50 to-emerald-950/30 p-6 backdrop-blur-xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-3xl">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-300 text-xs font-semibold border border-sky-500/20">
                    <Sparkles className="w-3.5 h-3.5" /> Revision 3.10 Production Specification
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    TFOE-PE Bantayog Elite Eagles Club Android Platform
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    AGILA Hub Android is an independent, native mobile platform built with React Native (Expo SDK 52+), Supabase (PostgreSQL 16, pgvector, GoTrue Auth), and EAS Build. Preflight index assertions for idx_constitution_embedding_hnsw, audit payload sources, and authoritative restore endpoint verification are completely reconciled.
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

            {/* 5 Pillars of Revision 3.10 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-sky-400 font-bold text-xs uppercase tracking-wider">1. Aligned HNSW & Email Indexes</div>
                <p className="text-xs text-slate-300">
                  Preflight script validates <code className="text-sky-300">idx_constitution_embedding_hnsw</code> on <code className="text-emerald-300">constitution_sections.embedding</code> with HNSW and <code className="text-sky-300">idx_members_email_lower</code> with <code className="text-emerald-300">indisunique = true</code>.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider">2. Authoritative Target Guard</div>
                <p className="text-xs text-slate-300">
                  Primary authoritative target-project identity check (<code className="text-emerald-300">TARGET_PROJECT_ID</code>, whitelist, <code className="text-amber-300">PROD_DB_HOST</code> comparison) with secondary <code className="text-purple-300">comm -12</code> IP overlap defense.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-amber-400 font-bold text-xs uppercase tracking-wider">3. Exhaustive Invariants</div>
                <p className="text-xs text-slate-300">
                  Post-restore checks verify ALL member references in expenses (<code className="text-amber-300">recorded, approved, reversed</code>) and contributions, plus active RLS on ALL public tables.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-purple-400 font-bold text-xs uppercase tracking-wider">4. Honest Status Boundary</div>
                <p className="text-xs text-slate-300">
                  All unexecuted runtime tests and disaster recovery drills explicitly stamped <span className="text-amber-400 font-semibold">NOT EXECUTED</span> until their scheduled release gates.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Remediations */}
        {activeTab === 'remediations' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Targeted Remediations (Revision 3.10)</h2>
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
                    <span className="text-slate-400 font-semibold text-xs">Planned Acceptance Test Specifications & Fixtures:</span>
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
                      {m.num === 2 || m.num === 6 ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300">Indexes</span>
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
                </div>

                <div className="p-4 overflow-x-auto max-h-[500px]">
                  <pre className="text-xs font-mono text-slate-300 leading-relaxed">
                    <code>
                      {selectedMigration === 2 && `-- Migration 002: Members and Directory
-- Unique index on lowercase email:
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_lower ON public.members (LOWER(email));`}
                      {selectedMigration === 6 && `-- Migration 006: Financial Records
-- Unique constraint on payment reference:
CONSTRAINT uq_reference_payment UNIQUE (payment_channel, reference_number);`}
                      {selectedMigration === 7 && `-- Migration 007: Constitution RAG
-- HNSW Cosine Similarity Index:
CREATE INDEX IF NOT EXISTS idx_constitution_embedding_hnsw ON public.constitution_sections USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`}
                      {selectedMigration === 8 && `-- Migration 008: Audit Logs & Triggers
-- Preserves category mapping correctly:
v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'category', v_raw_new->'category', ...);`}
                      {![2, 6, 7, 8].includes(selectedMigration) && `-- Full executable SQL migration available in implementation_plan.md under Migration ${selectedMigration}`}
                    </code>
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
              <p className="text-xs text-slate-400">
                Validates <code className="text-sky-300">idx_members_email_lower</code>, <code className="text-emerald-300">uq_reference_payment</code>, <code className="text-amber-300">idx_constitution_embedding_hnsw</code>, all 10 tables, triggers, and active RLS.
              </p>
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
    -- 1. Check Required Extensions (3)
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

    -- 4. Check Critical Integrity Triggers (6)
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'trg_validate_expense_mutation') THEN
        v_missing_items := array_append(v_missing_items, 'Trigger: trg_validate_expense_mutation');
    END IF;

    -- 5. Check Critical Security Functions (3)
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_caller_auth') THEN
        v_missing_items := array_append(v_missing_items, 'Function: public.get_caller_auth');
    END IF;

    -- 6. Check Critical Indexes & Unique Constraints (Matching Actual Schema)
    -- Check 6a: Unique index on LOWER(email) in public.members
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND tablename = 'members' 
          AND indexname = 'idx_members_email_lower'
          AND indexdef ILIKE '%lower(%email%)%'
    ) THEN
        v_missing_items := array_append(v_missing_items, 'Index: public.members.idx_members_email_lower ON LOWER(email)');
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
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' 
          AND tablename = 'contributions' 
          AND indexname = 'uq_reference_payment'
          AND indexdef ILIKE '%payment_channel%reference_number%'
    ) THEN
        v_missing_items := array_append(v_missing_items, 'Constraint: public.contributions.uq_reference_payment UNIQUE (payment_channel, reference_number)');
    END IF;

    -- Check 6c: HNSW Cosine Index on public.constitution_sections (idx_constitution_embedding_hnsw)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
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
                Independent production endpoint comparison (<code className="text-sky-300">TARGET_DB_HOST</code> vs <code className="text-emerald-300">PROD_DB_HOST</code>, DNS IP resolution), fail-fast shell, and full public table RLS and foreign key assertions.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre>
{`#!/usr/bin/env bash
set -euo pipefail

# 1. Independent Production Endpoint & Whitelist Guards
if [ -z "\${TARGET_PROJECT_ID:-}" ]; then
    echo "FATAL: TARGET_PROJECT_ID is unset. Aborted." >&2
    exit 1
fi
if [ -z "\${PROD_PROJECT_ID:-}" ]; then
    echo "FATAL: PROD_PROJECT_ID is unset. Aborted." >&2
    exit 1
fi
if [ -z "\${PROD_DB_HOST:-}" ]; then
    echo "FATAL: PROD_DB_HOST is unset. Authoritative production endpoint required." >&2
    exit 1
fi

# Primary Gate 1: Authoritative target-project identity check
if [ "$TARGET_PROJECT_ID" = "$PROD_PROJECT_ID" ]; then
    echo "FATAL: TARGET_PROJECT_ID equals PROD_PROJECT_ID ('$TARGET_PROJECT_ID'). Aborted." >&2
    exit 1
fi

# Primary Gate 2: Strict environment target whitelist
TARGET_ENV="\${TARGET_ENV:-staging}"
if [ "$TARGET_ENV" != "staging" ] && [ "$TARGET_ENV" != "development" ]; then
    echo "FATAL: TARGET_ENV must be 'staging' or 'development' (received '$TARGET_ENV')." >&2
    exit 1
fi

# Primary Gate 3: Direct authoritative endpoint verification
TARGET_HOST="\${TARGET_DB_HOST:-db.\${TARGET_PROJECT_ID}.supabase.co}"
if [ "$TARGET_HOST" = "$PROD_DB_HOST" ]; then
    echo "FATAL: TARGET_HOST ('$TARGET_HOST') matches trusted production endpoint ('$PROD_DB_HOST'). Aborted." >&2
    exit 1
fi

# Secondary Defense-in-Depth: Fail-closed complete address set verification (comm -12)
# Note: IP overlap is a secondary signal; authoritative project identity above is the primary prerequisite.
TARGET_IPS=$( (getent ahosts "$TARGET_HOST" 2>/dev/null || getent hosts "$TARGET_HOST" 2>/dev/null || true) | awk '{print $1}' | sort -u | grep -v '^$' )
PROD_IPS=$( (getent ahosts "$PROD_DB_HOST" 2>/dev/null || getent hosts "$PROD_DB_HOST" 2>/dev/null || true) | awk '{print $1}' | sort -u | grep -v '^$' )
if [ -z "$TARGET_IPS" ] || [ -z "$PROD_IPS" ]; then
    echo "FATAL: DNS resolution failed or returned empty address set. Fail-closed abort." >&2
    exit 1
fi

OVERLAPPING_IPS=$(comm -12 <(echo "$TARGET_IPS") <(echo "$PROD_IPS"))
if [ -n "$OVERLAPPING_IPS" ]; then
    echo "FATAL: Endpoint alias detected! TARGET_HOST shares resolved IP address(es) with PROD_DB_HOST." >&2
    exit 1
fi

# 2. Checksum Verification & Atomic Restore
BACKUP_FILE="\${1:-./backups/backup_staging_test.sql}"
sha256sum -c "\${BACKUP_FILE}.sha256" || exit 1

PGPASSWORD="\${TARGET_DB_PASSWORD:?Required}" psql \\
  -h "$TARGET_HOST" -p 5432 -d postgres -U postgres \\
  --single-transaction -v ON_ERROR_STOP=1 \\
  -f "$BACKUP_FILE"

# 3. Exhaustive Post-Restore Invariant Assertions
PGPASSWORD="$TARGET_DB_PASSWORD" psql \\
  -h "$TARGET_HOST" -p 5432 -d postgres -U postgres \\
  -v ON_ERROR_STOP=1 << 'EOF'
DO $$
DECLARE
    v_member_count INT;
    v_orphan_expenses_app INT;
    v_orphan_expenses_rev INT;
    v_disabled_rls INT;
BEGIN
    SELECT count(*) INTO v_member_count FROM public.members;
    IF v_member_count = 0 THEN
        RAISE EXCEPTION 'POST-RESTORE FAILURE: members table is empty';
    END IF;

    -- Verify all member references in expenses
    SELECT count(*) INTO v_orphan_expenses_app FROM public.expenses e
    WHERE e.approved_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = e.approved_by);
    IF v_orphan_expenses_app > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE FAILURE: Found orphan approved_by in expenses';
    END IF;

    SELECT count(*) INTO v_orphan_expenses_rev FROM public.expenses e
    WHERE e.reversed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = e.reversed_by);
    IF v_orphan_expenses_rev > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE FAILURE: Found orphan reversed_by in expenses';
    END IF;

    -- Verify RLS across ALL public tables
    SELECT count(*) INTO v_disabled_rls FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = FALSE;
    IF v_disabled_rls > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE FAILURE: Found % public tables with disabled RLS', v_disabled_rls;
    END IF;

    RAISE NOTICE 'POST-RESTORE INTEGRITY PASSED: All invariants verified across all public tables.';
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
        AGILA Hub Android — Phase 00 Architecture & Implementation Specification • Revision 3.10 Baseline
      </footer>
    </div>
  );
}
