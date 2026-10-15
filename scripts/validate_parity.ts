import * as fs from 'fs';
import * as path from 'path';
import { phase01TestResults, TestCase } from '../src/data/phase01Data';

export function validateResultRecordParity(): { success: boolean; totalRecords: number; suiteCount: number } {
  console.log('================================================================');
  console.log('   AGILA Hub Android — Automated Test Result Parity Validator   ');
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

  console.log(`\n[Parity Check 5] Suite Count & Grouping Validation`);
  const uniqueSuites = Array.from(new Set(jsonResults.map(r => r.suite)));
  console.log(`  Total Distinct Suites in Results: ${uniqueSuites.length}`);
  uniqueSuites.forEach((s, idx) => {
    const count = jsonResults.filter(r => r.suite === s).length;
    console.log(`    ${idx + 1}. [${s}]: ${count} assertion(s)`);
  });

  const allPassed = jsonResults.every(r => r.status === 'PASS') && phase01TestResults.every(r => r.status === 'PASS');
  if (!allPassed) {
    throw new Error('One or more test assertions did not pass');
  }
  console.log(`  -> PASS: All ${expectedCount} assertions have PASS status`);

  console.log('\n================================================================');
  console.log('          AUTOMATED PARITY VERIFICATION: PASSED (100%)          ');
  console.log('================================================================');

  return { success: true, totalRecords: expectedCount, suiteCount: uniqueSuites.length };
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
