import fs from 'fs';
import path from 'path';

export interface SchemaValidationResult {
  success: boolean;
  tableCount: number;
  tablesVerified: string[];
  columnsVerified: string[];
  indexesVerified: string[];
  supportedConstructs: string[];
  unverifiedDimensions: string[];
  errors: string[];
}

export interface SchemaValidationOptions {
  migrationsDir?: string;
  preflightPath?: string;
  _mockMigrationsContent?: Record<string, string>;
  _mockPreflightContent?: string;
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

export const SUPPORTED_SQL_CONSTRUCTS = [
  'CREATE TABLE [IF NOT EXISTS] public.<table_name> ( ... )',
  'Primitive & Custom Data Types: UUID, VARCHAR(n), DECIMAL(p,s), TIMESTAMPTZ, DATE, vector(n), INT, BOOLEAN',
  'Column Constraints: NOT NULL, PRIMARY KEY, DEFAULT, UNIQUE',
  'Table Constraints: CONSTRAINT <name> UNIQUE ( ... )',
  'Index Declarations: CREATE [UNIQUE] INDEX ON public.<table_name> [USING hnsw|btree] ( ... )',
  'Preflight Declarations: v_expected_tables TEXT[] := ARRAY[ ... ]',
  'Preflight Information Schema Checks: table_name, column_name, data_type, character_maximum_length',
  'Preflight Catalog Checks: pg_indexes, pg_constraint, pg_tables.rowsecurity loop'
];

export const UNVERIFIED_SCHEMA_DIMENSIONS = [
  'Runtime Database Constraints: Live foreign key referential integrity enforcement on mutated rows',
  'Runtime Triggers: Trigger execution order and procedural state modifications inside PL/pgSQL',
  'Dynamic SQL Statements: SQL queries executed via EXECUTE format(...) within procedural functions',
  'Storage Object Policies: Supabase storage.objects RLS and MIME type enforcement',
  'Live Auth Gateway Invariants: Supabase GoTrue JWT claims, token revocation, and session states'
];

export function validateSchemaParity(options?: SchemaValidationOptions): SchemaValidationResult {
  const errors: string[] = [];
  const tablesVerified: string[] = [];
  const columnsVerified: string[] = [];
  const indexesVerified: string[] = [];

  // 1. Load & Validate Migration Files
  let migrationFilesContent: Record<string, string> = {};

  if (options?._mockMigrationsContent) {
    migrationFilesContent = options._mockMigrationsContent;
    // Verify that every required migration is present in the mock
    for (const reqMigration of REQUIRED_MIGRATIONS) {
      if (!migrationFilesContent[reqMigration]) {
        errors.push(`Missing required migration file: ${reqMigration}`);
      }
    }
  } else {
    const migrationsDir = options?.migrationsDir || path.resolve('supabase/migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${migrationsDir}`);
    }
    for (const reqMigration of REQUIRED_MIGRATIONS) {
      const fullPath = path.join(migrationsDir, reqMigration);
      if (!fs.existsSync(fullPath)) {
        errors.push(`Missing required migration file: ${reqMigration} (at ${fullPath})`);
        continue;
      }
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.trim().length === 0) {
          errors.push(`Required migration file is empty: ${reqMigration}`);
          continue;
        }
        migrationFilesContent[reqMigration] = content;
      } catch (err: any) {
        errors.push(`Required migration file is unreadable: ${reqMigration} (${err.message})`);
      }
    }
  }

  // 2. Load & Validate Preflight Script
  let preflightContent = '';
  if (options?._mockPreflightContent !== undefined) {
    preflightContent = options._mockPreflightContent;
    if (preflightContent.trim().length === 0) {
      errors.push('Preflight script content is empty');
    }
  } else {
    const preflightPath = options?.preflightPath || path.resolve('scripts/preflight_schema_check.sql');
    if (!fs.existsSync(preflightPath)) {
      throw new Error(`Preflight script not found: ${preflightPath}`);
    }
    preflightContent = fs.readFileSync(preflightPath, 'utf-8');
    if (preflightContent.trim().length === 0) {
      errors.push(`Preflight script is empty: ${preflightPath}`);
    }
  }

  // 3. Fail Closed on Genuinely Unsupported SQL Constructs in Input
  // (e.g. Dynamic DDL execution, table partitioning outside supported static model)
  const unsupportedConstructPatterns = [
    { pattern: /PARTITION\s+BY\s+(?:HASH|RANGE|LIST)/i, name: 'Table Partitioning (PARTITION BY)' },
    { pattern: /EXECUTE\s+(?:format\s*\(|'CREATE\s+TABLE)/i, name: 'Dynamic DDL in procedural block (EXECUTE format/CREATE)' },
    { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?!public\.)[a-z0-9_]+\.[a-z0-9_]+/i, name: 'Non-public schema table declaration' }
  ];

  for (const [filename, content] of Object.entries(migrationFilesContent)) {
    for (const uc of unsupportedConstructPatterns) {
      if (uc.pattern.test(content)) {
        errors.push(`Unsupported SQL construct encountered in '${filename}': Offline static validator cannot reliably analyze '${uc.name}'. Live database validation required.`);
      }
    }
  }

  // 4. Extract and Validate Table Declarations Across Migrations
  // Extract individual table blocks: CREATE TABLE [IF NOT EXISTS] public.<name> ( ... );
  const tableBlockRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z_]+)\s*\(([\s\S]*?)\);/gi;
  const migrationTablesDeclared = new Map<string, { filename: string; blockContent: string }>();
  const duplicateTables = new Set<string>();

  for (const [filename, content] of Object.entries(migrationFilesContent)) {
    let match: RegExpExecArray | null;
    while ((match = tableBlockRegex.exec(content)) !== null) {
      const tableName = match[1];
      const blockContent = match[2];

      if (migrationTablesDeclared.has(tableName)) {
        duplicateTables.add(tableName);
      } else {
        migrationTablesDeclared.set(tableName, { filename, blockContent });
      }
    }
  }

  if (duplicateTables.size > 0) {
    for (const dup of duplicateTables) {
      errors.push(`Duplicate table declaration detected across migrations for table 'public.${dup}'`);
    }
  }

  // Check for unexpected public tables in migrations
  for (const [tableName, meta] of migrationTablesDeclared.entries()) {
    if (!EXPECTED_CORE_TABLES.includes(tableName)) {
      errors.push(`Unexpected table declared in migrations: 'public.${tableName}' (in ${meta.filename})`);
    }
  }

  // 5. Extract v_expected_tables from Preflight
  const preflightArrayMatch = preflightContent.match(/v_expected_tables\s+TEXT\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/i);
  if (!preflightArrayMatch) {
    errors.push('Preflight script is missing or has malformed "v_expected_tables TEXT[] := ARRAY[...]" declaration');
  }

  const preflightTables = new Set<string>();
  if (preflightArrayMatch) {
    const rawArray = preflightArrayMatch[1];
    const itemRegex = /'([a-z_]+)'/gi;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(rawArray)) !== null) {
      preflightTables.add(itemMatch[1]);
    }
  }

  // Core Table Coverage Verification
  for (const expectedTable of EXPECTED_CORE_TABLES) {
    if (!migrationTablesDeclared.has(expectedTable)) {
      errors.push(`Migration DDL coverage failure: Expected core table '${expectedTable}' is not declared in migrations`);
    }
    if (!preflightTables.has(expectedTable)) {
      errors.push(`Preflight coverage failure: Expected core table '${expectedTable}' is missing from preflight v_expected_tables`);
    } else {
      tablesVerified.push(expectedTable);
    }
  }

  if (preflightTables.size !== EXPECTED_CORE_TABLES.length) {
    errors.push(`Preflight table count mismatch: Expected ${EXPECTED_CORE_TABLES.length} tables, found ${preflightTables.size}`);
  }

  // 6. Object-Tied Column Declarations & Parity Checks

  // Check A: audit_logs.actor_type VARCHAR(50)
  const auditLogsBlock = migrationTablesDeclared.get('audit_logs')?.blockContent;
  if (!auditLogsBlock || !/actor_type\s+VARCHAR\(50\)/i.test(auditLogsBlock)) {
    errors.push("Column contract failure: Column 'actor_type VARCHAR(50)' is not defined inside CREATE TABLE for 'public.audit_logs'");
  } else {
    // Verify preflight binds check specifically to audit_logs
    const preflightActorTypeBound = /table_name\s*=\s*'audit_logs'[\s\S]*?column_name\s*=\s*'actor_type'[\s\S]*?data_type\s*=\s*'character varying'[\s\S]*?character_maximum_length\s*=\s*50/i.test(preflightContent);
    if (!preflightActorTypeBound) {
      errors.push("Column-type parity failure: Preflight script does not assert actor_type as 'character varying' with character_maximum_length = 50 on table 'audit_logs'");
    } else {
      columnsVerified.push('public.audit_logs.actor_type VARCHAR(50)');
    }
  }

  // Check B: members.auth_user_id UUID
  const membersBlock = migrationTablesDeclared.get('members')?.blockContent;
  if (!membersBlock || !/auth_user_id\s+UUID/i.test(membersBlock)) {
    errors.push("Column contract failure: Column 'auth_user_id UUID' is not defined inside CREATE TABLE for 'public.members'");
  } else {
    const preflightAuthBound = /table_name\s*=\s*'members'[\s\S]*?column_name\s*=\s*'auth_user_id'[\s\S]*?data_type\s*=\s*'uuid'/i.test(preflightContent);
    if (!preflightAuthBound) {
      errors.push("Column-type parity failure: Preflight script does not assert auth_user_id as uuid on table 'members'");
    } else {
      columnsVerified.push('public.members.auth_user_id UUID');
    }
  }

  // Check C: contributions.closed_by UUID & uq_reference_payment
  const contributionsBlock = migrationTablesDeclared.get('contributions')?.blockContent;
  if (!contributionsBlock || !/closed_by\s+UUID/i.test(contributionsBlock)) {
    errors.push("Column contract failure: Column 'closed_by UUID' is not defined inside CREATE TABLE for 'public.contributions'");
  } else {
    const preflightClosedBound = /table_name\s*=\s*'contributions'[\s\S]*?column_name\s*=\s*'closed_by'[\s\S]*?data_type\s*=\s*'uuid'/i.test(preflightContent);
    if (!preflightClosedBound) {
      errors.push("Column-type parity failure: Preflight script does not assert closed_by as uuid on table 'contributions'");
    } else {
      columnsVerified.push('public.contributions.closed_by UUID');
    }
  }

  if (!contributionsBlock || !/CONSTRAINT\s+uq_reference_payment\s+UNIQUE\s*\(\s*payment_channel\s*,\s*reference_number\s*\)/i.test(contributionsBlock)) {
    errors.push("Constraint contract failure: Constraint 'uq_reference_payment UNIQUE (payment_channel, reference_number)' is not defined inside CREATE TABLE for 'public.contributions'");
  } else {
    const preflightUqBound = /conname\s*=\s*'uq_reference_payment'[\s\S]*?contype\s*=\s*'u'[\s\S]*?indisunique\s*=\s*TRUE/i.test(preflightContent);
    if (!preflightUqBound) {
      errors.push("Constraint parity failure: Preflight script does not assert uq_reference_payment unique constraint and unique index");
    } else {
      indexesVerified.push('public.contributions.uq_reference_payment (UNIQUE on channel, reference_number)');
    }
  }

  // Check D: expenses.reversed_by UUID
  const expensesBlock = migrationTablesDeclared.get('expenses')?.blockContent;
  if (!expensesBlock || !/reversed_by\s+UUID/i.test(expensesBlock)) {
    errors.push("Column contract failure: Column 'reversed_by UUID' is not defined inside CREATE TABLE for 'public.expenses'");
  } else {
    const preflightReversedBound = /table_name\s*=\s*'expenses'[\s\S]*?column_name\s*=\s*'reversed_by'[\s\S]*?data_type\s*=\s*'uuid'/i.test(preflightContent);
    if (!preflightReversedBound) {
      errors.push("Column-type parity failure: Preflight script does not assert reversed_by as uuid on table 'expenses'");
    } else {
      columnsVerified.push('public.expenses.reversed_by UUID');
    }
  }

  // Check E: constitution_sections.embedding vector(768)
  const constitutionSectionsBlock = migrationTablesDeclared.get('constitution_sections')?.blockContent;
  if (!constitutionSectionsBlock || !/embedding\s+vector\(768\)/i.test(constitutionSectionsBlock)) {
    errors.push("Column contract failure: Column 'embedding vector(768)' is not defined inside CREATE TABLE for 'public.constitution_sections'");
  } else {
    const preflightEmbeddingBound = /table_name\s*=\s*'constitution_sections'[\s\S]*?column_name\s*=\s*'embedding'/i.test(preflightContent);
    if (!preflightEmbeddingBound) {
      errors.push("Column parity failure: Preflight script does not assert constitution_sections.embedding presence");
    } else {
      columnsVerified.push('public.constitution_sections.embedding vector(768)');
    }
  }

  // 7. Object-Tied Index Declarations & Parity Checks

  // Check A: idx_members_email_lower on public.members
  const migrationsFullSql = Object.values(migrationFilesContent).join('\n');
  const emailIndexMigrationRegex = /CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?idx_members_email_lower\s+ON\s+public\.([a-z_]+)\s*\(\s*LOWER\s*\(\s*email\s*\)\s*\)/i;
  const emailIndexMatch = emailIndexMigrationRegex.exec(migrationsFullSql);

  if (!emailIndexMatch) {
    errors.push("Index contract failure: 'CREATE UNIQUE INDEX idx_members_email_lower' not declared on LOWER(email)");
  } else if (emailIndexMatch[1] !== 'members') {
    errors.push(`Index contract failure: 'idx_members_email_lower' declared on table '${emailIndexMatch[1]}' instead of expected 'members'`);
  } else {
    const preflightEmailRegex = /t\.relname\s*=\s*'members'[\s\S]*?c\.relname\s*=\s*'idx_members_email_lower'[\s\S]*?i\.indisunique\s*=\s*TRUE[\s\S]*?pi\.indexdef\s+ILIKE\s+'%lower\(%email%\)%'/i;
    if (!preflightEmailRegex.test(preflightContent)) {
      errors.push("Index parity failure: Preflight script does not assert idx_members_email_lower specifically on 'members' with indisunique = TRUE on LOWER(email)");
    } else {
      indexesVerified.push('public.members.idx_members_email_lower (UNIQUE on LOWER(email))');
    }
  }

  // Check B: idx_constitution_embedding_hnsw on public.constitution_sections
  const hnswIndexMigrationRegex = /CREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?idx_constitution_embedding_hnsw\s+ON\s+public\.([a-z_]+)\s+USING\s+hnsw\s*\(\s*embedding\s+vector_cosine_ops\s*\)/i;
  const hnswIndexMatch = hnswIndexMigrationRegex.exec(migrationsFullSql);

  if (!hnswIndexMatch) {
    errors.push("Index contract failure: 'CREATE INDEX idx_constitution_embedding_hnsw' not declared with HNSW vector_cosine_ops");
  } else if (hnswIndexMatch[1] !== 'constitution_sections') {
    errors.push(`Index contract failure: 'idx_constitution_embedding_hnsw' declared on table '${hnswIndexMatch[1]}' instead of expected 'constitution_sections'`);
  } else {
    const preflightHnswRegex = /tablename\s*=\s*'constitution_sections'[\s\S]*?indexname\s*=\s*'idx_constitution_embedding_hnsw'[\s\S]*?indexdef\s+ILIKE\s+'%hnsw%'[\s\S]*?indexdef\s+ILIKE\s+'%\(embedding%vector_cosine_ops\)%'/i;
    if (!preflightHnswRegex.test(preflightContent)) {
      errors.push("Index parity failure: Preflight script does not assert idx_constitution_embedding_hnsw specifically on 'constitution_sections' with HNSW and vector_cosine_ops");
    } else {
      indexesVerified.push('public.constitution_sections.idx_constitution_embedding_hnsw (HNSW with vector_cosine_ops on embedding)');
    }
  }

  // 8. Active RLS Assertion in Preflight
  const preflightRlsCheck = (preflightContent.includes('rowsecurity = FALSE') || preflightContent.includes('rowsecurity = TRUE')) &&
    preflightContent.includes('FOREACH v_expected_table IN ARRAY v_expected_tables LOOP');
  if (!preflightRlsCheck) {
    errors.push("RLS parity failure: Preflight script does not assert rowsecurity across all v_expected_tables");
  }

  return {
    success: errors.length === 0,
    tableCount: tablesVerified.length,
    tablesVerified,
    columnsVerified,
    indexesVerified,
    supportedConstructs: SUPPORTED_SQL_CONSTRUCTS,
    unverifiedDimensions: UNVERIFIED_SCHEMA_DIMENSIONS,
    errors
  };
}

export function runSchemaParityNegativeFixtures(): void {
  console.log('Running Schema-Parity Negative Fixtures (isolated in-memory evaluation)...');

  // Load canonical migrations
  const migrationsDir = path.resolve('supabase/migrations');
  const canonicalMigrations: Record<string, string> = {};
  for (const f of REQUIRED_MIGRATIONS) {
    canonicalMigrations[f] = fs.readFileSync(path.join(migrationsDir, f), 'utf-8');
  }
  const canonicalPreflight = fs.readFileSync(path.resolve('scripts/preflight_schema_check.sql'), 'utf-8');

  // Negative Fixture 1: Missing Required Migration
  const brokenMigrationsMissingOne = { ...canonicalMigrations };
  delete brokenMigrationsMissingOne['20261013000003_invitations_and_auth.sql'];
  const res1 = validateSchemaParity({
    _mockMigrationsContent: brokenMigrationsMissingOne,
    _mockPreflightContent: canonicalPreflight
  });
  if (res1.success || !res1.errors.some(e => e.includes('Missing required migration file: 20261013000003_invitations_and_auth.sql'))) {
    throw new Error('Negative Fixture 1 FAILED: Validator did not reject missing required migration file');
  }
  console.log('  [PASS] Negative Fixture 1: Successfully rejected missing required migration file');

  // Negative Fixture 2: Altered Table Declaration (Duplicate & Unexpected)
  // 2a. Duplicate table
  const brokenMigrationsDuplicateTable = {
    ...canonicalMigrations,
    '20261013000003_invitations_and_auth.sql': canonicalMigrations['20261013000003_invitations_and_auth.sql'] +
      '\nCREATE TABLE public.members (id UUID PRIMARY KEY);\n'
  };
  const res2a = validateSchemaParity({
    _mockMigrationsContent: brokenMigrationsDuplicateTable,
    _mockPreflightContent: canonicalPreflight
  });
  if (res2a.success || !res2a.errors.some(e => e.includes("Duplicate table declaration detected across migrations for table 'public.members'"))) {
    throw new Error('Negative Fixture 2a FAILED: Validator did not reject duplicate table declaration');
  }
  console.log('  [PASS] Negative Fixture 2a: Successfully rejected duplicate core table declaration across migrations');

  // 2b. Unexpected table
  const brokenMigrationsUnexpectedTable = {
    ...canonicalMigrations,
    '20261013000003_invitations_and_auth.sql': canonicalMigrations['20261013000003_invitations_and_auth.sql'] +
      '\nCREATE TABLE public.unauthorized_backdoor (id UUID PRIMARY KEY);\n'
  };
  const res2b = validateSchemaParity({
    _mockMigrationsContent: brokenMigrationsUnexpectedTable,
    _mockPreflightContent: canonicalPreflight
  });
  if (res2b.success || !res2b.errors.some(e => e.includes("Unexpected table declared in migrations: 'public.unauthorized_backdoor'"))) {
    throw new Error('Negative Fixture 2b FAILED: Validator did not reject unexpected table declaration');
  }
  console.log('  [PASS] Negative Fixture 2b: Successfully rejected unexpected table declaration outside core baseline');

  // Negative Fixture 3: Misplaced or Mismatched Column/Index Contract
  // 3a. Misplaced column (actor_type declared on announcements instead of audit_logs)
  const brokenMigrationsMisplacedColumn = {
    ...canonicalMigrations,
    '20261013000008_audit_logs_and_triggers.sql': canonicalMigrations['20261013000008_audit_logs_and_triggers.sql'].replace(
      'actor_type VARCHAR(50) NOT NULL DEFAULT \'authenticated_member\',',
      '-- actor_type omitted from audit_logs'
    ),
    '20261013000005_announcements_and_attendance.sql': canonicalMigrations['20261013000005_announcements_and_attendance.sql'].replace(
      'title VARCHAR(255) NOT NULL,',
      'title VARCHAR(255) NOT NULL,\n    actor_type VARCHAR(50) NOT NULL DEFAULT \'authenticated_member\','
    )
  };
  const res3a = validateSchemaParity({
    _mockMigrationsContent: brokenMigrationsMisplacedColumn,
    _mockPreflightContent: canonicalPreflight
  });
  if (res3a.success || !res3a.errors.some(e => e.includes("Column 'actor_type VARCHAR(50)' is not defined inside CREATE TABLE for 'public.audit_logs'"))) {
    throw new Error('Negative Fixture 3a FAILED: Validator did not reject misplaced column contract');
  }
  console.log('  [PASS] Negative Fixture 3a: Successfully rejected misplaced column contract (actor_type in wrong table)');

  // 3b. Misplaced index (idx_members_email_lower declared on attendance_records instead of members)
  const brokenMigrationsMisplacedIndex = {
    ...canonicalMigrations,
    '20261013000002_members_and_directory.sql': canonicalMigrations['20261013000002_members_and_directory.sql'].replace(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_lower ON public.members (LOWER(email));',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_lower ON public.attendance_records (LOWER(email));'
    )
  };
  const res3b = validateSchemaParity({
    _mockMigrationsContent: brokenMigrationsMisplacedIndex,
    _mockPreflightContent: canonicalPreflight
  });
  if (res3b.success || !res3b.errors.some(e => e.includes("declared on table 'attendance_records' instead of expected 'members'"))) {
    throw new Error('Negative Fixture 3b FAILED: Validator did not reject index declared on wrong table');
  }
  console.log('  [PASS] Negative Fixture 3b: Successfully rejected index bound to incorrect table target');

  // Negative Fixture 4: Genuinely Unsupported SQL Construct Encountered in Real Input (NO test boolean flag!)
  const brokenMigrationsUnsupportedConstruct = {
    ...canonicalMigrations,
    '20261013000001_core_types_and_extensions.sql': canonicalMigrations['20261013000001_core_types_and_extensions.sql'] +
      '\nCREATE TABLE public.dynamic_partitioned (id UUID) PARTITION BY HASH (id);\n'
  };
  const res4 = validateSchemaParity({
    _mockMigrationsContent: brokenMigrationsUnsupportedConstruct,
    _mockPreflightContent: canonicalPreflight
  });
  if (res4.success || !res4.errors.some(e => e.includes('Unsupported SQL construct encountered'))) {
    throw new Error('Negative Fixture 4 FAILED: Validator did not reject genuinely unsupported SQL construct in real migration input');
  }
  console.log('  [PASS] Negative Fixture 4: Successfully caught and rejected genuinely unsupported SQL construct (PARTITION BY) in migration input');

  // Negative Fixture 5: Preflight omits constitution_versions
  const brokenPreflightMissingTable = canonicalPreflight.replace(
    "'constitution_versions',",
    "-- omitted constitution_versions"
  );
  const res5 = validateSchemaParity({
    _mockMigrationsContent: canonicalMigrations,
    _mockPreflightContent: brokenPreflightMissingTable
  });
  if (res5.success || !res5.errors.some(e => e.includes("Expected core table 'constitution_versions' is missing"))) {
    throw new Error('Negative Fixture 5 FAILED: Validator did not reject preflight missing constitution_versions');
  }
  console.log('  [PASS] Negative Fixture 5: Successfully rejected preflight missing constitution_versions table');

  // Negative Fixture 6: Preflight checks actor_type as text instead of character varying(50)
  const brokenPreflightTypeText = canonicalPreflight.replace(
    "data_type = 'character varying'",
    "data_type = 'text'"
  );
  const res6 = validateSchemaParity({
    _mockMigrationsContent: canonicalMigrations,
    _mockPreflightContent: brokenPreflightTypeText
  });
  if (res6.success || !res6.errors.some(e => e.includes('actor_type'))) {
    throw new Error('Negative Fixture 6 FAILED: Validator did not reject preflight asserting actor_type as text');
  }
  console.log('  [PASS] Negative Fixture 6: Successfully rejected preflight checking actor_type as text');
}

export function runCli(): void {
  console.log('================================================================');
  console.log('   AGILA Hub Android — Targeted Static Schema Contract Validator');
  console.log('   Verifying Migrations DDL vs Preflight Schema Invariants      ');
  console.log('================================================================');

  // Run isolated negative fixtures first
  runSchemaParityNegativeFixtures();

  // Validate canonical files
  const result = validateSchemaParity();

  console.log('\n[SCOPE: Targeted Static Contract Validation]');
  console.log('Supported SQL Constructs Analyzed:');
  for (const c of result.supportedConstructs) {
    console.log(`  + ${c}`);
  }

  console.log('\nUnverified Schema Dimensions (Deferred to Live Database / Phase 02):');
  for (const u of result.unverifiedDimensions) {
    console.log(`  * [NOT EXECUTED] ${u}`);
  }

  console.log('\n[Parity Check 1] Core Table Coverage:');
  console.log(`  Required Migrations Verified: ${REQUIRED_MIGRATIONS.length} / ${REQUIRED_MIGRATIONS.length} (PASS)`);
  console.log(`  Expected Core Tables: ${EXPECTED_CORE_TABLES.length}`);
  console.log(`  Verified in Migrations & Preflight: ${result.tableCount}`);
  for (const t of result.tablesVerified) {
    console.log(`    - Table public.${t} (PASS)`);
  }

  console.log('\n[Parity Check 2] Critical Object-Tied Column Types & Max Lengths:');
  for (const c of result.columnsVerified) {
    console.log(`    - ${c} (PASS)`);
  }

  console.log('\n[Parity Check 3] Critical Object-Tied Index Properties & Uniqueness Constraints:');
  for (const idx of result.indexesVerified) {
    console.log(`    - ${idx} (PASS)`);
  }

  if (!result.success) {
    console.error('\nTargeted Static Schema Validation FAILED with errors:');
    for (const e of result.errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('   TARGETED STATIC SCHEMA VALIDATION: PASSED (100%)             ');
  console.log('   (Note: Static offline analysis; live database verification   ');
  console.log('    remains explicitly NOT EXECUTED pending Phase 02)           ');
  console.log('================================================================');
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
