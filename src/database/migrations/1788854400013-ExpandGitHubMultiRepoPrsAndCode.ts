import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandGitHubMultiRepoPrsAndCode1788854400013 implements MigrationInterface {
  name = 'ExpandGitHubMultiRepoPrsAndCode1788854400013';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop 1:1 unique constraint on github_connections(project_id) to allow multiple repositories per project
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'github_connections_project_id_key'
        ) THEN
          ALTER TABLE "github_connections" DROP CONSTRAINT "github_connections_project_id_key";
        END IF;
      END $$;
    `);

    // Add composite unique index for (project_id, repository_owner, repository_name)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_github_connections_project_repo"
      ON "github_connections" ("project_id", "repository_owner", "repository_name");
    `);

    // 2. Create github_pull_requests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "github_pull_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "connection_id" uuid NOT NULL REFERENCES "github_connections"("id") ON DELETE CASCADE,
        "github_pr_id" varchar(100) NOT NULL,
        "pr_number" integer NOT NULL,
        "title" varchar(500) NOT NULL,
        "body" text NULL,
        "state" varchar(50) NOT NULL DEFAULT 'open',
        "html_url" varchar(1000) NOT NULL,
        "author_login" varchar(100) NULL,
        "base_branch" varchar(200) NULL,
        "head_branch" varchar(200) NULL,
        "is_merged" boolean NOT NULL DEFAULT false,
        "merged_at" timestamptz NULL,
        "labels" jsonb NOT NULL DEFAULT '[]',
        "github_created_at" timestamptz NOT NULL,
        "github_updated_at" timestamptz NOT NULL,
        "synced_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_github_prs_connection_number"
      ON "github_pull_requests" ("connection_id", "pr_number");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_github_prs_project_state"
      ON "github_pull_requests" ("project_id", "state");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_github_prs_project_updated"
      ON "github_pull_requests" ("project_id", "github_updated_at");
    `);

    // 3. Create github_repo_files table for repository codebase indexing
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "github_repo_files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "connection_id" uuid NOT NULL REFERENCES "github_connections"("id") ON DELETE CASCADE,
        "path" varchar(1000) NOT NULL,
        "file_name" varchar(255) NOT NULL,
        "extension" varchar(50) NOT NULL,
        "size" integer NOT NULL DEFAULT 0,
        "sha" varchar(100) NOT NULL,
        "html_url" varchar(1000) NOT NULL,
        "synced_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_github_repo_files_conn_path"
      ON "github_repo_files" ("connection_id", "path");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_github_repo_files_project"
      ON "github_repo_files" ("project_id");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "github_repo_files";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "github_pull_requests";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_github_connections_project_repo";`);
  }
}
