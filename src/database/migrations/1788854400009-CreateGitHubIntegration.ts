import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGitHubIntegration1788854400009 implements MigrationInterface {
  name = 'CreateGitHubIntegration1788854400009';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. GitHub Connections table (single active connection per project)
    await queryRunner.query(`
      CREATE TABLE "github_connections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL UNIQUE REFERENCES "projects"("id") ON DELETE CASCADE,
        "repository_owner" varchar(100) NOT NULL,
        "repository_name" varchar(100) NOT NULL,
        "repository_id" varchar(100) NULL,
        "installation_id" varchar(100) NULL,
        "status" varchar(50) NOT NULL DEFAULT 'CONNECTED',
        "last_synced_at" timestamptz NULL,
        "error_summary" text NULL,
        "sync_cursor" varchar(100) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_github_connections_project_status"
      ON "github_connections" ("project_id", "status");
    `);

    // 2. GitHub Issues table
    await queryRunner.query(`
      CREATE TABLE "github_issues" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "connection_id" uuid NOT NULL REFERENCES "github_connections"("id") ON DELETE CASCADE,
        "github_issue_id" varchar(100) NOT NULL,
        "issue_number" integer NOT NULL,
        "title" varchar(500) NOT NULL,
        "body" text NULL,
        "state" varchar(50) NOT NULL DEFAULT 'open',
        "html_url" varchar(1000) NOT NULL,
        "author_login" varchar(100) NULL,
        "labels" jsonb NOT NULL DEFAULT '[]',
        "github_created_at" timestamptz NOT NULL,
        "github_updated_at" timestamptz NOT NULL,
        "synced_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_github_issues_connection_number"
      ON "github_issues" ("connection_id", "issue_number");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_github_issues_project_state"
      ON "github_issues" ("project_id", "state");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_github_issues_project_updated"
      ON "github_issues" ("project_id", "github_updated_at");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "github_issues";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "github_connections";`);
  }
}
