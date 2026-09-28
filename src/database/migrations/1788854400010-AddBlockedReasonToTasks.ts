import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlockedReasonToTasks1788854400010 implements MigrationInterface {
  name = 'AddBlockedReasonToTasks1788854400010';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "blocked_reason" varchar(500) NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "blocked_reason";
    `);
  }
}
