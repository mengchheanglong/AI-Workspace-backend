import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApiKeys1788854400012 implements MigrationInterface {
  name = 'CreateApiKeys1788854400012';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(100) NOT NULL,
        "key_hash" varchar(64) NOT NULL UNIQUE,
        "key_prefix" varchar(16) NOT NULL,
        "last_used_at" timestamptz NULL,
        "expires_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "revoked_at" timestamptz NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_api_keys_key_hash" ON "api_keys" ("key_hash");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_api_keys_user_id_revoked" ON "api_keys" ("user_id", "revoked_at");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys";`);
  }
}
