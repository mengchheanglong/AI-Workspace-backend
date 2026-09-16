import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConversationsAndMessages1788854400007 implements MigrationInterface {
  name = 'CreateConversationsAndMessages1788854400007';

  async up(queryRunner: QueryRunner): Promise<void> {
    // AI Conversations
    await queryRunner.query(`
      CREATE TABLE "ai_conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" varchar(200) NOT NULL DEFAULT 'New Conversation',
        "default_mode" varchar(50) NOT NULL DEFAULT 'PM',
        "deleted_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_ai_conversations_user_proj"
      ON "ai_conversations" ("project_id", "user_id", "deleted_at");
    `);

    // AI Messages
    await queryRunner.query(`
      CREATE TABLE "ai_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversation_id" uuid NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
        "role" varchar(20) NOT NULL,
        "mode" varchar(50) NOT NULL,
        "content" text NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'COMPLETED',
        "citations" jsonb NOT NULL DEFAULT '[]',
        "model_name" varchar(100) NULL,
        "prompt_tokens" integer NULL,
        "completion_tokens" integer NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_ai_messages_conv"
      ON "ai_messages" ("conversation_id", "created_at");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_messages";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_conversations";`);
  }
}
