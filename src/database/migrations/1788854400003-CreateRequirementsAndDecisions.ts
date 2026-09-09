import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRequirementsAndDecisions1788854400003 implements MigrationInterface {
  name = 'CreateRequirementsAndDecisions1788854400003';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── Requirements ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "requirements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "number" integer NOT NULL,
        "title" varchar(500) NOT NULL,
        "description" text NULL,
        "acceptance_criteria" text NULL,
        "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
        "priority" varchar(20) NOT NULL DEFAULT 'MEDIUM',
        "source_meeting_id" uuid NULL,
        "created_by" uuid NOT NULL REFERENCES "users"("id"),
        "updated_by" uuid NOT NULL REFERENCES "users"("id"),
        "version" integer NOT NULL DEFAULT 1,
        "deleted_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_requirements_project_number"
      ON "requirements" ("project_id", "number")
      WHERE ("deleted_at" IS NULL);
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_requirements_project_status"
      ON "requirements" ("project_id", "deleted_at", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_requirements_fulltext"
      ON "requirements" USING gin (
        to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", ''))
      );
    `);

    // ── Requirement Revisions ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "requirement_revisions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "requirement_id" uuid NOT NULL REFERENCES "requirements"("id") ON DELETE CASCADE,
        "version" integer NOT NULL,
        "title" varchar(500) NOT NULL,
        "description" text NULL,
        "acceptance_criteria" text NULL,
        "status" varchar(20) NOT NULL,
        "priority" varchar(20) NOT NULL,
        "changed_by" uuid NOT NULL REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_requirement_revisions_unique"
      ON "requirement_revisions" ("requirement_id", "version");
    `);

    // ── Decisions ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "decisions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "number" integer NOT NULL,
        "title" varchar(500) NOT NULL,
        "decision_text" text NOT NULL,
        "rationale" text NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PROPOSED',
        "decided_at" timestamptz NULL,
        "decided_by" uuid NULL REFERENCES "users"("id"),
        "requirement_id" uuid NULL,
        "source_meeting_id" uuid NULL,
        "supersedes_decision_id" uuid NULL REFERENCES "decisions"("id"),
        "created_by" uuid NOT NULL REFERENCES "users"("id"),
        "updated_by" uuid NOT NULL REFERENCES "users"("id"),
        "version" integer NOT NULL DEFAULT 1,
        "deleted_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_decisions_project_number"
      ON "decisions" ("project_id", "number")
      WHERE ("deleted_at" IS NULL);
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_decisions_project_status"
      ON "decisions" ("project_id", "deleted_at", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_decisions_fulltext"
      ON "decisions" USING gin (
        to_tsvector('english', coalesce("title", '') || ' ' || coalesce("decision_text", ''))
      );
    `);

    // ── Decision Revisions ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "decision_revisions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "decision_id" uuid NOT NULL REFERENCES "decisions"("id") ON DELETE CASCADE,
        "version" integer NOT NULL,
        "title" varchar(500) NOT NULL,
        "decision_text" text NOT NULL,
        "rationale" text NULL,
        "status" varchar(20) NOT NULL,
        "changed_by" uuid NOT NULL REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_decision_revisions_unique"
      ON "decision_revisions" ("decision_id", "version");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "decision_revisions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "decisions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "requirement_revisions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "requirements";`);
  }
}
