import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmbeddingProvider } from '../../ingestion/embedding/embedding-provider.interface';
import { KnowledgeSourceType } from '../../ingestion/entities';

export interface RetrieveParams {
  actorId: string;
  projectId: string;
  query: string;
  filters?: {
    sourceType?: KnowledgeSourceType;
  };
  limit?: number;
  mode?: 'hybrid' | 'semantic' | 'keyword';
}

export interface RetrievedEvidence {
  chunkId: string;
  sourceId: string;
  sourceType: KnowledgeSourceType;
  title: string;
  revision: number;
  locator: string;
  snippet: string;
  score: number;
}

interface RawChunkQueryResult {
  id: string;
  knowledge_source_id: string;
  text: string;
  metadata: Record<string, unknown> | null;
  token_count: number;
  chunk_index: number;
  source_type: KnowledgeSourceType;
  source_id: string;
  title: string;
  source_revision: number;
  score_signal?: number;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private embeddingProvider?: EmbeddingProvider;

  constructor(private readonly dataSource: DataSource) {}

  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  async retrieve(params: RetrieveParams): Promise<RetrievedEvidence[]> {
    const { projectId, query, filters, limit = 8, mode = 'hybrid' } = params;

    if (!query || !query.trim()) {
      return [];
    }

    const trimmedQuery = query.trim();

    if (mode === 'keyword') {
      return this.retrieveKeyword(projectId, trimmedQuery, filters?.sourceType, limit);
    }

    if (mode === 'semantic') {
      return this.retrieveSemantic(projectId, trimmedQuery, filters?.sourceType, limit);
    }

    // Hybrid mode (Dense Vector + Sparse Keyword via Reciprocal Rank Fusion)
    return this.retrieveHybrid(projectId, trimmedQuery, filters?.sourceType, limit);
  }

  private async retrieveSemantic(
    projectId: string,
    query: string,
    sourceType?: KnowledgeSourceType,
    limit = 8,
  ): Promise<RetrievedEvidence[]> {
    if (!this.embeddingProvider) {
      this.logger.warn(
        'No embedding provider configured for semantic search; falling back to keyword.',
      );
      return this.retrieveKeyword(projectId, query, sourceType, limit);
    }

    const [queryVec] = await this.embeddingProvider.embed([query]);
    if (!queryVec) return [];

    const vectorParam = `[${queryVec.join(',')}]`;

    const raw = await this.dataSource.query<RawChunkQueryResult[]>(
      `
      SELECT 
        c.id,
        c.knowledge_source_id,
        c.text,
        c.metadata,
        c.token_count,
        c.chunk_index,
        s.source_type,
        s.source_id,
        s.title,
        s.source_revision,
        (1 - (c.embedding <=> $1::vector)) AS score_signal
      FROM knowledge_chunks c
      INNER JOIN knowledge_sources s ON s.id = c.knowledge_source_id
      WHERE s.project_id = $2
        AND s.status = 'INDEXED'
        AND s.deleted_at IS NULL
        AND c.index_version = s.active_index_version
        AND ($3::varchar IS NULL OR s.source_type = $3)
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $4;
      `,
      [vectorParam, projectId, sourceType ?? null, limit],
    );

    return raw.map((row) => this.mapToEvidence(row, row.score_signal ?? 0));
  }

  private async retrieveKeyword(
    projectId: string,
    query: string,
    sourceType?: KnowledgeSourceType,
    limit = 8,
  ): Promise<RetrievedEvidence[]> {
    const raw = await this.dataSource.query<RawChunkQueryResult[]>(
      `
      SELECT 
        c.id,
        c.knowledge_source_id,
        c.text,
        c.metadata,
        c.token_count,
        c.chunk_index,
        s.source_type,
        s.source_id,
        s.title,
        s.source_revision,
        ts_rank_cd(to_tsvector('english', c.text), plainto_tsquery('english', $1)) AS score_signal
      FROM knowledge_chunks c
      INNER JOIN knowledge_sources s ON s.id = c.knowledge_source_id
      WHERE s.project_id = $2
        AND s.status = 'INDEXED'
        AND s.deleted_at IS NULL
        AND c.index_version = s.active_index_version
        AND ($3::varchar IS NULL OR s.source_type = $3)
        AND (
          to_tsvector('english', c.text) @@ plainto_tsquery('english', $1)
          OR c.text ILIKE $4
          OR s.title ILIKE $4
        )
      ORDER BY score_signal DESC, c.id ASC
      LIMIT $5;
      `,
      [query, projectId, sourceType ?? null, `%${query}%`, limit],
    );

    return raw.map((row) => this.mapToEvidence(row, row.score_signal ?? 0));
  }

  private async retrieveHybrid(
    projectId: string,
    query: string,
    sourceType?: KnowledgeSourceType,
    limit = 8,
  ): Promise<RetrievedEvidence[]> {
    const candidateLimit = Math.max(limit * 2, 20);

    const [semanticCandidates, keywordCandidates] = await Promise.all([
      this.retrieveSemantic(projectId, query, sourceType, candidateLimit),
      this.retrieveKeyword(projectId, query, sourceType, candidateLimit),
    ]);

    // Reciprocal Rank Fusion (RRF) with k = 60
    const k = 60;
    const scoreMap = new Map<string, { evidence: RetrievedEvidence; rrfScore: number }>();

    semanticCandidates.forEach((item, index) => {
      const rank = index + 1;
      const score = 1 / (k + rank);
      scoreMap.set(item.chunkId, {
        evidence: item,
        rrfScore: score,
      });
    });

    keywordCandidates.forEach((item, index) => {
      const rank = index + 1;
      const score = 1 / (k + rank);
      const existing = scoreMap.get(item.chunkId);
      if (existing) {
        existing.rrfScore += score;
      } else {
        scoreMap.set(item.chunkId, {
          evidence: item,
          rrfScore: score,
        });
      }
    });

    const ranked = Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, limit)
      .map(({ evidence, rrfScore }) => ({
        ...evidence,
        score: Number(rrfScore.toFixed(6)),
      }));

    return ranked;
  }

  private mapToEvidence(row: RawChunkQueryResult, score: number): RetrievedEvidence {
    let locator = `Chunk #${row.chunk_index + 1}`;
    if (row.metadata) {
      const meta = row.metadata;
      if (Array.isArray(meta.headingBreadcrumbs) && meta.headingBreadcrumbs.length > 0) {
        locator = meta.headingBreadcrumbs.join(' > ');
      } else if (meta.pageNumber) {
        locator = `Page ${meta.pageNumber}`;
      } else if (typeof meta.section === 'string') {
        locator = meta.section;
      }
    }

    // Build snippet: first 250 characters of chunk
    const snippet = row.text.length > 250 ? `${row.text.substring(0, 247)}...` : row.text;

    return {
      chunkId: row.id,
      sourceId: row.source_id,
      sourceType: row.source_type,
      title: row.title,
      revision: row.source_revision,
      locator,
      snippet,
      score: Number(score.toFixed(6)),
    };
  }
}
