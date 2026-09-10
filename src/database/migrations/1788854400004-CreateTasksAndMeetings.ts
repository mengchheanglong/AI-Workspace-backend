import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTasksAndMeetings1788854400004 implements MigrationInterface {
  name = 'CreateTasksAndMeetings1788854400004';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── Meetings ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "meetings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "title" varchar(500) NOT NULL,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "agenda" text NULL,
        "notes" text NULL,
        "transcript_text" text NULL,
        "transcript_version" integer NOT NULL DEFAULT 1,
        "summary" text NULL,
        "created_by" uuid NOT NULL REFERENCES "users"("id"),
        "updated_by" uuid NOT NULL REFERENCES "users"("id"),
        "version" integer NOT NULL DEFAULT 1,
        "deleted_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_meetings_project_starts_at"
      ON "meetings" ("project_id", "deleted_at", "starts_at");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_meetings_fulltext"
      ON "meetings" USING gin (
        to_tsvector('english', coalesce("title", '') || ' ' || coalesce("notes", '') || ' ' || coalesce("agenda", ''))
      );
    `);

    // ── Meeting Attendees ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "meeting_attendees" (
        "meeting_id" uuid NOT NULL REFERENCES "meetings"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        PRIMARY KEY ("meeting_id", "user_id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_meeting_attendees_user"
      ON "meeting_attendees" ("user_id");
    `);

    // ── Tasks ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "number" integer NOT NULL,
        "title" varchar(500) NOT NULL,
        "description" text NULL,
        "status" varchar(20) NOT NULL DEFAULT 'TODO',
        "priority" varchar(20) NOT NULL DEFAULT 'MEDIUM',
        "assignee_id" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "due_date" date NULL,
        "requirement_id" uuid NULL REFERENCES "requirements"("id") ON DELETE SET NULL,
        "source_meeting_id" uuid NULL REFERENCES "meetings"("id") ON DELETE SET NULL,
        "created_by" uuid NOT NULL REFERENCES "users"("id"),
        "updated_by" uuid NOT NULL REFERENCES "users"("id"),
        "version" integer NOT NULL DEFAULT 1,
        "deleted_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_tasks_project_number"
      ON "tasks" ("project_id", "number")
      WHERE ("deleted_at" IS NULL);
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tasks_project_status"
      ON "tasks" ("project_id", "deleted_at", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tasks_project_assignee"
      ON "tasks" ("project_id", "deleted_at", "assignee_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tasks_project_due_date"
      ON "tasks" ("project_id", "deleted_at", "due_date");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tasks_project_requirement"
      ON "tasks" ("project_id", "requirement_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tasks_fulltext"
      ON "tasks" USING gin (
        to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", ''))
      );
    `);

    // ── Foreign keys for source_meeting_id on requirements and decisions ─
    await queryRunner.query(`
      ALTER TABLE "requirements"
      ADD CONSTRAINT "fk_requirements_source_meeting"
      FOREIGN KEY ("source_meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "decisions"
      ADD CONSTRAINT "fk_decisions_source_meeting"
      FOREIGN KEY ("source_meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "decisions"
      DROP CONSTRAINT IF EXISTS "fk_decisions_source_meeting";
    `);
    await queryRunner.query(`
      ALTER TABLE "requirements"
      DROP CONSTRAINT IF EXISTS "fk_requirements_source_meeting";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "meeting_attendees";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "meetings";`);
  }
}
