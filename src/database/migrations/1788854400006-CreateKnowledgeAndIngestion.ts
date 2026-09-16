import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeAndIngestion1788854400006 implements MigrationInterface {
  name = 'CreateKnowledgeAndIngestion1788854400006';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Knowledge Sources
    await queryRunner.query(`
      CREATE TABLE "knowledge_sources" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "source_type" varchar(50) NOT NULL,
        "source_id" uuid NOT NULL,
        "source_revision" integer NOT NULL DEFAULT 1,
        "title" varchar(500) NOT NULL,
        "content_hash" varchar(64) NULL,
        "active_index_version" integer NOT NULL DEFAULT 0,
        "status" varchar(50) NOT NULL DEFAULT 'QUEUED',
        "last_error_code" varchar(100) NULL,
        "deleted_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_knowledge_sources_unique_source"
      ON "knowledge_sources" ("project_id", "source_type", "source_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_knowledge_sources_project_status"
      ON "knowledge_sources" ("project_id", "deleted_at", "status");
    `);

    // Knowledge Chunks (pgvector 1536)
    await queryRunner.query(`
      CREATE TABLE "knowledge_chunks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "knowledge_source_id" uuid NOT NULL REFERENCES "knowledge_sources"("id") ON DELETE CASCADE,
        "index_version" integer NOT NULL,
        "chunk_index" integer NOT NULL,
        "text" text NOT NULL,
        "token_count" integer NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "embedding_model" varchar(100) NOT NULL DEFAULT 'text-embedding-3-small',
        "embedding_dimensions" integer NOT NULL DEFAULT 1536,
        "embedding" vector(1536) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_knowledge_chunks_lookup"
      ON "knowledge_chunks" ("project_id", "knowledge_source_id", "index_version");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_knowledge_chunks_active"
      ON "knowledge_chunks" ("project_id", "index_version");
    `);

    // Outbox Events
    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "event_type" varchar(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "dedupe_key" varchar(255) NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "dispatched_at" timestamptz NULL,
        "last_error" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_outbox_events_undispatched"
      ON "outbox_events" ("dispatched_at", "created_at")
      WHERE "dispatched_at" IS NULL;
    `);

    // Processing Jobs
    await queryRunner.query(`
      CREATE TABLE "processing_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "requested_by" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "job_type" varchar(50) NOT NULL,
        "source_type" varchar(50) NOT NULL,
        "source_id" uuid NOT NULL,
        "source_revision" integer NOT NULL DEFAULT 1,
        "status" varchar(50) NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "progress" integer NOT NULL DEFAULT 0,
        "safe_failure_reason" text NULL,
        "started_at" timestamptz NULL,
        "completed_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_processing_jobs_project_status"
      ON "processing_jobs" ("project_id", "status");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "processing_jobs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_events";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_chunks";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_sources";`);
  }
}
