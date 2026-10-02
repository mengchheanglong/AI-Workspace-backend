import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkspaceInvitations1788854400011 implements MigrationInterface {
  name = 'CreateWorkspaceInvitations1788854400011';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "workspace_invitations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL,
        "system_role" varchar(20) NOT NULL DEFAULT 'USER',
        "professional_role" varchar(30) NOT NULL DEFAULT 'DEVELOPER',
        "token" varchar(64) NOT NULL UNIQUE,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "invited_by_id" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "accepted_at" timestamptz NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_workspace_invitations_token" ON "workspace_invitations" ("token");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_workspace_invitations_email_status" ON "workspace_invitations" ("email", "status");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_invitations";`);
  }
}
