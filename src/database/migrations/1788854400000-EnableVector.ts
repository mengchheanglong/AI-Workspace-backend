import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableVector1788854400000 implements MigrationInterface {
  name = 'EnableVector1788854400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');
  }

  down(): Promise<void> {
    // Shared extension removal could destroy future vector columns. Never automate it.
    return Promise.reject(
      new Error('Vector extension removal requires a reviewed manual migration.'),
    );
  }
}
