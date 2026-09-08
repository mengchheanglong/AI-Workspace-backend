import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../../src/database/database-options';

describe('PostgreSQL foundation migrations', () => {
  let database: DataSource;

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (process.env.NODE_ENV !== 'test' || !url || !new URL(url).pathname.endsWith('_test')) {
      throw new Error(
        'Integration tests require a dedicated _test database. Use pnpm test:integration.',
      );
    }
    database = await new DataSource(databaseOptions(url)).initialize();
  });

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
  });

  it('applies migrations, supports pgvector, and has no pending migrations on replay', async () => {
    await database.runMigrations({ transaction: 'all' });
    const extensions: { extname: string }[] = await database.query(
      "SELECT extname FROM pg_extension WHERE extname = 'vector'",
    );
    expect(extensions).toEqual([{ extname: 'vector' }]);
    const rows: { distance: number }[] = await database.query(
      "SELECT '[1,2,3]'::vector <-> '[1,2,3]'::vector AS distance",
    );
    expect(rows[0]?.distance).toBe(0);
    expect(await database.showMigrations()).toBe(false);
    expect(await database.runMigrations()).toEqual([]);
  });
});
