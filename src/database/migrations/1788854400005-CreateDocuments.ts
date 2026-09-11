import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocuments1788854400005 implements MigrationInterface {
  name = 'CreateDocuments1788854400005';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── Documents ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "title" varchar(500) NOT NULL,
        "description" text NULL,
        "original_filename" varchar(500) NOT NULL,
        "storage_key" varchar(1000) NOT NULL,
        "mime_type" varchar(255) NOT NULL,
        "size_bytes" bigint NOT NULL,
        "sha256" varchar(64) NOT NULL,
        "revision" integer NOT NULL DEFAULT 1,
        "processing_status" varchar(50) NOT NULL DEFAULT 'PENDING',
        "last_error_code" varchar(100) NULL,
        "created_by" uuid NOT NULL REFERENCES "users"("id"),
        "updated_by" uuid NOT NULL REFERENCES "users"("id"),
        "version" integer NOT NULL DEFAULT 1,
        "deleted_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_documents_project_created"
      ON "documents" ("project_id", "deleted_at", "created_at");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_documents_project_status"
      ON "documents" ("project_id", "deleted_at", "processing_status");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_documents_fulltext"
      ON "documents" USING gin (
        to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("original_filename", ''))
      );
    `);

    // ── Document Revisions ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "document_revisions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
        "revision" integer NOT NULL,
        "original_filename" varchar(500) NOT NULL,
        "storage_key" varchar(1000) NOT NULL,
        "mime_type" varchar(255) NOT NULL,
        "size_bytes" bigint NOT NULL,
        "sha256" varchar(64) NOT NULL,
        "changed_by" uuid NOT NULL REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_document_revisions_doc_rev"
      ON "document_revisions" ("document_id", "revision");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "document_revisions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents";`);
  }
}
