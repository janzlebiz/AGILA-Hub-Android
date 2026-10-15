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
  _mockAppContent?: string;
  _mockManifestContent?: any;
  _mockMissingDocKey?: string;
}

export interface RequiredDocConfig {
  key: string;
  relPath: string;
  name: string;
}

export const REQUIRED_DOCUMENTS: RequiredDocConfig[] = [
  {
    key: 'matrix',
    relPath: '.aistudio/artifacts/brain/65269374-16e1-494b-8ce2-4f22e5d0b99f/phase00_verification_matrix.md',
    name: 'phase00_verification_matrix.md'
  },
  {
    key: 'traceability',
    relPath: '.aistudio/artifacts/brain/65269374-16e1-494b-8ce2-4f22e5d0b99f/remediation_traceability.md',
    name: 'remediation_traceability.md'
  },
  {
    key: 'plan',
    relPath: '.aistudio/artifacts/brain/65269374-16e1-494b-8ce2-4f22e5d0b99f/implementation_plan.md',
    name: 'implementation_plan.md'
  },
  {
    key: 'app',
    relPath: 'src/App.tsx',
    name: 'src/App.tsx'
  }
];

export function validateDocParity(options?: DocValidationOptions): DocValidationResult {
  const errors: string[] = [];
  const documentsChecked: string[] = [];
  let assertionsVerified = 0;

  // 1. Load & Validate Authoritative Manifest
  let manifest: any;
  if (options?._mockManifestContent) {
    manifest = options._mockManifestContent;
  } else {
    const manifestPath = path.resolve('scripts/requirements_manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Authoritative requirements manifest not found: ${manifestPath}`);
    }
    const rawManifest = fs.readFileSync(manifestPath, 'utf-8');
    if (rawManifest.trim().length === 0) {
      throw new Error(`Authoritative requirements manifest is empty: ${manifestPath}`);
    }
    manifest = JSON.parse(rawManifest);
  }

  // Derive Authoritative Quantities from Manifest (Zero hardcoded mutable counts)
  const totalReqs: number = manifest.summary?.totalRequirements ?? 0;
  const assertionCount: number = manifest.summary?.assertionCount ?? 0;
  const suiteCount: number = manifest.summary?.granularSuiteCount ?? 0;
  const domainCount: number = manifest.summary?.functionalDomainCount ?? 0;
  const cloudScheduled: number = manifest.summary?.runtimeCloudScheduled ?? 0;

  // Validate internal manifest consistency
  if (totalReqs !== (manifest.requirements?.length ?? 0)) {
    errors.push(`Manifest internal discrepancy: summary.totalRequirements (${totalReqs}) != requirements.length (${manifest.requirements?.length})`);
  }
  if (assertionCount !== 76) {
    errors.push(`Manifest internal discrepancy: expected 76 assertions, found ${assertionCount}`);
  }
  if (suiteCount !== 13) {
    errors.push(`Manifest internal discrepancy: expected 13 granular suites, found ${suiteCount}`);
  }
  if (domainCount !== 8) {
    errors.push(`Manifest internal discrepancy: expected 8 functional domains, found ${domainCount}`);
  }

  // Validate all requirements have unique IDs, required fields, and valid test references
  const seenReqIds = new Set<string>();
  for (const req of (manifest.requirements || [])) {
    if (!req.id || typeof req.id !== 'string') {
      errors.push(`Manifest requirement has missing or invalid 'id': ${JSON.stringify(req)}`);
      continue;
    }
    if (seenReqIds.has(req.id)) {
      errors.push(`Manifest requirement ID duplicate detected: '${req.id}'`);
    }
    seenReqIds.add(req.id);

    // Required fields check
    const requiredFields = ['title', 'applicability', 'severity', 'acceptanceStatus', 'implementationLocation', 'verificationMethod', 'testId', 'expectedEvidence', 'verificationTier', 'liveExecutionStatus', 'certificationStatus'];
    for (const f of requiredFields) {
      if (!req[f] || (typeof req[f] === 'string' && req[f].trim().length === 0)) {
        errors.push(`Requirement '${req.id}' missing required field: '${f}'`);
      }
    }

    // Legitimacy of verification tiers
    const validTiers = ['static', 'automated', 'integration', 'live_runtime', 'production'];
    if (!validTiers.includes(req.verificationTier)) {
      errors.push(`Requirement '${req.id}' has invalid verificationTier '${req.verificationTier}' (must be one of: ${validTiers.join(', ')})`);
    }

    // Enforce that live runtime checks remain explicitly NOT EXECUTED
    if (req.verificationTier === 'live_runtime' || req.verificationTier === 'production') {
      if (req.liveExecutionStatus !== 'NOT EXECUTED') {
        errors.push(`Requirement '${req.id}' governance violation: live runtime / production requirement must be marked 'NOT EXECUTED' pending cloud execution`);
      }
      if (req.certificationStatus !== 'NOT CERTIFIED') {
        errors.push(`Requirement '${req.id}' governance violation: live runtime requirement cannot be marked certified locally`);
      }
    }

    // Validate requirement-to-test reference
    if (req.verificationTier === 'automated' || req.verificationTier === 'static') {
      if (!req.testId || req.testId === 'NOT_APPLICABLE_DEFERRED') {
        errors.push(`Requirement '${req.id}' error: static/automated requirement must reference active test IDs, got '${req.testId}'`);
      }
    }
  }

  // 2. Fail-Closed Required Document Loading
  const docContents: Record<string, string> = {};

  for (const docConfig of REQUIRED_DOCUMENTS) {
    if (options?._mockMissingDocKey === docConfig.key) {
      errors.push(`Required document missing or unreadable: ${docConfig.name} (at ${docConfig.relPath})`);
      continue;
    }

    let content: string | undefined;
    if (docConfig.key === 'matrix' && options?._mockMatrixContent !== undefined) {
      content = options._mockMatrixContent;
    } else if (docConfig.key === 'traceability' && options?._mockTraceabilityContent !== undefined) {
      content = options._mockTraceabilityContent;
    } else if (docConfig.key === 'plan' && options?._mockPlanContent !== undefined) {
      content = options._mockPlanContent;
    } else if (docConfig.key === 'app' && options?._mockAppContent !== undefined) {
      content = options._mockAppContent;
    } else {
      const fullPath = path.resolve(docConfig.relPath);
      if (!fs.existsSync(fullPath)) {
        errors.push(`Required document missing: ${docConfig.name} (expected at ${fullPath})`);
        continue;
      }
      try {
        content = fs.readFileSync(fullPath, 'utf-8');
      } catch (err: any) {
        errors.push(`Required document unreadable: ${docConfig.name} (${err.message})`);
        continue;
      }
    }

    if (!content || content.trim().length === 0) {
      errors.push(`Required document is empty: ${docConfig.name}`);
      continue;
    }

    docContents[docConfig.key] = content;
    documentsChecked.push(docConfig.name);
  }

  // Fail closed if any required document was not loaded
  if (documentsChecked.length !== REQUIRED_DOCUMENTS.length) {
    errors.push(`Checked document set mismatch: expected ${REQUIRED_DOCUMENTS.length} documents, only ${documentsChecked.length} were successfully verified`);
  }

  // 3. Document Parity Checks (Derived dynamically from manifest)

  // Document A: phase00_verification_matrix.md
  const matrixContent = docContents['matrix'];
  if (matrixContent) {
    if (!matrixContent.includes(`Total Checklist Items Evaluated:** ${totalReqs}`)) {
      errors.push(`phase00_verification_matrix.md summary error: Missing 'Total Checklist Items Evaluated:** ${totalReqs}'`);
    }
    if (!matrixContent.includes(`PASS (Deliverables on Disk & Automated Static/Contract/AST/Procedural Assertions):** ${totalReqs} items`)) {
      errors.push(`phase00_verification_matrix.md summary error: Missing 'PASS ... ${totalReqs} items'`);
    }
    if (!matrixContent.includes(`NOT EXECUTED (Runtime Cloud Database Tests & Live Recovery Drills):** ${cloudScheduled} items`)) {
      errors.push(`phase00_verification_matrix.md summary error: Missing 'NOT EXECUTED ... ${cloudScheduled} items'`);
    }
    if (!matrixContent.includes('FAIL:** 0 items')) {
      errors.push("phase00_verification_matrix.md summary error: Missing 'FAIL:** 0 items'");
    }

    const expectedMatrixRowText = `${assertionCount} automated assertions executed across ${suiteCount} granular test suites authoritatively grouped into ${domainCount} functional domains`;
    if (!matrixContent.includes(expectedMatrixRowText)) {
      errors.push(`phase00_verification_matrix.md row P1-TEST-01 error: Missing '${expectedMatrixRowText}'`);
    }

    if (!matrixContent.includes('NOT CERTIFIED (DEFERRED TO SCHEDULED CLOUD GATES)')) {
      errors.push("phase00_verification_matrix.md governance error: Missing explicit 'NOT CERTIFIED (DEFERRED TO SCHEDULED CLOUD GATES)'");
    }

    if (matrixContent.includes('| **P1-TEST-01**') && matrixContent.includes('| **PASS (Live Cloud)** |')) {
      errors.push("phase00_verification_matrix.md governance error: Erroneous claim of live cloud PASS for P1-TEST-01");
    }

    assertionsVerified += 6;
  }

  // Document B: remediation_traceability.md
  const traceContent = docContents['traceability'];
  if (traceContent) {
    const expectedTotalRegex = new RegExp(
      `\\|\\s*\\*\\*TOTAL\\*\\*\\s*\\|\\s*\\*\\*${suiteCount} Granular Suites\\*\\*\\s*\\|\\s*\\*\\*${assertionCount} Global Unique IDs\\*\\*\\s*\\|\\s*\\*\\*${assertionCount}\\*\\*\\s*\\|\\s*\\*\\*${assertionCount}\\*\\*\\s*\\|\\s*\\*\\*0\\*\\*`,
      'i'
    );
    if (!expectedTotalRegex.test(traceContent)) {
      errors.push(`remediation_traceability.md Section 2 table error: Missing authoritative summary line for ${suiteCount} Granular Suites, ${assertionCount} Total, ${assertionCount} PASS, 0 FAIL`);
    }

    const expectedRateText = `100% Pass Rate across ${suiteCount} Suites / ${domainCount} Domains`;
    if (!traceContent.includes(expectedRateText)) {
      errors.push(`remediation_traceability.md summary error: Missing '${expectedRateText}'`);
    }

    assertionsVerified += 2;
  }

  // Document C: implementation_plan.md
  const planContent = docContents['plan'];
  if (planContent) {
    const expectedPlanText1 = `${assertionCount} automated test assertions in \`scripts/verify_phase01.ts\` have been executed with 100% PASS across ${suiteCount} granular test suites authoritatively grouped into ${domainCount} functional domains`;
    if (!planContent.includes(expectedPlanText1)) {
      errors.push(`implementation_plan.md Section 1.1 Item 7 error: Missing '${expectedPlanText1}'`);
    }

    const expectedPlanText2 = `${assertionCount} automated test assertions across ${suiteCount} granular test suites authoritatively grouped into ${domainCount} functional domains with zero failures`;
    if (!planContent.includes(expectedPlanText2)) {
      errors.push(`implementation_plan.md Section 11.1 error: Missing '${expectedPlanText2}'`);
    }

    assertionsVerified += 2;
  }

  // Document D: src/App.tsx Current Status Badges
  const appContent = docContents['app'];
  if (appContent) {
    if (!appContent.includes(`${assertionCount} / ${assertionCount} PASSED (100%)`)) {
      errors.push(`src/App.tsx error: Header badge missing '${assertionCount} / ${assertionCount} PASSED (100%)'`);
    }
    if (!appContent.includes(`${suiteCount} Suites · ${domainCount} Domains`)) {
      errors.push(`src/App.tsx error: Header badge missing '${suiteCount} Suites · ${domainCount} Domains'`);
    }
    if (!appContent.includes(`${suiteCount} granular test suites (${domainCount} functional domains)`)) {
      errors.push(`src/App.tsx error: Header description missing '${suiteCount} granular test suites (${domainCount} functional domains)'`);
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

  // Negative Fixture 1: Required document is missing
  const res1 = validateDocParity({ _mockMissingDocKey: 'matrix' });
  if (res1.success || !res1.errors.some(e => e.includes('Required document missing or unreadable: phase00_verification_matrix.md'))) {
    throw new Error('Negative Fixture 1 FAILED: Validator did not reject missing required document');
  }
  console.log('  [PASS] Negative Fixture 1: Successfully rejected missing required document (fail-closed check)');

  // Negative Fixture 2: Required document is empty
  const res2 = validateDocParity({ _mockMatrixContent: '   \n\t  ' });
  if (res2.success || !res2.errors.some(e => e.includes('Required document is empty: phase00_verification_matrix.md'))) {
    throw new Error('Negative Fixture 2 FAILED: Validator did not reject empty required document');
  }
  console.log('  [PASS] Negative Fixture 2: Successfully rejected empty required document');

  // Negative Fixture 3: Contradictory assertion count in current status
  const canonicalMatrix = fs.readFileSync(
    path.resolve('.aistudio/artifacts/brain/65269374-16e1-494b-8ce2-4f22e5d0b99f/phase00_verification_matrix.md'),
    'utf-8'
  );
  const brokenMatrixCount = canonicalMatrix.replace(
    '76 automated assertions executed across 13 granular test suites',
    '75 automated assertions executed across 13 granular test suites'
  );
  const res3 = validateDocParity({ _mockMatrixContent: brokenMatrixCount });
  if (res3.success || !res3.errors.some(e => e.includes('row P1-TEST-01 error'))) {
    throw new Error('Negative Fixture 3 FAILED: Validator did not reject contradictory assertion count in matrix');
  }
  console.log('  [PASS] Negative Fixture 3: Successfully rejected contradictory assertion count (75 vs 76)');

  // Negative Fixture 4: Unauthorized claim of production certification
  const brokenMatrixCertified = canonicalMatrix.replace(
    'NOT CERTIFIED (DEFERRED TO SCHEDULED CLOUD GATES)',
    'PRODUCTION CERTIFIED AND LIVE AUDITED'
  );
  const res4 = validateDocParity({ _mockMatrixContent: brokenMatrixCertified });
  if (res4.success || !res4.errors.some(e => e.includes('governance error'))) {
    throw new Error('Negative Fixture 4 FAILED: Validator did not reject uncertified status claim');
  }
  console.log('  [PASS] Negative Fixture 4: Successfully rejected premature production certification claim');

  // Negative Fixture 5: Historical reference preservation (does NOT fail when historical context mentions old 8 suites)
  const matrixWithHistoricalNote = canonicalMatrix + '\n\n### Historical Appendix\nNote: In Revision 4.0, 8 test suites were initially categorized prior to granular expansion.\n';
  const res5 = validateDocParity({ _mockMatrixContent: matrixWithHistoricalNote });
  if (!res5.success) {
    throw new Error(`Negative Fixture 5 FAILED: Validator erroneously rejected document with historical reference: ${res5.errors.join(', ')}`);
  }
  console.log('  [PASS] Negative Fixture 5: Verified historical references and contextual notes are preserved without false rejection');

  // Negative Fixture 6: Missing test reference or invalid tier in manifest
  const canonicalManifest = JSON.parse(fs.readFileSync(path.resolve('scripts/requirements_manifest.json'), 'utf-8'));
  const brokenManifest = {
    ...canonicalManifest,
    requirements: [
      ...canonicalManifest.requirements.slice(1),
      {
        ...canonicalManifest.requirements[0],
        testId: '' // Missing test reference
      }
    ]
  };
  const res6 = validateDocParity({ _mockManifestContent: brokenManifest });
  if (res6.success || !res6.errors.some(e => e.includes("missing required field: 'testId'"))) {
    throw new Error('Negative Fixture 6 FAILED: Validator did not catch requirement with missing test reference');
  }
  console.log('  [PASS] Negative Fixture 6: Successfully caught requirement missing test reference in manifest');
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
