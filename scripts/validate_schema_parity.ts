import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'pgsql-parser';

export interface SchemaValidationResult {
  success: boolean;
  totalMigrationsInspected: number;
  allMigrationsFound: string[];
  requiredMigrationsVerified: string[];
  tableCount: number;
  tablesFound: string[];
  errors: string[];
  warnings: string[];
  unsupportedConstructsDetected: string[];
}

export const REQUIRED_MIGRATIONS = [
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

export const EXPECTED_CORE_TABLES = [
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

export async function validateSchemaParity(migrationsDir: string = 'supabase/migrations'): Promise<SchemaValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allMigrationsFound: string[] = [];
  const requiredMigrationsVerified: string[] = [];
  const tablesFoundSet = new Set<string>();
  const unsupportedConstructsDetected: string[] = [];

  if (!fs.existsSync(migrationsDir)) {
    return {
      success: false,
      totalMigrationsInspected: 0,
      allMigrationsFound: [],
      requiredMigrationsVerified: [],
      tableCount: 0,
      tablesFound: [],
      errors: [`Migrations directory not found: ${migrationsDir}`],
      warnings: [],
      unsupportedConstructsDetected: []
    };
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  allMigrationsFound.push(...files);

  // 1. Verify required migrations exist
  for (const req of REQUIRED_MIGRATIONS) {
    if (!files.includes(req)) {
      errors.push(`Missing required core migration: ${req}`);
    } else {
      requiredMigrationsVerified.push(req);
    }
  }

  // 2. Inspect every migration file using AST parsing (pgsql-parser)
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (err: any) {
      errors.push(`Failed to read migration file ${file}: ${err.message}`);
      continue;
    }

    if (!content.trim()) {
      errors.push(`Migration file ${file} is empty.`);
      continue;
    }

    let stmts: any[] = [];
    try {
      const parsed = await parse(content);
      stmts = parsed.stmts || [];
    } catch (parseErr: any) {
      errors.push(`SQL Parse error in ${file}: ${parseErr.message}. (Validator fails closed on unparseable SQL constructs).`);
      continue;
    }

    for (const stmtObj of stmts) {
      // pgsql-parser statement wrapper
      const stmt = stmtObj.stmt || stmtObj;

      // Check for CreateStmt (CREATE TABLE)
      if (stmt && stmt.CreateStmt) {
        const createStmt = stmt.CreateStmt;
        const relation = createStmt.relation;
        
        if (!relation || !relation.relname) {
          errors.push(`[${file}] Encountered CREATE TABLE with missing relation name. Failing closed.`);
          continue;
        }

        const tableName = relation.relname;
        const schemaName = relation.schemaname || 'public';

        // Check unsupported table persistence or constructs
        // relpersistence: 'p' = permanent, 't' = temporary, 'u' = unlogged
        if (createStmt.relpersistence && createStmt.relpersistence !== 'p') {
          const pType = createStmt.relpersistence === 't' ? 'TEMPORARY' : 'UNLOGGED';
          errors.push(`[${file}] Unsupported table persistence '${pType}' for table '${tableName}'. Only permanent tables are allowed.`);
          unsupportedConstructsDetected.push(`${pType} TABLE ${tableName}`);
        }

        // Check if partitioned or inherited
        if (createStmt.partspec) {
          errors.push(`[${file}] Partitioned table creation detected for '${tableName}'. Table partitioning is not supported by core validator.`);
          unsupportedConstructsDetected.push(`PARTITIONED TABLE ${tableName}`);
        }

        if (createStmt.inhRelations && createStmt.inhRelations.length > 0) {
          errors.push(`[${file}] Table inheritance detected for '${tableName}'. Inheritance is not supported.`);
          unsupportedConstructsDetected.push(`INHERITED TABLE ${tableName}`);
        }

        // Validate table inventory whitelist
        if (!EXPECTED_CORE_TABLES.includes(tableName)) {
          errors.push(`[${file}] Unauthorized table declaration found: '${tableName}' in schema '${schemaName}'. Expected only core AGILA Hub tables.`);
        } else {
          tablesFoundSet.add(tableName);
        }
      }

      // Track other statement types or explicit unsupported DDL if any
      if (stmt && stmt.DropStmt) {
        // e.g. DROP TABLE or DROP POLICY
        warnings.push(`[${file}] DROP statement detected.`);
      }
    }
  }

  const tablesFound = Array.from(tablesFoundSet).sort();

  // Verify all expected core tables were found
  for (const coreTable of EXPECTED_CORE_TABLES) {
    if (!tablesFoundSet.has(coreTable)) {
      errors.push(`Expected core table '${coreTable}' was not declared across inspected migrations.`);
    }
  }

  const success = errors.length === 0;

  return {
    success,
    totalMigrationsInspected: files.length,
    allMigrationsFound,
    requiredMigrationsVerified,
    tableCount: tablesFound.length,
    tablesFound,
    errors,
    warnings,
    unsupportedConstructsDetected
  };
}

export async function runSchemaParityNegativeFixtures(): Promise<{ fixtureName: string; passed: boolean; details: string }[]> {
  const fixtureResults: { fixtureName: string; passed: boolean; details: string }[] = [];

  // Fixture 1: Missing required migration
  const res1 = await validateSchemaParity('supabase/migrations_nonexistent_test');
  const f1Passed = !res1.success && res1.errors.some(e => e.includes('Migrations directory not found'));
  fixtureResults.push({ fixtureName: 'Missing Migrations Directory', passed: f1Passed, details: `Success: ${res1.success}, Errors: ${res1.errors.join('; ')}` });

  // Fixture 2: Unauthorized table in additional migration (using quoted identifiers and alternate formatting)
  const testDir = 'supabase/migrations_neg_test';
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  // Copy baseline migrations over
  for (const m of REQUIRED_MIGRATIONS) {
    const src = path.join('supabase/migrations', m);
    const dest = path.join(testDir, m);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }
  // Add malicious migration with quoted unauthorized table & unsupported TEMPORARY table
  const maliciousFile = path.join(testDir, '20261013000010_unauthorized_backdoor.sql');
  fs.writeFileSync(maliciousFile, 'CREATE TEMPORARY TABLE "public"."unauthorized_backdoor" (id UUID PRIMARY KEY);');

  const res2 = await validateSchemaParity(testDir);
  const f2Passed = !res2.success && 
    res2.errors.some(e => e.includes("Unauthorized table declaration found: 'unauthorized_backdoor'"));
  
  fixtureResults.push({ 
    fixtureName: 'Unauthorized Quoted Table & Unsupported TEMPORARY Table', 
    passed: f2Passed, 
    details: `Success: ${res2.success}, Errors found: ${res2.errors.length} -> ${res2.errors.join(' | ')}` 
  });

  // Clean up negative test directory
  try {
    const files = fs.readdirSync(testDir);
    for (const f of files) {
      fs.unlinkSync(path.join(testDir, f));
    }
    fs.rmdirSync(testDir);
  } catch (e) {
    // ignore cleanup err
  }

  // Fixture 3: Malformed unparseable SQL (fails closed)
  const testDir3 = 'supabase/migrations_neg_test_malformed';
  if (!fs.existsSync(testDir3)) {
    fs.mkdirSync(testDir3, { recursive: true });
  }
  for (const m of REQUIRED_MIGRATIONS) {
    const src = path.join('supabase/migrations', m);
    const dest = path.join(testDir3, m);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }
  const malformedFile = path.join(testDir3, '20261013000011_malformed.sql');
  fs.writeFileSync(malformedFile, 'CREATE TABLE public.bad_syntax (id UUID PRIMARY KEY;'); // unclosed paren

  const res3 = await validateSchemaParity(testDir3);
  const f3Passed = !res3.success && res3.errors.some(e => e.includes('SQL Parse error'));
  
  fixtureResults.push({
    fixtureName: 'Malformed SQL Parse Error (Fail Closed)',
    passed: f3Passed,
    details: `Success: ${res3.success}, Errors: ${res3.errors.join(' | ')}`
  });

  try {
    const files = fs.readdirSync(testDir3);
    for (const f of files) {
      fs.unlinkSync(path.join(testDir3, f));
    }
    fs.rmdirSync(testDir3);
  } catch (e) {}

  return fixtureResults;
}

export async function runCli() {
  console.log('=== AGILA Hub Android: Hardened Schema Parity Validator ===');
  const result = await validateSchemaParity('supabase/migrations');
  
  console.log(`Inspected ${result.totalMigrationsInspected} migration files.`);
  console.log(`Verified ${result.requiredMigrationsVerified.length} required baseline migrations.`);
  console.log(`Discovered ${result.tableCount} core tables: ${result.tablesFound.join(', ')}`);

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (result.unsupportedConstructsDetected.length > 0) {
    console.log('\nUnsupported Constructs Flagged:');
    result.unsupportedConstructsDetected.forEach(uc => console.log(`  - ${uc}`));
  }

  if (!result.success) {
    console.error('\nSchema Parity Validation FAILED:');
    result.errors.forEach(e => console.error(`  [ERROR] ${e}`));
    
    console.log('\nRunning Schema Parity Negative Fixtures...');
    const fixtures = await runSchemaParityNegativeFixtures();
    let fixturesAllPassed = true;
    for (const f of fixtures) {
      console.log(`  [Fixture: ${f.fixtureName}] -> ${f.passed ? 'PASSED (Rejected correctly)' : 'FAILED'}`);
      if (!f.passed) {
        fixturesAllPassed = false;
        console.log(`    Details: ${f.details}`);
      }
    }

    process.exit(1);
  } else {
    console.log('\nSchema Parity Validation PASSED successfully.');
    
    console.log('\nRunning Schema Parity Negative Fixtures...');
    const fixtures = await runSchemaParityNegativeFixtures();
    let fixturesAllPassed = true;
    for (const f of fixtures) {
      console.log(`  [Fixture: ${f.fixtureName}] -> ${f.passed ? 'PASSED (Rejected correctly)' : 'FAILED'}`);
      if (!f.passed) {
        fixturesAllPassed = false;
        console.log(`    Details: ${f.details}`);
      }
    }

    if (!fixturesAllPassed) {
      console.error('\nSome negative fixtures failed to trigger expected validation errors.');
      process.exit(1);
    }

    console.log('All schema validation checks and negative fixtures passed.');
    process.exit(0);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runCli();
}
