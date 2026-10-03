import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveMockEmbeddings1790985600000 implements MigrationInterface {
  name = 'RemoveMockEmbeddings1790985600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE knowledge_chunks ALTER COLUMN embedding DROP NOT NULL');
    // Preserve source text and provenance; discard only explicitly synthetic vectors.
    await queryRunner.query(`UPDATE knowledge_chunks SET embedding = NULL,
      embedding_model = 'keyword-only', embedding_dimensions = 0
      WHERE embedding_model LIKE 'mock-%'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const rows: { count: string }[] = await queryRunner.query(
      'SELECT count(*)::text AS count FROM knowledge_chunks WHERE embedding IS NULL',
    );
    if (rows[0]?.count !== '0')
      throw new Error('Reindex keyword-only sources with real embeddings before reverting.');
    await queryRunner.query('ALTER TABLE knowledge_chunks ALTER COLUMN embedding SET NOT NULL');
  }
}
