import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface TestResult {
  suite: string;
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, id: string, name: string, evidence: string) {
  if (condition) {
    results.push({ suite, id, name, status: 'PASS', evidence });
    console.log(`[PASS] [${suite}] ${id}: ${name}`);
  } else {
    results.push({ suite, id, name, status: 'FAIL', evidence: `FAILED: ${evidence}` });
    console.error(`[FAIL] [${suite}] ${id}: ${name} - ${evidence}`);
  }
}

console.log('================================================================');
console.log('   AGILA Hub Android — Phase 01 Automated Verification Suite   ');
console.log('================================================================\n');

// ---------------------------------------------------------
// SUITE 1: Migration Inventory and Completeness
// ---------------------------------------------------------
const migrationsDir = path.resolve('supabase/migrations');
const expectedMigrations = [
  '20261013000001_core_types_and_extensions.sql',
  '20261013000002_members_and_directory.sql',
  '20261013000003_invitations_and_auth.sql',
  '20261013000004_eagles_id_storage.sql',
  '20261013000005_announcements_and_attendance.sql',
  '20261013000006_financial_records.sql',
  '20261013000007_constitution_rag.sql',
  '20261013000008_audit_logs_and_triggers.sql',
  '20261013000009_rls_and_storage_policies.sql'
];

assert(
  fs.existsSync(migrationsDir),
  'Migration Inventory',
  'MIG-INV-01',
  'Migrations Directory Exists',
  `Found ${migrationsDir}`
);

const actualFiles = fs.readdirSync(migrationsDir).sort();
expectedMigrations.forEach((file, idx) => {
  const filePath = path.join(migrationsDir, file);
  const exists = fs.existsSync(filePath);
  const size = exists ? fs.statSync(filePath).size : 0;
  assert(
    exists && size > 100,
    'Migration Inventory',
    `MIG-FILE-0${idx + 1}`,
    `Migration File ${file}`,
    `File exists with size ${size} bytes`
  );
});

// Concatenate all SQL for structural AST/regex inspections
const allSql = expectedMigrations
  .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
  .join('\n\n');

// ---------------------------------------------------------
// SUITE 2: Core Tables, Extensions & Types Verification
// ---------------------------------------------------------
const expectedTables = [
  'members',
  'member_invitations',
  'eagles_id_cards',
  'announcements',
  'attendance_events',
  'attendance_records',
  'contributions',
  'expenses',
  'constitution_versions',
  'constitution_sections',
  'audit_logs'
];

expectedTables.forEach(table => {
  const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?public\\.${table}\\b`, 'i');
  assert(
    tableRegex.test(allSql),
    'Schema Definitions',
    `TBL-${table.toUpperCase()}`,
    `Table public.${table} Defined`,
    `Matched DDL declaration for public.${table}`
  );
});

// Extensions
['uuid-ossp', 'pgcrypto', 'vector'].forEach(ext => {
  const extRegex = new RegExp(`CREATE\\s+EXTENSION\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?"?${ext}"?`, 'i');
  assert(
    extRegex.test(allSql),
    'Extensions',
    `EXT-${ext.toUpperCase()}`,
    `Extension ${ext} Declared`,
    `Matched extension creation for ${ext}`
  );
});

// ---------------------------------------------------------
// SUITE 3: Architectural Invariants & Remediation Checks
// ---------------------------------------------------------

// REM-01: Audit Privacy & Expense Payload
assert(
  allSql.includes("v_safe_new := jsonb_build_object('id', v_raw_new->'id', 'category', v_raw_new->'category'") ||
  allSql.includes("'category', v_raw_new->'category'"),
  'Security & Remediation',
  'REM-01-EXP-CAT',
  'Expense Audit Sourced from v_raw_new->category',
  'v_safe_new accurately references v_raw_new->category'
);

assert(
  allSql.includes("actor_type VARCHAR(50) NOT NULL DEFAULT 'authenticated_member'"),
  'Security & Remediation',
  'REM-01-ACTOR-TYPE',
  'audit_logs.actor_type Declared as VARCHAR(50)',
  'Matched VARCHAR(50) actor_type column definition'
);

// REM-02: Unique index Lower(email) & HNSW embedding index
assert(
  /CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?idx_members_email_lower\s+ON\s+public\.members\s*\(\s*LOWER\(email\)\s*\)/i.test(allSql),
  'Index Verification',
  'REM-02-EMAIL-IDX',
  'idx_members_email_lower UNIQUE on LOWER(email)',
  'Matched CREATE UNIQUE INDEX on LOWER(email)'
);

assert(
  /CONSTRAINT\s+uq_reference_payment\s+UNIQUE\s*\(\s*payment_channel\s*,\s*reference_number\s*\)/i.test(allSql),
  'Index Verification',
  'REM-02-PAY-UQ',
  'uq_reference_payment UNIQUE on (payment_channel, reference_number)',
  'Matched UNIQUE constraint on contributions'
);

assert(
  /CREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?idx_constitution_embedding_hnsw\s+ON\s+public\.constitution_sections\s+USING\s+hnsw\s*\(\s*embedding\s+vector_cosine_ops\s*\)/i.test(allSql),
  'Index Verification',
  'REM-02-HNSW-IDX',
  'idx_constitution_embedding_hnsw on embedding with vector_cosine_ops',
  'Matched HNSW cosine similarity index on public.constitution_sections'
);

// REM-03 & REM-04: Preserved Attribution on Expenses and Contributions
assert(
  allSql.includes('reversed_by UUID REFERENCES public.members(id)') &&
  allSql.includes('reversed_at TIMESTAMPTZ') &&
  allSql.includes('reversal_reason TEXT'),
  'Financial Governance',
  'REM-03-EXP-COLS',
  'Expense Reversal Columns Present',
  'Distinct reversed_by, reversed_at, reversal_reason columns found'
);

assert(
  allSql.includes('NEW.approved_by := OLD.approved_by;') &&
  allSql.includes('NEW.approved_at := OLD.approved_at;'),
  'Financial Governance',
  'REM-03-EXP-PRESERVE',
  'Original Approval Preserved on Reversal',
  'validate_expense_mutation retains OLD.approved_by/at during voiding/reversal'
);

assert(
  allSql.includes('closed_by UUID REFERENCES public.members(id)') &&
  allSql.includes('closed_at TIMESTAMPTZ') &&
  allSql.includes('void_reason TEXT'),
  'Financial Governance',
  'REM-04-CON-COLS',
  'Contribution Closing Columns Present',
  'Distinct closed_by, closed_at, void_reason columns found'
);

assert(
  allSql.includes('NEW.verified_by := OLD.verified_by;') &&
  allSql.includes('NEW.verified_at := OLD.verified_at;'),
  'Financial Governance',
  'REM-04-CON-PRESERVE',
  'Original Verification Preserved on Void/Adjust',
  'protect_payment_state_transitions retains OLD.verified_by/at during voiding/adjustment'
);

// REM-05: RAG Floor 0.68
assert(
  allSql.includes('v_enforced_threshold := GREATEST(0.68, LEAST(1.00, COALESCE(match_threshold, 0.68)));'),
  'RAG Governance',
  'RAG-FLOOR-068',
  'Server Enforces Minimum 0.68 Similarity Floor',
  'match_constitution_sections clamps threshold with GREATEST(0.68, ...)'
);

// RLS Assertion: row security enabled across all 10 tables
expectedTables.forEach(table => {
  const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+public\\.${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
  assert(
    rlsRegex.test(allSql),
    'RLS Policies',
    `RLS-${table.toUpperCase()}`,
    `RLS Enabled on public.${table}`,
    `Found ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`
  );
});

// ---------------------------------------------------------
// SUITE 4: Preflight Validation Script Contract Parity
// ---------------------------------------------------------
const preflightFile = path.resolve('scripts/preflight_schema_check.sql');
assert(
  fs.existsSync(preflightFile),
  'Preflight Script',
  'PRE-FILE-01',
  'scripts/preflight_schema_check.sql Exists',
  `Found ${preflightFile}`
);

const preflightSql = fs.readFileSync(preflightFile, 'utf-8');

assert(
  preflightSql.includes("column_name = 'actor_type'") &&
  preflightSql.includes("data_type = 'character varying'") &&
  preflightSql.includes("character_maximum_length = 50"),
  'Preflight Script',
  'PRE-ACTOR-TYPE',
  'Preflight Checks actor_type varchar(50)',
  'Verified information_schema checks data_type character varying with max length 50'
);

assert(
  preflightSql.includes("c.relname = 'idx_members_email_lower'") &&
  preflightSql.includes("i.indisunique = TRUE") &&
  preflightSql.includes("pi.indexdef ILIKE '%lower(%email%)%'"),
  'Preflight Script',
  'PRE-EMAIL-IDX',
  'Preflight Validates idx_members_email_lower Uniqueness & Expression',
  'Verified indisunique = TRUE and LOWER(email) expression match'
);

assert(
  preflightSql.includes("indexname = 'idx_constitution_embedding_hnsw'") &&
  preflightSql.includes("indexdef ILIKE '%hnsw%'") &&
  preflightSql.includes("indexdef ILIKE '%(embedding%vector_cosine_ops)%'"),
  'Preflight Script',
  'PRE-HNSW-IDX',
  'Preflight Validates idx_constitution_embedding_hnsw Access Method & Column',
  'Verified HNSW index assertion on embedding vector_cosine_ops'
);

assert(
  preflightSql.includes("schemaname = 'public' AND tablename = v_expected_table AND rowsecurity = FALSE"),
  'Preflight Script',
  'PRE-RLS-CHECK',
  'Preflight Validates Active RLS on ALL Public Tables',
  'Verified pg_tables iteration fails closed if rowsecurity is false'
);

// ---------------------------------------------------------
// SUITE 5: Restore Runbook Negative Fixture Tests
// ---------------------------------------------------------
const restoreScript = path.resolve('scripts/restore_database.sh');
assert(
  fs.existsSync(restoreScript),
  'Restore Runbook',
  'RESTORE-FILE-01',
  'scripts/restore_database.sh Exists',
  `Found ${restoreScript}`
);

function runRestoreFixture(envVars: Record<string, string>): { code: number; stderr: string; stdout: string } {
  try {
    const envString = Object.entries(envVars)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    const cmd = `${envString} bash scripts/restore_database.sh 2>&1`;
    const out = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { code: 0, stdout: out, stderr: '' };
  } catch (err: any) {
    return {
      code: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? ''
    };
  }
}

// Fixture 1: Missing TARGET_ENV
const fix1 = runRestoreFixture({});
assert(
  fix1.code !== 0 && (fix1.stdout.includes('TARGET_ENV is unset or empty') || fix1.stderr.includes('TARGET_ENV is unset or empty')),
  'Restore Safety Guards',
  'RESTORE-NEG-01',
  'Negative Fixture 1: Missing TARGET_ENV Fails Fast',
  `Exited with code ${fix1.code}, message: TARGET_ENV is unset or empty`
);

// Fixture 2: Disallowed TARGET_ENV=production
const fix2 = runRestoreFixture({ TARGET_ENV: 'production' });
assert(
  fix2.code !== 0 && (fix2.stdout.includes('Production restores are blocked') || fix2.stderr.includes('Production restores are blocked')),
  'Restore Safety Guards',
  'RESTORE-NEG-02',
  'Negative Fixture 2: TARGET_ENV=production Blocked',
  `Exited with code ${fix2.code}, message: Production restores are blocked`
);

// Fixture 3: Missing TARGET_PROJECT_ID
const fix3 = runRestoreFixture({ TARGET_ENV: 'staging' });
assert(
  fix3.code !== 0 && (fix3.stdout.includes('TARGET_PROJECT_ID is unset') || fix3.stderr.includes('TARGET_PROJECT_ID is unset')),
  'Restore Safety Guards',
  'RESTORE-NEG-03',
  'Negative Fixture 3: Missing TARGET_PROJECT_ID Fails Fast',
  `Exited with code ${fix3.code}, message: TARGET_PROJECT_ID is unset`
);

// Fixture 4: Missing PROD_PROJECT_ID
const fix4 = runRestoreFixture({ TARGET_ENV: 'staging', TARGET_PROJECT_ID: 'agila-hub-staging' });
assert(
  fix4.code !== 0 && (fix4.stdout.includes('PROD_PROJECT_ID is unset') || fix4.stderr.includes('PROD_PROJECT_ID is unset')),
  'Restore Safety Guards',
  'RESTORE-NEG-04',
  'Negative Fixture 4: Missing PROD_PROJECT_ID Fails Fast',
  `Exited with code ${fix4.code}, message: PROD_PROJECT_ID is unset`
);

// Fixture 5: Missing PROD_DB_HOST
const fix5 = runRestoreFixture({
  TARGET_ENV: 'staging',
  TARGET_PROJECT_ID: 'agila-hub-staging',
  PROD_PROJECT_ID: 'agila-hub-prod'
});
assert(
  fix5.code !== 0 && (fix5.stdout.includes('PROD_DB_HOST is unset') || fix5.stderr.includes('PROD_DB_HOST is unset')),
  'Restore Safety Guards',
  'RESTORE-NEG-05',
  'Negative Fixture 5: Missing PROD_DB_HOST Fails Fast',
  `Exited with code ${fix5.code}, message: PROD_DB_HOST is unset`
);

// Fixture 6: Target Project Matches Prod Project
const fix6 = runRestoreFixture({
  TARGET_ENV: 'staging',
  TARGET_PROJECT_ID: 'agila-hub-prod',
  PROD_PROJECT_ID: 'agila-hub-prod',
  PROD_DB_HOST: 'db.agila-hub-prod.supabase.co'
});
assert(
  fix6.code !== 0 && (fix6.stdout.includes('Production restores are strictly forbidden') || fix6.stderr.includes('Production restores are strictly forbidden')),
  'Restore Safety Guards',
  'RESTORE-NEG-06',
  'Negative Fixture 6: Target Project == Prod Project Blocked',
  `Exited with code ${fix6.code}, message: Production restores are strictly forbidden`
);

// Fixture 7: Hostname / Project-ID Mismatch
const fix7 = runRestoreFixture({
  TARGET_ENV: 'staging',
  TARGET_PROJECT_ID: 'agila-hub-staging',
  PROD_PROJECT_ID: 'agila-hub-prod',
  PROD_DB_HOST: 'db.agila-hub-prod.supabase.co',
  TARGET_DB_HOST: 'db.other-host.supabase.co'
});
assert(
  fix7.code !== 0 && (fix7.stdout.includes('Authoritative target identity verification failed') || fix7.stderr.includes('Authoritative target identity verification failed')),
  'Restore Safety Guards',
  'RESTORE-NEG-07',
  'Negative Fixture 7: Hostname / Project-ID Mismatch Blocked',
  `Exited with code ${fix7.code}, message: Authoritative target identity verification failed`
);

// Fixture 8: Target Host matches Prod DB Host
const fix8 = runRestoreFixture({
  TARGET_ENV: 'staging',
  TARGET_PROJECT_ID: 'agila-hub-prod-fake',
  PROD_PROJECT_ID: 'agila-hub-prod',
  PROD_DB_HOST: 'db.agila-hub-prod-fake.supabase.co'
});
assert(
  fix8.code !== 0 && (fix8.stdout.includes('matches trusted production endpoint') || fix8.stderr.includes('matches trusted production endpoint')),
  'Restore Safety Guards',
  'RESTORE-NEG-08',
  'Negative Fixture 8: Target Host == Prod Host Blocked',
  `Exited with code ${fix8.code}, message: matches trusted production endpoint`
);

// ---------------------------------------------------------
// SUMMARY & EXIT
// ---------------------------------------------------------
console.log('\n================================================================');
console.log('                 VERIFICATION SUMMARY RESULTS                   ');
console.log('================================================================');
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`Total Assertions Executed: ${results.length}`);
console.log(`PASS: ${passed}`);
console.log(`FAIL: ${failed}`);

if (failed > 0) {
  console.error('\nPhase 01 Verification: FAILED');
  process.exit(1);
} else {
  console.log('\nPhase 01 Verification: ALL ASSERTIONS PASSED (100%)');
  // Export results JSON for reporting
  fs.writeFileSync('scripts/phase01_test_results.json', JSON.stringify(results, null, 2));
}
