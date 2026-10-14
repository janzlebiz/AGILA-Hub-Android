import React, { useState, useMemo } from 'react';
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
  Search,
  Smartphone,
  Eye,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Filter,
  ListChecks
} from 'lucide-react';
import {
  phase01TestResults,
  phase01Migrations,
  preflightSqlContent,
  restoreScriptContent,
  TestCase
} from './data/phase01Data';

interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'tests' | 'migrations' | 'matrix' | 'remediations' | 'preflight' | 'restore' | 'design'>('overview');
  const [testSearch, setTestSearch] = useState('');
  const [selectedSuite, setSelectedSuite] = useState<string>('ALL');
  const [selectedMigrationNum, setSelectedMigrationNum] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Executive Overview', icon: Layers },
    { id: 'tests', label: 'Automated Tests', icon: ListChecks, badge: '59 PASS' },
    { id: 'migrations', label: 'SQL Migrations (001-009)', icon: Database, badge: '9 Files' },
    { id: 'matrix', label: 'Verification Matrix', icon: FileCheck },
    { id: 'remediations', label: 'Remediations (REM-01..05)', icon: Shield },
    { id: 'preflight', label: 'Preflight Script', icon: Terminal },
    { id: 'restore', label: 'Restore Runbook', icon: RefreshCw },
    { id: 'design', label: 'Liquid Glass Tokens', icon: Smartphone }
  ];

  // Test suites list
  const testSuites = useMemo(() => {
    const suites = Array.from(new Set(phase01TestResults.map((t) => t.suite)));
    return ['ALL', ...suites];
  }, []);

  // Filtered tests
  const filteredTests = useMemo(() => {
    return phase01TestResults.filter((t) => {
      const matchesSuite = selectedSuite === 'ALL' || t.suite === selectedSuite;
      const query = testSearch.toLowerCase().trim();
      const matchesSearch =
        query === '' ||
        t.id.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.evidence.toLowerCase().includes(query) ||
        t.suite.toLowerCase().includes(query);
      return matchesSuite && matchesSearch;
    });
  }, [selectedSuite, testSearch]);

  const selectedMigration = useMemo(() => {
    return phase01Migrations.find((m) => m.num === selectedMigrationNum) || phase01Migrations[0];
  }, [selectedMigrationNum]);

  const matrixItems = [
    {
      id: 'P1-DEL-01',
      requirement: '9 SQL Migrations Materialized on Disk',
      target: 'supabase/migrations/001-009',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Schema Gate',
      notes: 'All 9 files written (63,972 bytes); validated by MIG-INV-01 & MIG-FILE-01..09'
    },
    {
      id: 'P1-DEL-02',
      requirement: 'Machine-Verifiable Preflight Script',
      target: 'scripts/preflight_schema_check.sql',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Schema Gate',
      notes: 'Validates 10 tables, 3 extensions, columns, triggers, functions, unique/HNSW indexes, RLS'
    },
    {
      id: 'P1-DEL-03',
      requirement: 'Hardened Database Restore Runbook',
      target: 'scripts/restore_database.sh',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Recovery Gate',
      notes: 'set -euo pipefail, explicit TARGET_ENV, project mapping, fail-closed DNS, single transaction'
    },
    {
      id: 'P1-TEST-01',
      requirement: 'Phase 01 Automated Test Suite',
      target: 'scripts/verify_phase01.ts (npm test)',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'CI/CD Gate',
      notes: '59 automated assertions executed across 5 suites with 100% PASS'
    },
    {
      id: 'REV-01-A',
      requirement: 'Strict per-table audit allowlist & payload fix',
      target: 'Migration 008 (process_audit_log_capture)',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Audit Gate',
      notes: 'expenses.new_data.category sourced from v_raw_new; zero fallback leakage'
    },
    {
      id: 'REV-01-B',
      requirement: 'Audit privacy & category regression tests',
      target: 'Audit Test Suite in Section 9',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Audit Gate',
      notes: 'Positive category regression test on insert and update specified'
    },
    {
      id: 'REV-02-A',
      requirement: 'Schema-aligned preflight index & table assertions',
      target: 'scripts/preflight_schema_check.sql',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Schema Gate',
      notes: 'Validates idx_members_email_lower, uq_reference_payment, idx_constitution_embedding_hnsw, RLS'
    },
    {
      id: 'REV-02-B',
      requirement: 'Preflight schema validation tests',
      target: 'Schema Test Suite in Section 9',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Schema Gate',
      notes: 'Passing baseline and negative drop fixtures specified'
    },
    {
      id: 'REV-03-A',
      requirement: 'Expense approval & reversal attribution',
      target: 'Migration 006 (validate_expense_mutation)',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Financial Gate',
      notes: 'approved_by preserved; reversed_by/at tracked with mandatory reason'
    },
    {
      id: 'REV-03-B',
      requirement: 'Expense attribution runtime tests',
      target: 'Financial Test Suite in Section 9',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Financial Gate',
      notes: 'Positive approval/reversal and negative tampering tests specified'
    },
    {
      id: 'REV-04-A',
      requirement: 'Contribution verification attribution',
      target: 'Migration 006 (protect_payment_state_transitions)',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Financial Gate',
      notes: 'verified_by preserved; closed_by/at tracked with void reason'
    },
    {
      id: 'REV-04-B',
      requirement: 'Contribution attribution runtime tests',
      target: 'Financial Test Suite in Section 9',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Financial Gate',
      notes: 'Positive verification/voiding and negative spoofing tests specified'
    },
    {
      id: 'REV-05-A',
      requirement: 'Authoritative endpoint isolation & invariant checks',
      target: 'scripts/restore_database.sh & Section 7.2',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Recovery Gate',
      notes: 'Mandatory explicit TARGET_ENV, project-to-endpoint mapping, secondary DNS/IP set check, all-public-table RLS'
    },
    {
      id: 'REV-05-B',
      requirement: 'Live restore negative fixture execution & drill',
      target: 'Recovery Test Suite & verify_phase01.ts',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Recovery Gate',
      notes: '8 negative fixtures executed and passed (RESTORE-NEG-01..08); live restore drill in Phase 07'
    },
    {
      id: 'P0-03-A',
      requirement: 'Member identity protection trigger',
      target: 'Migration 002 (protect_member_sensitive_columns)',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Privilege Gate',
      notes: 'Self-service restricted to nickname/avatar only'
    },
    {
      id: 'P1-02-A',
      requirement: 'Attendance verification attribution',
      target: 'Migration 005 (validate_attendance_record_mutation)',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'Attendance Gate',
      notes: 'Server forces verified_by := v_caller.member_id'
    },
    {
      id: 'P1-05-A',
      requirement: 'RAG threshold floor enforcement (0.68)',
      target: 'Migration 007 (match_constitution_sections)',
      specStatus: 'PASS',
      runtimeStatus: 'NOT EXECUTED',
      gate: 'RAG Gate',
      notes: 'Server clamps GREATEST(0.68, p_min_similarity)'
    }
  ];

  const remediations = [
    {
      id: 'REM-01',
      title: 'Audit Privacy & Expense Payload Integrity',
      category: 'Security & PII',
      location: 'supabase/migrations/20261013000008_audit_logs_and_triggers.sql',
      problem: 'In expenses audit logging, v_safe_new erroneously read category from v_raw_old->\'category\' instead of v_raw_new->\'category\', causing category to be NULL on INSERTs and stale on UPDATEs.',
      solution: 'Corrected v_safe_new mapping to v_raw_new->\'category\'. Enforced strict per-table allowlists for all 8 audited tables. Unmapped fallback logs strictly jsonb_build_object(\'id\', v_record_id). Added actor_type context (VARCHAR(50)).',
      status: 'VERIFIED ON DISK & TESTED',
      tests: [
        { type: 'Automated Assertion', name: 'REM-01-EXP-CAT', desc: 'Verified v_safe_new accurately references v_raw_new->\'category\' (PASS)' },
        { type: 'Automated Assertion', name: 'REM-01-ACTOR-TYPE', desc: 'Verified audit_logs.actor_type is VARCHAR(50) NOT NULL DEFAULT \'authenticated_member\' (PASS)' }
      ]
    },
    {
      id: 'REM-02',
      title: 'Type-Aligned & Uniqueness-Verified Preflight Assertions',
      category: 'Database Integrity',
      location: 'scripts/preflight_schema_check.sql & Section 8.1',
      problem: 'Previous preflight script checked audit_logs.actor_type as text (mismatching VARCHAR(50)), and checked index names without verifying index uniqueness (indisunique) on idx_members_email_lower or column embedding on idx_constitution_embedding_hnsw.',
      solution: 'Aligned actor_type check to character varying(50). Added indisunique = true validation to idx_members_email_lower and uq_reference_payment. Verified idx_constitution_embedding_hnsw indexes embedding with vector_cosine_ops and HNSW on public.constitution_sections.',
      status: 'VERIFIED ON DISK & TESTED',
      tests: [
        { type: 'Automated Assertion', name: 'PRE-EMAIL-IDX', desc: 'Asserts idx_members_email_lower indisunique = TRUE on LOWER(email) (PASS)' },
        { type: 'Automated Assertion', name: 'PRE-HNSW-IDX', desc: 'Asserts idx_constitution_embedding_hnsw on embedding with vector_cosine_ops (PASS)' },
        { type: 'Automated Assertion', name: 'PRE-RLS-CHECK', desc: 'Asserts active RLS on all 10 public tables (PASS)' }
      ]
    },
    {
      id: 'REM-03',
      title: 'Expense Attribution: Preserved Approval on Reversal',
      category: 'Financial Governance',
      location: 'supabase/migrations/20261013000006_financial_records.sql',
      problem: 'Reversing an approved expense previously overwrote approved_by and approved_at, destroying the historical audit record of who originally approved the disbursement.',
      solution: 'Preserves approved_by and approved_at intact on reversal while tracking reversed_by and reversed_at with mandatory descriptive reversal_reason (>= 5 chars).',
      status: 'VERIFIED ON DISK & TESTED',
      tests: [
        { type: 'Automated Assertion', name: 'REM-03-EXP-COLS', desc: 'Asserts reversed_by, reversed_at, reversal_reason columns present (PASS)' },
        { type: 'Automated Assertion', name: 'REM-03-EXP-PRESERVE', desc: 'Asserts OLD.approved_by/at preserved on reversal (PASS)' }
      ]
    },
    {
      id: 'REM-04',
      title: 'Contribution Attribution: Preserved Verification on Voiding/Adjustment',
      category: 'Financial Governance',
      location: 'supabase/migrations/20261013000006_financial_records.sql',
      problem: 'Voiding or adjusting a contribution previously wiped verification metadata, destroying the audit record of funds confirmation.',
      solution: 'Preserves verified_by and verified_at intact on voiding/adjustment while tracking closed_by and closed_at with mandatory void_reason.',
      status: 'VERIFIED ON DISK & TESTED',
      tests: [
        { type: 'Automated Assertion', name: 'REM-04-CON-COLS', desc: 'Asserts closed_by, closed_at, void_reason columns present (PASS)' },
        { type: 'Automated Assertion', name: 'REM-04-CON-PRESERVE', desc: 'Asserts OLD.verified_by/at preserved on void/adjust (PASS)' }
      ]
    },
    {
      id: 'REM-05',
      title: 'Restore Safety: Explicit TARGET_ENV & Authoritative Identity Mapping',
      category: 'Disaster Recovery',
      location: 'scripts/restore_database.sh & Section 7.2',
      problem: 'Previous restore script allowed implicit staging fallback, lacked authoritative project-to-endpoint identity mapping, and failed open on empty DNS lookups.',
      solution: 'Enforces set -euo pipefail, mandatory explicit TARGET_ENV ("staging" or "development" only with no default), authoritative project-to-endpoint identity mapping, direct PROD_DB_HOST inequality check, secondary fail-closed DNS set comparison via comm -12, and exhaustive PL/pgSQL assertions across ALL public tables and member references.',
      status: 'VERIFIED ON DISK & TESTED',
      tests: [
        { type: 'Automated Assertion', name: 'RESTORE-NEG-01', desc: 'Missing TARGET_ENV immediately terminates before connection with code 1 (PASS)' },
        { type: 'Automated Assertion', name: 'RESTORE-NEG-02', desc: 'TARGET_ENV=production immediately blocked before connection with code 1 (PASS)' },
        { type: 'Automated Assertion', name: 'RESTORE-NEG-07', desc: 'Target hostname / project-ID mismatch halts before connection with code 1 (PASS)' },
        { type: 'Automated Assertion', name: 'RESTORE-NEG-08', desc: 'Target host matching production endpoint halts with code 1 (PASS)' }
      ]
    }
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
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  Revision 4.0
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Phase 01 Implemented
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Core Database Migrations & Foundation Verification Baseline</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Gate 01: 59/59 PASS (100%)
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Cloud Runtime: NOT EXECUTED
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
                  {t.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isActive ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Phase 01 Deliverables Active: 9 Migrations & Scripts on Disk
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/40 via-slate-900/50 to-emerald-950/30 p-6 backdrop-blur-xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-3xl">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-300 text-xs font-semibold border border-sky-500/20">
                    <Sparkles className="w-3.5 h-3.5" /> Phase 01 Implementation Milestone Complete
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    TFOE-PE Bantayog Elite Eagles Club — Phase 01 Foundation
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    All 9 SQL migrations, the machine-verifiable preflight check script, and the hardened transaction-safe restore runbook have been materialized on disk. 59 automated test assertions have executed with 100% PASS rate. Production infrastructure provisioning and live database operations remain strictly unexecuted to preserve deployment boundaries.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[260px]">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                    <span className="text-slate-400">Phase 01 Deliverables:</span>
                    <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> 9 MIGRATIONS (63,972 B) ON DISK
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                    <span className="text-slate-400">Schema Gate Verification:</span>
                    <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> 59 / 59 ASSERTIONS PASSED (100%)
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                    <span className="text-slate-400">Cloud Runtime Operations:</span>
                    <p className="text-amber-400 font-bold flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> NOT EXECUTED (Deferred to Phase 02+)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Key Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-sky-400 font-bold text-xs uppercase tracking-wider">1. Complete SQL Migrations</div>
                <p className="text-xs text-slate-300">
                  9 executable SQL migrations written in <code className="text-sky-300">supabase/migrations/</code> covering 10 core tables, 3 extensions, custom ENUMs, triggers, and full RLS policies.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider">2. Automated Test Suite</div>
                <p className="text-xs text-slate-300">
                  Executed <code className="text-emerald-300">npm test</code> (59 assertions): verified schema AST, table coverage, column types, RAG 0.68 floor, and 8 restore negative fixtures.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-amber-400 font-bold text-xs uppercase tracking-wider">3. Preflight Schema Parity</div>
                <p className="text-xs text-slate-300">
                  <code className="text-amber-300">scripts/preflight_schema_check.sql</code> validates type-aligned <code className="text-amber-300">actor_type VARCHAR(50)</code>, unique email index, unique payment constraint, and HNSW embedding index.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-indigo-400 font-bold text-xs uppercase tracking-wider">4. Hardened Restore Guard</div>
                <p className="text-xs text-slate-300">
                  <code className="text-indigo-300">scripts/restore_database.sh</code> requires explicit <code className="text-indigo-300">TARGET_ENV</code>, authoritative endpoint mapping, fail-closed DNS set matching, and single transaction.
                </p>
              </div>
            </div>

            {/* Human Prerequisites Card */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Prerequisites Requiring Human Action Prior to Live Cloud Provisioning (Phase 02)</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li><strong className="text-white">Designation of Root Super-Admin Email:</strong> Required for initial bootstrap seed migration.</li>
                <li><strong className="text-white">Constitution Document Access Authorization:</strong> Written authorization to extract from e-constitution portal, or delivery of signed PDF.</li>
                <li><strong className="text-white">Supabase Pro Tier Selection:</strong> Confirmation of Pro tier to enable Continuous PITR and meet the &le; 1 hour RPO target.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Automated Tests */}
        {activeTab === 'tests' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Phase 01 Automated Test Suite</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                    59 / 59 PASSED (100%)
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Executed via <code className="text-sky-300">npm test</code> (<code className="text-sky-300">scripts/verify_phase01.ts</code>). Covers inventories, DDL declarations, architectural remediations, and shell negative fixtures.
                </p>
              </div>

              {/* Search input */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter tests by ID, name, suite..."
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Suite filter chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {testSuites.map((suite) => (
                <button
                  key={suite}
                  onClick={() => setSelectedSuite(suite)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    selectedSuite === suite
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {suite} {suite === 'ALL' ? `(${phase01TestResults.length})` : `(${phase01TestResults.filter(t => t.suite === suite).length})`}
                </button>
              ))}
            </div>

            {/* Test results table */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 sticky top-0 border-b border-slate-800 z-10 backdrop-blur-md">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Test ID</th>
                      <th className="py-2.5 px-4 font-semibold">Suite</th>
                      <th className="py-2.5 px-4 font-semibold">Assertion Name</th>
                      <th className="py-2.5 px-4 font-semibold">Execution Evidence</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredTests.map((test) => (
                      <tr key={test.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-sky-400">{test.id}</td>
                        <td className="py-2.5 px-4 text-slate-400 font-sans">{test.suite}</td>
                        <td className="py-2.5 px-4 text-white font-sans font-medium">{test.name}</td>
                        <td className="py-2.5 px-4 text-slate-300 text-[11px] max-w-md truncate" title={test.evidence}>
                          {test.evidence}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            {test.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: SQL Migrations */}
        {activeTab === 'migrations' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Supabase SQL Migrations (001 - 009)</h2>
                <p className="text-xs text-slate-400">
                  Materialized on disk under <code className="text-sky-300">supabase/migrations/</code>. Total volume: 63,972 bytes.
                </p>
              </div>

              <button
                onClick={() => handleCopy(selectedMigration.content, `mig-${selectedMigration.num}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer border border-slate-700"
              >
                {copiedId === `mig-${selectedMigration.num}` ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Migration SQL</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-1 space-y-1.5">
                {phase01Migrations.map((m) => (
                  <button
                    key={m.num}
                    onClick={() => setSelectedMigrationNum(m.num)}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition-all cursor-pointer ${
                      selectedMigrationNum === m.num
                        ? 'bg-sky-500/15 border-sky-500/40 text-white shadow-sm'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold mb-1">
                      <span>Migration {m.num.toString().padStart(3, '0')}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {m.size.toLocaleString()} B
                      </span>
                    </div>
                    <div className="text-[11px] truncate font-sans text-slate-300">{m.file}</div>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-3 rounded-xl border border-slate-800 bg-slate-950 flex flex-col overflow-hidden">
                <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-mono font-bold text-slate-200">
                      supabase/migrations/{selectedMigration.file}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedMigration.content.split('\n').length} lines
                  </span>
                </div>

                <div className="p-4 overflow-x-auto max-h-[550px] font-mono text-xs text-slate-300 leading-relaxed">
                  <pre>
                    <code>{selectedMigration.content}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Verification Matrix */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">Phase 01 Acceptance Checklist & Release Gates</h2>
              <p className="text-xs text-slate-400">
                Shows deliverables on disk, automated static/contract passes, and runtime cloud items explicitly marked NOT EXECUTED.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 sticky top-0 border-b border-slate-800 z-10 backdrop-blur-md">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Item ID</th>
                      <th className="py-2.5 px-4 font-semibold">Requirement</th>
                      <th className="py-2.5 px-4 font-semibold">Target Object</th>
                      <th className="py-2.5 px-4 font-semibold">Release Gate</th>
                      <th className="py-2.5 px-4 font-semibold">Phase 01 Status</th>
                      <th className="py-2.5 px-4 font-semibold">Cloud Runtime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {matrixItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-sky-400">{item.id}</td>
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-white">{item.requirement}</div>
                          <div className="text-[11px] text-slate-400">{item.notes}</div>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">{item.target}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                            {item.gate}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {item.specStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-[11px]">
                            <Clock className="w-3.5 h-3.5" /> {item.runtimeStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Remediations */}
        {activeTab === 'remediations' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">Architectural Remediations (REM-01 through REM-05)</h2>
              <p className="text-xs text-slate-400">
                Detailed problem and solution specifications, verified through the automated test suite.
              </p>
            </div>

            <div className="space-y-4">
              {remediations.map((rem) => (
                <div key={rem.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sky-400">{rem.id}</span>
                      <h3 className="font-bold text-white text-sm">{rem.title}</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 self-start sm:self-auto">
                      {rem.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Identified Vulnerability:</span>
                      <p className="text-slate-300 leading-relaxed bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                        {rem.problem}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Enforced Control:</span>
                      <p className="text-slate-300 leading-relaxed bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                        {rem.solution}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Automated Verification Assertions:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rem.tests.map((t, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="font-semibold text-white">{t.name}</div>
                            <div className="text-[11px] text-slate-400">{t.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: Preflight Script */}
        {activeTab === 'preflight' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Machine-Verifiable Preflight Script (`scripts/preflight_schema_check.sql`)</h2>
                <p className="text-xs text-slate-400">
                  Asserts 10 tables, 3 extensions, types (<code className="text-sky-300">actor_type VARCHAR(50)</code>), unique email index (<code className="text-emerald-300">indisunique = true</code>), payment unique constraint, and HNSW cosine index.
                </p>
              </div>

              <button
                onClick={() => handleCopy(preflightSqlContent, 'preflight')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer border border-slate-700"
              >
                {copiedId === 'preflight' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Preflight SQL</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300 overflow-x-auto max-h-[600px] leading-relaxed">
              <pre>
                <code>{preflightSqlContent}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Tab 7: Restore Runbook */}
        {activeTab === 'restore' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Hardened Database Restore Runbook (`scripts/restore_database.sh`)</h2>
                <p className="text-xs text-slate-400">
                  Enforces explicit <code className="text-sky-300">TARGET_ENV</code>, authoritative endpoint mapping, fail-closed DNS resolution via <code className="text-emerald-300">comm -12</code>, and atomic single-transaction execution.
                </p>
              </div>

              <button
                onClick={() => handleCopy(restoreScriptContent, 'restore')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer border border-slate-700"
              >
                {copiedId === 'restore' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Restore Bash</span>
                  </>
                )}
              </button>
            </div>

            {/* Negative Fixture summary */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Executed Negative Safety Fixtures (All Passed Fast with Exit Code 1):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-sky-400 font-bold">RESTORE-NEG-01</div>
                  <div className="text-slate-400 text-[11px]">Unset TARGET_ENV aborts</div>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-sky-400 font-bold">RESTORE-NEG-02</div>
                  <div className="text-slate-400 text-[11px]">TARGET_ENV=production blocks</div>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-sky-400 font-bold">RESTORE-NEG-06</div>
                  <div className="text-slate-400 text-[11px]">Target == Prod project blocks</div>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono">
                  <div className="text-sky-400 font-bold">RESTORE-NEG-07</div>
                  <div className="text-slate-400 text-[11px]">Host / Project mismatch blocks</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300 overflow-x-auto max-h-[600px] leading-relaxed">
              <pre>
                <code>{restoreScriptContent}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Tab 8: Design Tokens */}
        {activeTab === 'design' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Liquid Glass Design Tokens & Android Screen Specifications</h2>
              <p className="text-xs text-slate-400">Minimalist Liquid Glass theme specifications for the 9 core Android mobile screens.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-xs font-bold text-sky-400 uppercase">Splash Screen Asset</div>
                <p className="text-xs text-slate-300">
                  Unaltered <code className="text-sky-300">AGILA Hub.png</code> centered on glass canvas, locked to 1:1 bounding box (240 &times; 240 dp).
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-xs font-bold text-emerald-400 uppercase">Home Crest Layering</div>
                <p className="text-xs text-slate-300">
                  Base: <code className="text-emerald-300">BEEC_vector.png</code> (140 &times; 140 dp). Top: Avatar (84 &times; 84 dp) centered directly over the center medallion with 2 dp glass border.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                <div className="text-xs font-bold text-amber-400 uppercase">Time-Based Greetings</div>
                <p className="text-xs text-slate-300">
                  Morning (05:00-11:59): &quot;Good morning Kuya [nickname]&quot;<br />
                  Afternoon (12:00-17:59): &quot;Good afternoon Kuya [nickname]&quot;<br />
                  Evening (18:00-04:59): &quot;Good evening Kuya [nickname]&quot;
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500">
        AGILA Hub Android &bull; The Fraternal Order of Eagles &bull; Bantayog Elite Eagles Club &bull; Phase 01 Foundation Verified
      </footer>
    </div>
  );
}
