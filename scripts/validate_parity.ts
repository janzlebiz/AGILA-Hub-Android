import * as fs from 'fs';
import * as path from 'path';
import { phase01TestResults, TestCase } from '../src/data/phase01Data';

export interface GranularSuiteSpec {
  name: string;
  expectedCount: number;
}

export interface FunctionalDomainGroup {
  suiteNumber: number;
  domainName: string;
  granularSuites: GranularSuiteSpec[];
  expectedTotalAssertions: number;
}

export const AUTHORITATIVE_SUITE_GROUPS: FunctionalDomainGroup[] = [
  {
    suiteNumber: 1,
    domainName: 'Migration Inventory and Completeness',
    granularSuites: [{ name: 'Migration Inventory', expectedCount: 10 }],
    expectedTotalAssertions: 10,
  },
  {
    suiteNumber: 2,
    domainName: 'Core Tables, Extensions & Types Verification',
    granularSuites: [
      { name: 'Schema Definitions', expectedCount: 11 },
      { name: 'Extensions', expectedCount: 3 },
    ],
    expectedTotalAssertions: 14,
  },
  {
    suiteNumber: 3,
    domainName: 'Architectural Invariants & Remediation Checks',
    granularSuites: [
      { name: 'Security & Remediation', expectedCount: 2 },
      { name: 'Index Verification', expectedCount: 3 },
      { name: 'Financial Governance', expectedCount: 4 },
      { name: 'RAG Governance', expectedCount: 1 },
    ],
    expectedTotalAssertions: 10,
  },
  {
    suiteNumber: 4,
    domainName: 'RLS Policy Coverage on Core Tables',
    granularSuites: [{ name: 'RLS Policies', expectedCount: 11 }],
    expectedTotalAssertions: 11,
  },
  {
    suiteNumber: 5,
    domainName: 'Preflight Schema Check Verification',
    granularSuites: [{ name: 'Preflight Script', expectedCount: 6 }],
    expectedTotalAssertions: 6,
  },
  {
    suiteNumber: 6,
    domainName: 'Database Restore Runbook & Isolated Script Verification',
    granularSuites: [
      { name: 'Restore Runbook', expectedCount: 1 },
      { name: 'Restore Safety Guards', expectedCount: 8 },
    ],
    expectedTotalAssertions: 9,
  },
  {
    suiteNumber: 7,
    domainName: 'Top-Level PostgreSQL AST Syntax Validation',
    granularSuites: [{ name: 'Top-Level SQL AST Validation', expectedCount: 10 }],
    expectedTotalAssertions: 10,
  },
  {
    suiteNumber: 8,
    domainName: 'Offline Procedural Structural and Security Validation',
    granularSuites: [{ name: 'Procedural Body Validation', expectedCount: 6 }],
    expectedTotalAssertions: 6,
  },
];

export function validateResultRecordParity(): {
  success: boolean;
  totalRecords: number;
  granularSuiteCount: number;
  functionalGroupCount: number;
} {
  console.log('================================================================');
  console.log('   AGILA Hub Android — Automated Test Result Parity Validator   ');
  console.log('   Authoritative Suite Architecture: 13 Suites / 8 Domains      ');
  console.log('================================================================');

  const jsonPath = path.resolve('scripts/phase01_test_results.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Canonical results file not found at ${jsonPath}`);
  }

  const jsonRaw = fs.readFileSync(jsonPath, 'utf-8');
  const jsonResults: TestCase[] = JSON.parse(jsonRaw);

  const expectedCount = 76;

  console.log(`\n[Parity Check 1] Record Count Verification`);
  console.log(`  JSON Result Records:      ${jsonResults.length}`);
  console.log(`  Dashboard phase01Data:    ${phase01TestResults.length}`);
  console.log(`  Target Contract Count:    ${expectedCount}`);

  if (jsonResults.length !== expectedCount) {
    throw new Error(`JSON result record count mismatch: expected ${expectedCount}, got ${jsonResults.length}`);
  }
  if (phase01TestResults.length !== expectedCount) {
    throw new Error(`Dashboard phase01Data record count mismatch: expected ${expectedCount}, got ${phase01TestResults.length}`);
  }
  if (jsonResults.length !== phase01TestResults.length) {
    throw new Error(`Record count mismatch between JSON (${jsonResults.length}) and Dashboard (${phase01TestResults.length})`);
  }
  console.log(`  -> PASS: Record counts match exactly (${expectedCount}/${expectedCount})`);

  console.log(`\n[Parity Check 2] Assertion ID Uniqueness Verification`);
  const jsonIdSet = new Set<string>();
  const jsonDuplicates: string[] = [];
  for (const r of jsonResults) {
    if (jsonIdSet.has(r.id)) {
      jsonDuplicates.push(r.id);
    }
    jsonIdSet.add(r.id);
  }

  const tsIdSet = new Set<string>();
  const tsDuplicates: string[] = [];
  for (const r of phase01TestResults) {
    if (tsIdSet.has(r.id)) {
      tsDuplicates.push(r.id);
    }
    tsIdSet.add(r.id);
  }

  if (jsonDuplicates.length > 0) {
    throw new Error(`Duplicate assertion IDs detected in JSON dataset: ${jsonDuplicates.join(', ')}`);
  }
  if (tsDuplicates.length > 0) {
    throw new Error(`Duplicate assertion IDs detected in Dashboard dataset: ${tsDuplicates.join(', ')}`);
  }
  if (jsonIdSet.size !== expectedCount || tsIdSet.size !== expectedCount) {
    throw new Error(`Assertion ID unique set size mismatch: JSON=${jsonIdSet.size}, TS=${tsIdSet.size}`);
  }
  console.log(`  -> PASS: All ${expectedCount} assertion IDs are globally unique across both datasets`);

  console.log(`\n[Parity Check 3] Assertion Ordering & Sequence Verification`);
  for (let i = 0; i < expectedCount; i++) {
    const jId = jsonResults[i].id;
    const tId = phase01TestResults[i].id;
    if (jId !== tId) {
      throw new Error(`Sequence mismatch at index ${i}: JSON has '${jId}', Dashboard dataset has '${tId}'`);
    }
  }
  console.log(`  -> PASS: Assertion ordering is 100% identical across all ${expectedCount} records`);

  console.log(`\n[Parity Check 4] Field-by-Field Parity (suite, id, name, status, evidence)`);
  const fields: Array<keyof TestCase> = ['suite', 'id', 'name', 'status', 'evidence'];
  let diffCount = 0;
  for (let i = 0; i < expectedCount; i++) {
    const j = jsonResults[i];
    const t = phase01TestResults[i];
    for (const f of fields) {
      if (j[f] !== t[f]) {
        console.error(`  FIELD MISMATCH at index ${i} [${j.id}]: field '${f}'`);
        console.error(`    JSON:      "${j[f]}"`);
        console.error(`    Dashboard: "${t[f]}"`);
        diffCount++;
      }
    }
  }

  if (diffCount > 0) {
    throw new Error(`Detected ${diffCount} field-level discrepancies between JSON and Dashboard datasets`);
  }
  console.log(`  -> PASS: Zero field-level discrepancies across all ${expectedCount} records (suite, id, name, status, evidence)`);

  console.log(`\n[Parity Check 5] Authoritative Suite Grouping & Parity Validation`);
  const uniqueJsonSuites = Array.from(new Set(jsonResults.map(r => r.suite)));
  const uniqueTsSuites = Array.from(new Set(phase01TestResults.map(r => r.suite)));

  const expectedGranularSuiteCount = 13;
  const expectedFunctionalGroupCount = 8;

  console.log(`  Distinct Granular Suites (JSON):      ${uniqueJsonSuites.length} (expected ${expectedGranularSuiteCount})`);
  console.log(`  Distinct Granular Suites (Dashboard): ${uniqueTsSuites.length} (expected ${expectedGranularSuiteCount})`);
  console.log(`  Authoritative Functional Domains:     ${AUTHORITATIVE_SUITE_GROUPS.length} (expected ${expectedFunctionalGroupCount})`);

  if (uniqueJsonSuites.length !== expectedGranularSuiteCount) {
    throw new Error(`JSON granular suite count mismatch: expected ${expectedGranularSuiteCount}, got ${uniqueJsonSuites.length}`);
  }
  if (uniqueTsSuites.length !== expectedGranularSuiteCount) {
    throw new Error(`Dashboard granular suite count mismatch: expected ${expectedGranularSuiteCount}, got ${uniqueTsSuites.length}`);
  }

  // Validate each functional domain and its granular suites
  let totalReconciledAssertions = 0;
  AUTHORITATIVE_SUITE_GROUPS.forEach(group => {
    let groupAssertionCountJson = 0;
    let groupAssertionCountTs = 0;

    console.log(`\n  Domain ${group.suiteNumber}: [${group.domainName}] (Expected: ${group.expectedTotalAssertions} assertions)`);

    group.granularSuites.forEach(granular => {
      const jsonCount = jsonResults.filter(r => r.suite === granular.name).length;
      const tsCount = phase01TestResults.filter(r => r.suite === granular.name).length;

      if (jsonCount !== granular.expectedCount) {
        throw new Error(`Granular suite "${granular.name}" JSON assertion count mismatch: expected ${granular.expectedCount}, got ${jsonCount}`);
      }
      if (tsCount !== granular.expectedCount) {
        throw new Error(`Granular suite "${granular.name}" Dashboard assertion count mismatch: expected ${granular.expectedCount}, got ${tsCount}`);
      }

      console.log(`    - Granular Suite [${granular.name}]: ${jsonCount} assertion(s) (PASS)`);
      groupAssertionCountJson += jsonCount;
      groupAssertionCountTs += tsCount;
    });

    if (groupAssertionCountJson !== group.expectedTotalAssertions || groupAssertionCountTs !== group.expectedTotalAssertions) {
      throw new Error(`Domain ${group.suiteNumber} total assertion count mismatch: expected ${group.expectedTotalAssertions}, got JSON=${groupAssertionCountJson}, TS=${groupAssertionCountTs}`);
    }

    totalReconciledAssertions += groupAssertionCountJson;
  });

  if (totalReconciledAssertions !== expectedCount) {
    throw new Error(`Total reconciled assertion count mismatch: expected ${expectedCount}, got ${totalReconciledAssertions}`);
  }

  // Ensure zero unmapped / stray granular suites
  const authoritativeSuiteNames = new Set(AUTHORITATIVE_SUITE_GROUPS.flatMap(g => g.granularSuites.map(s => s.name)));
  for (const s of uniqueJsonSuites) {
    if (!authoritativeSuiteNames.has(s)) {
      throw new Error(`Unmapped stray granular suite found in JSON dataset: "${s}"`);
    }
  }
  for (const s of uniqueTsSuites) {
    if (!authoritativeSuiteNames.has(s)) {
      throw new Error(`Unmapped stray granular suite found in Dashboard dataset: "${s}"`);
    }
  }

  console.log(`\n  -> PASS: All 13 granular suites authoritatively reconciled into 8 functional domains (${totalReconciledAssertions}/${expectedCount} assertions)`);

  const allPassed = jsonResults.every(r => r.status === 'PASS') && phase01TestResults.every(r => r.status === 'PASS');
  if (!allPassed) {
    throw new Error('One or more test assertions did not pass');
  }
  console.log(`  -> PASS: All ${expectedCount} assertions have PASS status`);

  console.log('\n================================================================');
  console.log('   AUTOMATED PARITY & SUITE RECONCILIATION: PASSED (100%)       ');
  console.log('================================================================');

  return {
    success: true,
    totalRecords: expectedCount,
    granularSuiteCount: expectedGranularSuiteCount,
    functionalGroupCount: expectedFunctionalGroupCount,
  };
}

// Direct execution entry point
if (process.argv[1] && (process.argv[1].endsWith('validate_parity.ts') || process.argv[1].endsWith('validate_parity.js'))) {
  try {
    validateResultRecordParity();
    process.exit(0);
  } catch (err: any) {
    console.error('\nPARITY VERIFICATION FAILED:', err.message);
    process.exit(1);
  }
}
