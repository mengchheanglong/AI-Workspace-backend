import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectsAndMembers1788854400002 implements MigrationInterface {
  name = 'CreateProjectsAndMembers1788854400002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" varchar(10) NOT NULL UNIQUE,
        "name" varchar(100) NOT NULL,
        "description" text NULL,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "created_by" uuid NOT NULL REFERENCES "users"("id"),
        "version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_projects_key" ON "projects" ("key");
    `);

    await queryRunner.query(`
      CREATE TABLE "project_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "access_role" varchar(20) NOT NULL,
        "joined_at" timestamptz NOT NULL DEFAULT now(),
        "removed_at" timestamptz NULL
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_project_members_active_user" 
      ON "project_members" ("project_id", "user_id") 
      WHERE ("removed_at" IS NULL);
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_project_members_single_owner" 
      ON "project_members" ("project_id") 
      WHERE ("access_role" = 'OWNER' AND "removed_at" IS NULL);
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_project_members_user_active" 
      ON "project_members" ("user_id", "removed_at");
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NULL REFERENCES "projects"("id") ON DELETE SET NULL,
        "actor_id" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "action" varchar(100) NOT NULL,
        "entity_type" varchar(50) NOT NULL,
        "entity_id" uuid NULL,
        "metadata" jsonb NULL,
        "request_id" varchar(36) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_project_created" 
      ON "audit_logs" ("project_id", "created_at");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_members";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects";`);
  }
}
