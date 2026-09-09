import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndSessions1788854400001 implements MigrationInterface {
  name = 'CreateUsersAndSessions1788854400001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL UNIQUE,
        "display_name" varchar(100) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "system_role" varchar(20) NOT NULL DEFAULT 'USER',
        "professional_role" varchar(30) NOT NULL DEFAULT 'DEVELOPER',
        "is_active" boolean NOT NULL DEFAULT true,
        "must_change_password" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_users_email_lower" ON "users" (LOWER("email"));
    `);

    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" varchar(64) NOT NULL UNIQUE,
        "csrf_token_hash" varchar(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_seen_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        "absolute_expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_sessions_user_revoked" ON "sessions" ("user_id", "revoked_at");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_sessions_expiry" ON "sessions" ("expires_at", "absolute_expires_at");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
  }
}
