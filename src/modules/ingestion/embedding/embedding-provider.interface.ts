export interface EmbeddingResult {
  embedding: number[];
  tokenCount?: number;
}

export interface EmbeddingProvider {
  readonly dimensions: number;
  readonly modelName: string;
  embed(texts: string[]): Promise<number[][]>;
}
