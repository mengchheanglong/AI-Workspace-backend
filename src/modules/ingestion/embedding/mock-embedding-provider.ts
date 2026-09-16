import { createHash } from 'node:crypto';
import { EmbeddingProvider } from './embedding-provider.interface';

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  readonly modelName: string;

  constructor(dimensions = 1536, modelName = 'mock-embedding-3-small') {
    this.dimensions = dimensions;
    this.modelName = modelName;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.generateDeterministicVector(text));
  }

  private generateDeterministicVector(text: string): number[] {
    const hash = createHash('sha256').update(text).digest();
    let seed = hash.readUInt32LE(0);

    // Mulberry32 32-bit PRNG
    const random = () => {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const vec = new Array<number>(this.dimensions);
    let sumSq = 0;

    for (let i = 0; i < this.dimensions; i++) {
      // Generate values between -1 and 1
      const val = random() * 2 - 1;
      vec[i] = val;
      sumSq += val * val;
    }

    // Normalize to unit vector (L2 norm = 1.0)
    const norm = Math.sqrt(sumSq) || 1.0;
    for (let i = 0; i < this.dimensions; i++) {
      vec[i] = Number(((vec[i] ?? 0) / norm).toFixed(6));
    }

    return vec;
  }
}
