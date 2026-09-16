import { MockEmbeddingProvider } from '../../src/modules/ingestion/embedding/mock-embedding-provider';

describe('MockEmbeddingProvider', () => {
  const provider = new MockEmbeddingProvider(1536, 'mock-embedding-3-small');

  it('should have dimensions 1536', () => {
    expect(provider.dimensions).toBe(1536);
    expect(provider.modelName).toBe('mock-embedding-3-small');
  });

  it('should generate deterministic embeddings for identical inputs', async () => {
    const text = 'User must confirm AI proposals';
    const [emb1] = await provider.embed([text]);
    const [emb2] = await provider.embed([text]);

    expect(emb1).toBeDefined();
    expect(emb2).toBeDefined();
    expect(emb1).toEqual(emb2);
    expect(emb1!.length).toBe(1536);
  });

  it('should produce different embeddings for different inputs', async () => {
    const [embA, embB] = await provider.embed(['First topic', 'Completely different second topic']);
    expect(embA).toBeDefined();
    expect(embB).toBeDefined();
    expect(embA).not.toEqual(embB);
  });

  it('should produce unit vectors with Euclidean norm approximately 1.0', async () => {
    const [emb] = await provider.embed(['Test vector normalization']);
    expect(emb).toBeDefined();

    const sumSq = emb!.reduce((acc, val) => acc + val * val, 0);
    const norm = Math.sqrt(sumSq);

    // Allowing small floating point rounding tolerance
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });
});
