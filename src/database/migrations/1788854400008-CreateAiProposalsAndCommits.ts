import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiProposalsAndCommits1788854400008 implements MigrationInterface {
  name = 'CreateAiProposalsAndCommits1788854400008';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. AI Proposals table
    await queryRunner.query(`
      CREATE TABLE "ai_proposals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "proposal_type" varchar(50) NOT NULL,
        "source_entity_type" varchar(50) NOT NULL,
        "source_entity_id" uuid NOT NULL,
        "source_revision" integer NOT NULL,
        "draft_json" jsonb NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "expires_at" timestamptz NOT NULL,
        "confirmed_by" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "confirmed_at" timestamptz NULL,
        "result_record_ids" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_ai_proposals_project_user_status"
      ON "ai_proposals" ("project_id", "user_id", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_ai_proposals_source"
      ON "ai_proposals" ("project_id", "source_entity_type", "source_entity_id");
    `);

    // 2. Proposal Commits table (enforces single commit & idempotency)
    await queryRunner.query(`
      CREATE TABLE "proposal_commits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "proposal_id" uuid NOT NULL UNIQUE REFERENCES "ai_proposals"("id") ON DELETE CASCADE,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "idempotency_key" varchar(255) NOT NULL,
        "payload_hash" varchar(64) NOT NULL,
        "result_record_ids" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_proposal_commits_actor_proj_idem"
      ON "proposal_commits" ("actor_id", "project_id", "idempotency_key");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "proposal_commits";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_proposals";`);
  }
}
