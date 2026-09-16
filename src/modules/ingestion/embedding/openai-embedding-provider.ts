import { EmbeddingProvider } from './embedding-provider.interface';

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  readonly modelName: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: {
    apiKey: string;
    baseUrl?: string;
    dimensions?: number;
    modelName?: string;
  }) {
    if (!options.apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAiEmbeddingProvider.');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.dimensions = options.dimensions ?? 1536;
    this.modelName = options.modelName ?? 'text-embedding-3-small';
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const batchSize = 100;
    const results: number[][] = new Array(texts.length);

    for (let i = 0; i < texts.length; i += batchSize) {
      const chunk = texts.slice(i, i + batchSize);
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          input: chunk,
          dimensions: this.dimensions,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(
          `OpenAI embedding API failed with HTTP ${res.status}: ${errorText.substring(0, 300)}`,
        );
      }

      const body = (await res.json()) as {
        data: { embedding: number[]; index: number }[];
      };

      for (const item of body.data) {
        const targetIdx = i + item.index;
        results[targetIdx] = item.embedding;
      }
    }

    return results as number[][];
  }
}
