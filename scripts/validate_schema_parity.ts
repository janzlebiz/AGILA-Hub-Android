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

export const ALLOWED_VIEWS = [
  'member_directory_view'
];

export async function validateSchemaParity(migrationsDir: string = 'supabase/migrations'): Promise<SchemaValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allMigrationsFound: string[] = [];
  const requiredMigrationsVerified: string[] = [];
  const tablesFoundSet = new Set<string>();
  const unsupportedConstructsDetected: string[] = [];
  const tableDeclarations = new Map<string, string>(); // tableName -> file where declared

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
      const stmt = stmtObj.stmt || stmtObj;

      let tableName: string | null = null;
      let schemaName: string = 'public';
      let isTableCreation = false;

      if (stmt && stmt.CreateStmt) {
        isTableCreation = true;
        const createStmt = stmt.CreateStmt;
        const relation = createStmt.relation;
        if (!relation || !relation.relname) {
          errors.push(`[${file}] Encountered CREATE TABLE with missing relation name. Failing closed.`);
          continue;
        }
        tableName = relation.relname;
        schemaName = relation.schemaname || 'public';

        // Check unsupported table persistence or constructs
        if (createStmt.relpersistence && createStmt.relpersistence !== 'p') {
          const pType = createStmt.relpersistence === 't' ? 'TEMPORARY' : 'UNLOGGED';
          errors.push(`[${file}] Unsupported table persistence '${pType}' for table '${tableName}'. Only permanent tables are allowed.`);
          unsupportedConstructsDetected.push(`${pType} TABLE ${tableName}`);
        }

        if (createStmt.partspec) {
          errors.push(`[${file}] Partitioned table creation detected for '${tableName}'. Table partitioning is not supported by core validator.`);
          unsupportedConstructsDetected.push(`PARTITIONED TABLE ${tableName}`);
        }

        if (createStmt.inhRelations && createStmt.inhRelations.length > 0) {
          errors.push(`[${file}] Table inheritance detected for '${tableName}'. Inheritance is not supported.`);
          unsupportedConstructsDetected.push(`INHERITED TABLE ${tableName}`);
        }
      } else if (stmt && stmt.CreateTableAsStmt) {
        const createTableAs = stmt.CreateTableAsStmt;
        const rel = createTableAs.into?.rel;
        const relName = rel?.relname || 'unknown';
        if (createTableAs.objtype === 'OBJECT_MATVIEW') {
          errors.push(`[${file}] Materialized view '${relName}' encountered. CREATE MATERIALIZED VIEW cannot satisfy expected core-table requirements.`);
          unsupportedConstructsDetected.push(`CREATE MATERIALIZED VIEW ${relName}`);
          continue;
        }
        if (EXPECTED_CORE_TABLES.includes(relName)) {
          errors.push(`[${file}] Core table '${relName}' declared using CREATE TABLE AS. Core tables require permanent base tables and cannot be satisfied by CREATE TABLE AS.`);
          unsupportedConstructsDetected.push(`CREATE TABLE AS core table ${relName}`);
          continue;
        }
        isTableCreation = true;
        if (!rel || !rel.relname) {
          errors.push(`[${file}] Encountered CREATE TABLE AS with missing relation name. Failing closed.`);
          continue;
        }
        tableName = rel.relname;
        schemaName = rel.schemaname || 'public';
      } else if (stmt && stmt.ViewStmt) {
        const viewRel = stmt.ViewStmt.view;
        const viewName = viewRel?.relname || 'unknown';
        if (EXPECTED_CORE_TABLES.includes(viewName)) {
          errors.push(`[${file}] Core table '${viewName}' cannot be declared as a VIEW. Core tables require permanent base tables.`);
        } else if (!ALLOWED_VIEWS.includes(viewName)) {
          errors.push(`[${file}] Unauthorized view declaration found: '${viewName}'. Only allowed views (${ALLOWED_VIEWS.join(', ')}) are permitted.`);
        }
        continue;
      } else if (stmt && stmt.CreateForeignTableStmt) {
        errors.push(`[${file}] Unsupported table creation form 'CREATE FOREIGN TABLE' encountered. Validator fails closed on uninspected table-creation forms.`);
        unsupportedConstructsDetected.push('CREATE FOREIGN TABLE');
        continue;
      }

      if (isTableCreation && tableName) {
        // Enforce all core tables are declared in public schema
        if (EXPECTED_CORE_TABLES.includes(tableName) && schemaName !== 'public') {
          errors.push(`[${file}] Core table '${tableName}' is declared in schema '${schemaName}', but all core tables must be declared in the public schema.`);
        }

        // Track duplicate table declarations across migrations
        if (tableDeclarations.has(tableName)) {
          const existingFile = tableDeclarations.get(tableName);
          errors.push(`[${file}] Duplicate table declaration found for '${tableName}' (previously declared in '${existingFile}').`);
        } else {
          tableDeclarations.set(tableName, file);
        }

        // Validate table inventory whitelist
        if (!EXPECTED_CORE_TABLES.includes(tableName)) {
          errors.push(`[${file}] Unauthorized table declaration found: '${tableName}' in schema '${schemaName}'. Expected only core AGILA Hub tables.`);
        } else {
          tablesFoundSet.add(tableName);
        }
      }

      if (stmt && stmt.DropStmt) {
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

  const setupTestDir = (dirName: string) => {
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }
    for (const m of REQUIRED_MIGRATIONS) {
      const src = path.join('supabase/migrations', m);
      const dest = path.join(dirName, m);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
  };

  const cleanupTestDir = (dirName: string) => {
    try {
      const files = fs.readdirSync(dirName);
      for (const f of files) {
        fs.unlinkSync(path.join(dirName, f));
      }
      fs.rmdirSync(dirName);
    } catch (e) {}
  };

  // Fixture 1: Missing required migration
  const res1 = await validateSchemaParity('supabase/migrations_nonexistent_test');
  const f1Passed = !res1.success && res1.errors.some(e => e.includes('Migrations directory not found'));
  fixtureResults.push({ fixtureName: 'Missing Migrations Directory', passed: f1Passed, details: `Success: ${res1.success}, Errors: ${res1.errors.join('; ')}` });

  // Fixture 2: Unauthorized table in additional migration (using quoted identifiers and alternate formatting)
  const testDir2 = 'supabase/migrations_neg_test_unauth';
  setupTestDir(testDir2);
  const maliciousFile2 = path.join(testDir2, '20261013000010_unauthorized_backdoor.sql');
  fs.writeFileSync(maliciousFile2, 'CREATE TEMPORARY TABLE "public"."unauthorized_backdoor" (id UUID PRIMARY KEY);');
  const res2 = await validateSchemaParity(testDir2);
  const f2Passed = !res2.success && res2.errors.some(e => e.includes("Unauthorized table declaration found: 'unauthorized_backdoor'"));
  fixtureResults.push({ 
    fixtureName: 'Unauthorized Quoted Table & Unsupported TEMPORARY Table', 
    passed: f2Passed, 
    details: `Success: ${res2.success}, Errors found: ${res2.errors.length} -> ${res2.errors.join(' | ')}` 
  });
  cleanupTestDir(testDir2);

  // Fixture 3: Malformed unparseable SQL (fails closed)
  const testDir3 = 'supabase/migrations_neg_test_malformed';
  setupTestDir(testDir3);
  const malformedFile = path.join(testDir3, '20261013000011_malformed.sql');
  fs.writeFileSync(malformedFile, 'CREATE TABLE public.bad_syntax (id UUID PRIMARY KEY;');
  const res3 = await validateSchemaParity(testDir3);
  const f3Passed = !res3.success && res3.errors.some(e => e.includes('SQL Parse error'));
  fixtureResults.push({
    fixtureName: 'Malformed SQL Parse Error (Fail Closed)',
    passed: f3Passed,
    details: `Success: ${res3.success}, Errors: ${res3.errors.join(' | ')}`
  });
  cleanupTestDir(testDir3);

  // Fixture 4: Authorized core table declared outside public schema
  const testDir4 = 'supabase/migrations_neg_test_schema';
  setupTestDir(testDir4);
  const schemaFile = path.join(testDir4, '20261013000012_schema_violation.sql');
  fs.writeFileSync(schemaFile, 'CREATE TABLE other_schema.members (id UUID PRIMARY KEY);');
  const res4 = await validateSchemaParity(testDir4);
  const f4Passed = !res4.success && res4.errors.some(e => e.includes("Core table 'members' is declared in schema 'other_schema'"));
  fixtureResults.push({
    fixtureName: 'Core Table Declared Outside Public Schema',
    passed: f4Passed,
    details: `Success: ${res4.success}, Errors: ${res4.errors.join(' | ')}`
  });
  cleanupTestDir(testDir4);

  // Fixture 5: Duplicate core-table declaration across migrations
  const testDir5 = 'supabase/migrations_neg_test_dup';
  setupTestDir(testDir5);
  const dupFile = path.join(testDir5, '20261013000013_duplicate_members.sql');
  fs.writeFileSync(dupFile, 'CREATE TABLE members (id UUID PRIMARY KEY);');
  const res5 = await validateSchemaParity(testDir5);
  const f5Passed = !res5.success && res5.errors.some(e => e.includes("Duplicate table declaration found for 'members'"));
  fixtureResults.push({
    fixtureName: 'Duplicate Core-Table Declaration Across Migrations',
    passed: f5Passed,
    details: `Success: ${res5.success}, Errors: ${res5.errors.join(' | ')}`
  });
  cleanupTestDir(testDir5);

  // Fixture 6: Unauthorized table created using CREATE TABLE AS
  const testDir6 = 'supabase/migrations_neg_test_cta';
  setupTestDir(testDir6);
  const ctaFile = path.join(testDir6, '20261013000014_create_table_as.sql');
  fs.writeFileSync(ctaFile, 'CREATE TABLE unauthorized_cat AS SELECT 1 AS id;');
  const res6 = await validateSchemaParity(testDir6);
  const f6Passed = !res6.success && res6.errors.some(e => e.includes("Unauthorized table declaration found: 'unauthorized_cat'"));
  fixtureResults.push({
    fixtureName: 'Unauthorized Table Created Using CREATE TABLE AS',
    passed: f6Passed,
    details: `Success: ${res6.success}, Errors: ${res6.errors.join(' | ')}`
  });
  cleanupTestDir(testDir6);

  // Fixture 6b: CREATE TABLE AS attempting to declare core table 'members'
  const testDir6b = 'supabase/migrations_neg_test_cta_core';
  setupTestDir(testDir6b);
  const ctaCoreFile = path.join(testDir6b, '20261013000014_cta_members.sql');
  fs.writeFileSync(ctaCoreFile, 'CREATE TABLE members AS SELECT 1 AS id;');
  const res6b = await validateSchemaParity(testDir6b);
  const f6bPassed = !res6b.success && res6b.errors.some(e => e.includes("Core table 'members' declared using CREATE TABLE AS"));
  fixtureResults.push({
    fixtureName: 'CREATE TABLE AS Core Table Declaration Rejected',
    passed: f6bPassed,
    details: `Success: ${res6b.success}, Errors: ${res6b.errors.join(' | ')}`
  });
  cleanupTestDir(testDir6b);

  // Fixture 7: Materialized View substitution cannot satisfy core table requirement
  const testDir7 = 'supabase/migrations_neg_test_matview';
  setupTestDir(testDir7);
  const mvFile = path.join(testDir7, '20261013000015_matview.sql');
  fs.writeFileSync(mvFile, 'CREATE MATERIALIZED VIEW unauthorized_mv AS SELECT 1 AS id;');
  const res7 = await validateSchemaParity(testDir7);
  const f7Passed = !res7.success && res7.errors.some(e => e.includes('CREATE MATERIALIZED VIEW cannot satisfy expected core-table requirements'));
  fixtureResults.push({
    fixtureName: 'Materialized View Substitution Rejected',
    passed: f7Passed,
    details: `Success: ${res7.success}, Errors: ${res7.errors.join(' | ')}`
  });
  cleanupTestDir(testDir7);

  // Fixture 8: Unauthorized View rejected
  const testDir8 = 'supabase/migrations_neg_test_view';
  setupTestDir(testDir8);
  const viewFile = path.join(testDir8, '20261013000016_view.sql');
  fs.writeFileSync(viewFile, 'CREATE VIEW unauthorized_view AS SELECT 1;');
  const res8 = await validateSchemaParity(testDir8);
  const f8Passed = !res8.success && res8.errors.some(e => e.includes('Unauthorized view declaration found: \'unauthorized_view\''));
  fixtureResults.push({
    fixtureName: 'Unauthorized View Rejected',
    passed: f8Passed,
    details: `Success: ${res8.success}, Errors: ${res8.errors.join(' | ')}`
  });
  cleanupTestDir(testDir8);

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
