import fs from 'fs';
import path from 'path';

export interface DocValidationResult {
  success: boolean;
  documentsChecked: string[];
  assertionsVerified: number;
  errors: string[];
}

export interface DocValidationOptions {
  _mockMatrixContent?: string;
  _mockTraceabilityContent?: string;
  _mockPlanContent?: string;
  _mockManifestContent?: any;
}

export function validateDocParity(options?: DocValidationOptions): DocValidationResult {
  const errors: string[] = [];
  const documentsChecked: string[] = [];
  let assertionsVerified = 0;

  // 1. Load Authoritative Manifest
  let manifest: any;
  if (options?._mockManifestContent) {
    manifest = options._mockManifestContent;
  } else {
    const manifestPath = path.resolve('scripts/requirements_manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Authoritative requirements manifest not found: ${manifestPath}`);
    }
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  // Validate internal manifest consistency
  if (manifest.summary.totalRequirements !== manifest.requirements.length) {
    errors.push(`Manifest internal discrepancy: summary.totalRequirements (${manifest.summary.totalRequirements}) != requirements.length (${manifest.requirements.length})`);
  }
  if (manifest.summary.assertionCount !== 76) {
    errors.push(`Manifest internal discrepancy: expected 76 assertions, found ${manifest.summary.assertionCount}`);
  }
  if (manifest.summary.granularSuiteCount !== 13) {
    errors.push(`Manifest internal discrepancy: expected 13 granular suites, found ${manifest.summary.granularSuiteCount}`);
  }
  if (manifest.summary.functionalDomainCount !== 8) {
    errors.push(`Manifest internal discrepancy: expected 8 functional domains, found ${manifest.summary.functionalDomainCount}`);
  }

  // 2. Validate phase00_verification_matrix.md
  const matrixPath = path.resolve('.aistudio/artifacts/brain/65269374-16e1-494b-8ce2-4f22e5d0b99f/phase00_verification_matrix.md');
  let matrixContent = '';
  if (options?._mockMatrixContent !== undefined) {
    matrixContent = options._mockMatrixContent;
  } else if (fs.existsSync(matrixPath)) {
    matrixContent = fs.readFileSync(matrixPath, 'utf-8');
    documentsChecked.push('phase00_verification_matrix.md');
  }

  if (matrixContent) {
    // Assert current summary figures
    if (!matrixContent.includes('Total Checklist Items Evaluated:** 22')) {
      errors.push("phase00_verification_matrix.md summary error: Missing 'Total Checklist Items Evaluated:** 22'");
    }
    if (!matrixContent.includes('PASS (Deliverables on Disk & Automated Static/Contract/AST/Procedural Assertions):** 22 items')) {
      errors.push("phase00_verification_matrix.md summary error: Missing 'PASS (Deliverables on Disk & Automated Static/Contract/AST/Procedural Assertions):** 22 items'");
    }
    if (!matrixContent.includes('NOT EXECUTED (Runtime Cloud Database Tests & Live Recovery Drills):** 17 items')) {
      errors.push("phase00_verification_matrix.md summary error: Missing 'NOT EXECUTED ... 17 items'");
    }
    if (!matrixContent.includes('FAIL:** 0 items')) {
      errors.push("phase00_verification_matrix.md summary error: Missing 'FAIL:** 0 items'");
    }

    // Assert P1-TEST-01 row current assertion count
    if (!matrixContent.includes('76 automated assertions executed across 13 granular test suites authoritatively grouped into 8 functional domains')) {
      errors.push("phase00_verification_matrix.md row P1-TEST-01 error: Missing '76 automated assertions executed across 13 granular test suites authoritatively grouped into 8 functional domains'");
    }

    // Assert uncertified / deferred status
    if (!matrixContent.includes('NOT CERTIFIED (DEFERRED TO SCHEDULED CLOUD GATES)')) {
      errors.push("phase00_verification_matrix.md governance error: Missing explicit 'NOT CERTIFIED (DEFERRED TO SCHEDULED CLOUD GATES)'");
    }

    // Guard against unsupported claims of live cloud PASS
    if (matrixContent.includes('| **P1-TEST-01**') && matrixContent.includes('| **PASS (Live Cloud)** |')) {
      errors.push("phase00_verification_matrix.md governance error: Erroneous claim of live cloud PASS for P1-TEST-01");
    }

    assertionsVerified += 6;
  }

  // 3. Validate remediation_traceability.md
  const tracePath = path.resolve('.aistudio/artifacts/brain/65269374-16e1-494b-8ce2-4f22e5d0b99f/remediation_traceability.md');
  let traceContent = '';
  if (options?._mockTraceabilityContent !== undefined) {
    traceContent = options._mockTraceabilityContent;
  } else if (fs.existsSync(tracePath)) {
    traceContent = fs.readFileSync(tracePath, 'utf-8');
    documentsChecked.push('remediation_traceability.md');
  }

  if (traceContent) {
    // Assert summary table totals in Section 2
    const hasTotalLine = /\|\s*\*\*TOTAL\*\*\s*\|\s*\*\*13 Granular Suites\*\*\s*\|\s*\*\*76 Global Unique IDs\*\*\s*\|\s*\*\*76\*\*\s*\|\s*\*\*76\*\*\s*\|\s*\*\*0\*\*/i.test(traceContent);
    if (!hasTotalLine) {
      errors.push("remediation_traceability.md Section 2 table error: Missing authoritative line for 13 Granular Suites, 76 Total, 76 PASS, 0 FAIL");
    }
    if (!traceContent.includes('100% Pass Rate across 13 Suites / 8 Domains')) {
      errors.push("remediation_traceability.md summary error: Missing '100% Pass Rate across 13 Suites / 8 Domains'");
    }
    assertionsVerified += 2;
  }

  // 4. Validate implementation_plan.md
  const planPath = path.resolve('.aistudio/artifacts/brain/65269374-16e1-494b-8ce2-4f22e5d0b99f/implementation_plan.md');
  let planContent = '';
  if (options?._mockPlanContent !== undefined) {
    planContent = options._mockPlanContent;
  } else if (fs.existsSync(planPath)) {
    planContent = fs.readFileSync(planPath, 'utf-8');
    documentsChecked.push('implementation_plan.md');
  }

  if (planContent) {
    if (!planContent.includes('76 automated test assertions in `scripts/verify_phase01.ts` have been executed with 100% PASS across 13 granular test suites authoritatively grouped into 8 functional domains')) {
      errors.push("implementation_plan.md Section 1.1 Item 7 error: Missing authoritative 76 assertion / 13 suites / 8 domains declaration");
    }
    if (!planContent.includes('76 automated test assertions across 13 granular test suites authoritatively grouped into 8 functional domains with zero failures')) {
      errors.push("implementation_plan.md Section 11.1 error: Missing authoritative 76 assertions / 13 granular suites / 8 functional domains summary");
    }
    assertionsVerified += 2;
  }

  // 5. Validate src/App.tsx Current Status Badges
  const appPath = path.resolve('src/App.tsx');
  if (fs.existsSync(appPath)) {
    const appContent = fs.readFileSync(appPath, 'utf-8');
    documentsChecked.push('src/App.tsx');
    if (!appContent.includes('76 / 76 PASSED (100%)')) {
      errors.push("src/App.tsx error: Header badge missing '76 / 76 PASSED (100%)'");
    }
    if (!appContent.includes('13 Suites · 8 Domains') && !appContent.includes('13 Granular Suites')) {
      errors.push("src/App.tsx error: Header badge missing '13 Suites · 8 Domains'");
    }
    if (!appContent.includes('8 functional domains') && !appContent.includes('8 Functional Domains')) {
      errors.push("src/App.tsx error: Header badge missing '8 functional domains'");
    }
    assertionsVerified += 3;
  }

  return {
    success: errors.length === 0,
    documentsChecked,
    assertionsVerified,
    errors
  };
}

export function runDocParityNegativeFixtures(): void {
  console.log('Running Documentation-Parity Negative Fixtures (isolated in-memory evaluation)...');

  // Negative Fixture 1: Contradictory assertion count in current status
  const canonicalMatrix = fs.readFileSync(
    path.resolve('.aistudio/artifacts/brain/65269374-16e1-494b-8ce2-4f22e5d0b99f/phase00_verification_matrix.md'),
    'utf-8'
  );
  const brokenMatrixCount = canonicalMatrix.replace(
    '76 automated assertions executed across 13 granular test suites',
    '75 automated assertions executed across 13 granular test suites'
  );
  const res1 = validateDocParity({ _mockMatrixContent: brokenMatrixCount });
  if (res1.success || !res1.errors.some(e => e.includes('row P1-TEST-01 error'))) {
    throw new Error('Negative Fixture 1 FAILED: Validator did not reject contradictory assertion count in matrix');
  }
  console.log('  [PASS] Negative Fixture 1: Successfully rejected contradictory assertion count (75 vs 76)');

  // Negative Fixture 2: Unauthorized claim of production certification
  const brokenMatrixCertified = canonicalMatrix.replace(
    'NOT CERTIFIED (DEFERRED TO SCHEDULED CLOUD GATES)',
    'PRODUCTION CERTIFIED AND LIVE AUDITED'
  );
  const res2 = validateDocParity({ _mockMatrixContent: brokenMatrixCertified });
  if (res2.success || !res2.errors.some(e => e.includes('governance error'))) {
    throw new Error('Negative Fixture 2 FAILED: Validator did not reject uncertified status claim');
  }
  console.log('  [PASS] Negative Fixture 2: Successfully rejected premature production certification claim');

  // Negative Fixture 3: Historical reference preservation (does NOT fail when historical context mentions old 8 suites)
  const matrixWithHistoricalNote = canonicalMatrix + '\n\n### Historical Appendix\nNote: In Revision 4.0, 8 test suites were initially categorized prior to granular expansion.\n';
  const res3 = validateDocParity({ _mockMatrixContent: matrixWithHistoricalNote });
  if (!res3.success) {
    throw new Error(`Negative Fixture 3 FAILED: Validator erroneously rejected document with historical reference: ${res3.errors.join(', ')}`);
  }
  console.log('  [PASS] Negative Fixture 3: Verified historical references and contextual notes are preserved without false rejection');

  // Negative Fixture 4: Manifest internal mismatch
  const canonicalManifest = JSON.parse(fs.readFileSync(path.resolve('scripts/requirements_manifest.json'), 'utf-8'));
  const brokenManifest = {
    ...canonicalManifest,
    summary: { ...canonicalManifest.summary, totalRequirements: 99 }
  };
  const res4 = validateDocParity({ _mockManifestContent: brokenManifest });
  if (res4.success || !res4.errors.some(e => e.includes('Manifest internal discrepancy'))) {
    throw new Error('Negative Fixture 4 FAILED: Validator did not catch manifest internal discrepancy');
  }
  console.log('  [PASS] Negative Fixture 4: Successfully rejected manifest internal discrepancy (99 vs 22)');
}

export function runCli(): void {
  console.log('================================================================');
  console.log('   AGILA Hub Android — Documentation Parity Validator           ');
  console.log('   Cross-Checking Manifest, Matrices, Traceability & Dashboard  ');
  console.log('================================================================');

  // Run isolated negative fixtures first
  runDocParityNegativeFixtures();

  // Validate canonical files
  const result = validateDocParity();
  console.log('\n[Documentation Checks Verified]:');
  for (const doc of result.documentsChecked) {
    console.log(`  - ${doc} (PASS)`);
  }
  console.log(`Total Document Assertions Evaluated: ${result.assertionsVerified}`);

  if (!result.success) {
    console.error('\nDocumentation Parity Validation FAILED with errors:');
    for (const e of result.errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('   DOCUMENTATION PARITY VALIDATION: PASSED (100%)               ');
  console.log('   (Manifest, matrices, traceability, and UI are fully aligned) ');
  console.log('================================================================');
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
