import 'reflect-metadata';
import AppDataSource from '../src/database/data-source';

async function runBackupRestoreSmoke() {
  console.log('--- Starting Phase 1 Backup & Restore Smoke Test ---');
  await AppDataSource.initialize();

  try {
    const queryRunner = AppDataSource.createQueryRunner();

    // 1. Inspect table list
    console.log('1. Verifying database table schema integrity...');
    const tables: Array<{ tablename: string }> = await queryRunner.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
    `);

    const tableNames = tables.map((t) => t.tablename);
    console.log(`Found ${tableNames.length} tables:`, tableNames.join(', '));

    const expectedTables = [
      'users',
      'sessions',
      'projects',
      'project_members',
      'requirements',
      'requirement_revisions',
      'decisions',
      'decision_revisions',
      'tasks',
      'meetings',
      'meeting_attendees',
      'documents',
      'document_revisions',
      'audit_logs',
      'migrations',
    ];

    for (const expected of expectedTables) {
      if (!tableNames.includes(expected)) {
        throw new Error(`Missing required table: ${expected}`);
      }
    }
    console.log('All expected domain tables present.');

    // 2. Query record counts across all core tables
    console.log('2. Auditing database record counts...');
    const counts: Record<string, number> = {};
    for (const table of expectedTables) {
      const result = await queryRunner.query(`SELECT COUNT(*)::int as cnt FROM "${table}"`);
      counts[table] = result[0]?.cnt ?? 0;
    }
    console.log('Table record counts:', JSON.stringify(counts, null, 2));

    // 3. Verify pgvector extension
    console.log('3. Verifying pgvector extension status...');
    const vectorExt = await queryRunner.query(
      `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';`,
    );
    if (vectorExt.length === 0) {
      throw new Error('pgvector extension is not installed!');
    }
    console.log(`pgvector version ${vectorExt[0].extversion} active.`);

    // 4. Verify GIN fulltext indexes
    console.log('4. Verifying GIN full-text indexes...');
    const ginIndexes = await queryRunner.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexdef LIKE '%gin%'
      ORDER BY tablename;
    `);
    console.log(
      `Found ${ginIndexes.length} GIN full-text indexes:`,
      ginIndexes.map((i: { indexname: string }) => i.indexname).join(', '),
    );

    if (ginIndexes.length < 5) {
      throw new Error('Expected at least 5 full-text GIN indexes across domain entities.');
    }

    console.log('--- Backup & Restore Smoke Test Passed! ---');
  } finally {
    await AppDataSource.destroy();
  }
}

runBackupRestoreSmoke().catch((err) => {
  console.error('Backup & restore smoke test failed:', err);
  process.exit(1);
});
