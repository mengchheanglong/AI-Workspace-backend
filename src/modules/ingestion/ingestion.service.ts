import { Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DataSource, IsNull, LessThan, Repository } from 'typeorm';
import { STORAGE_DRIVER, StorageDriver } from '../storage/storage.interface';
import { SemanticChunker } from './chunker/semantic-chunker';
import { ListKnowledgeSourcesDto } from './dto/list-sources.dto';
import { EmbeddingProvider, MockEmbeddingProvider, OpenAiEmbeddingProvider } from './embedding';
import {
  KnowledgeChunk,
  KnowledgeSource,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
  OutboxEvent,
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingJobType,
} from './entities';
import {
  DocxExtractor,
  EntityExtractor,
  ExtractedDocument,
  PdfExtractor,
  PlainTextExtractor,
} from './extractors';
import { OutboxService } from './outbox.service';

export interface DocumentPayload {
  documentId: string;
  revision?: number;
  title: string;
  storageKey?: string;
  mimeType?: string;
  originalFilename?: string;
}

export interface RequirementPayload {
  requirementId: string;
  revision?: number;
  title: string;
  type?: string;
  priority?: string;
  status?: string;
  description?: string | null;
  acceptanceCriteria?: string | null;
  rationale?: string | null;
}

export interface DecisionPayload {
  decisionId: string;
  revision?: number;
  title: string;
  status?: string;
  category?: string;
  context?: string | null;
  decision?: string | null;
  consequences?: string | null;
}

export interface TaskPayload {
  taskId: string;
  revision?: number;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | Date | null;
}

export interface MeetingPayload {
  meetingId: string;
  revision?: number;
  title: string;
  status?: string;
  scheduledAt?: string | Date | null;
  agenda?: string | null;
  notes?: string | null;
  actionItems?: unknown[] | null;
}

@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly logger = new Logger(IngestionService.name);
  private readonly plainTextExtractor = new PlainTextExtractor();
  private readonly pdfExtractor = new PdfExtractor();
  private readonly docxExtractor = new DocxExtractor();
  private readonly entityExtractor = new EntityExtractor();
  private readonly chunker: SemanticChunker;
  private embeddingProvider: EmbeddingProvider;

  constructor(
    @InjectRepository(KnowledgeSource)
    private readonly sourceRepo: Repository<KnowledgeSource>,
    @InjectRepository(KnowledgeChunk)
    private readonly chunkRepo: Repository<KnowledgeChunk>,
    @InjectRepository(ProcessingJob)
    private readonly jobRepo: Repository<ProcessingJob>,
    @Inject(STORAGE_DRIVER)
    private readonly storageDriver: StorageDriver,
    private readonly outboxService: OutboxService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.chunker = new SemanticChunker({
      targetTokens: 600,
      overlapTokens: 100,
      approxCharsPerToken: 4,
    });

    const providerType = this.configService.get<string>('AI_EMBEDDING_PROVIDER') ?? 'mock';
    const openAiApiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (providerType === 'openai' && openAiApiKey) {
      this.embeddingProvider = new OpenAiEmbeddingProvider({
        apiKey: openAiApiKey,
        baseUrl: this.configService.get<string>('OPENAI_EMBEDDING_BASE_URL'),
        dimensions: this.configService.get<number>('AI_EMBEDDING_DIMENSIONS') ?? 1536,
        modelName: this.configService.get<string>('AI_EMBEDDING_MODEL') ?? 'text-embedding-3-small',
      });
      this.logger.log('IngestionService using OpenAiEmbeddingProvider');
    } else {
      this.embeddingProvider = new MockEmbeddingProvider(1536, 'mock-embedding-3-small');
      this.logger.log('IngestionService using deterministic MockEmbeddingProvider');
    }
  }

  onModuleInit(): void {
    this.outboxService.setEventHandler(this.handleOutboxEvent.bind(this));
  }

  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  getEmbeddingProvider(): EmbeddingProvider {
    return this.embeddingProvider;
  }

  async handleOutboxEvent(event: OutboxEvent): Promise<void> {
    const { eventType, projectId, payload } = event;

    switch (eventType) {
      case 'DOCUMENT_CREATED':
      case 'DOCUMENT_UPDATED':
        await this.syncDocument(projectId, payload as unknown as DocumentPayload);
        break;
      case 'DOCUMENT_DELETED':
        await this.deleteSource(
          projectId,
          KnowledgeSourceType.DOCUMENT,
          (payload as unknown as { documentId: string }).documentId,
        );
        break;

      case 'REQUIREMENT_CREATED':
      case 'REQUIREMENT_UPDATED':
        await this.syncRequirement(projectId, payload as unknown as RequirementPayload);
        break;
      case 'REQUIREMENT_DELETED':
        await this.deleteSource(
          projectId,
          KnowledgeSourceType.REQUIREMENT,
          (payload as unknown as { requirementId: string }).requirementId,
        );
        break;

      case 'DECISION_CREATED':
      case 'DECISION_UPDATED':
        await this.syncDecision(projectId, payload as unknown as DecisionPayload);
        break;
      case 'DECISION_DELETED':
        await this.deleteSource(
          projectId,
          KnowledgeSourceType.DECISION,
          (payload as unknown as { decisionId: string }).decisionId,
        );
        break;

      case 'TASK_CREATED':
      case 'TASK_UPDATED':
        await this.syncTask(projectId, payload as unknown as TaskPayload);
        break;
      case 'TASK_DELETED':
        await this.deleteSource(
          projectId,
          KnowledgeSourceType.TASK,
          (payload as unknown as { taskId: string }).taskId,
        );
        break;

      case 'MEETING_CREATED':
      case 'MEETING_UPDATED':
        await this.syncMeeting(projectId, payload as unknown as MeetingPayload);
        break;
      case 'MEETING_DELETED':
        await this.deleteSource(
          projectId,
          KnowledgeSourceType.MEETING,
          (payload as unknown as { meetingId: string }).meetingId,
        );
        break;

      default:
        this.logger.debug(`Ignoring unhandled outbox event type: ${eventType}`);
    }
  }

  async syncDocument(projectId: string, payload: DocumentPayload): Promise<KnowledgeSource | null> {
    if (!payload.storageKey || !payload.mimeType) {
      this.logger.warn(`Missing storageKey or mimeType for document ${payload.documentId}`);
      return null;
    }

    let buffer: Buffer;
    try {
      const filePath = this.storageDriver.getAbsolutePath(payload.storageKey);
      buffer = await readFile(filePath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to read document file for ${payload.documentId}: ${message}`);
      return null;
    }

    let extractedDoc: ExtractedDocument;
    try {
      if (this.pdfExtractor.supports(payload.mimeType, payload.originalFilename)) {
        extractedDoc = await this.pdfExtractor.extract(
          buffer,
          payload.mimeType,
          payload.originalFilename,
        );
      } else if (this.docxExtractor.supports(payload.mimeType, payload.originalFilename)) {
        extractedDoc = await this.docxExtractor.extract(
          buffer,
          payload.mimeType,
          payload.originalFilename,
        );
      } else if (this.plainTextExtractor.supports(payload.mimeType, payload.originalFilename)) {
        extractedDoc = await this.plainTextExtractor.extract(
          buffer,
          payload.mimeType,
          payload.originalFilename,
        );
      } else {
        this.logger.warn(
          `Unsupported mimeType ${payload.mimeType} for document ${payload.documentId}`,
        );
        return null;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to extract text from document ${payload.documentId}: ${message}`);
      return null;
    }

    return this.processKnowledgeSource({
      projectId,
      sourceType: KnowledgeSourceType.DOCUMENT,
      sourceId: payload.documentId,
      sourceRevision: payload.revision ?? 1,
      title: payload.title,
      extractedDoc,
    });
  }

  async syncRequirement(
    projectId: string,
    payload: RequirementPayload,
  ): Promise<KnowledgeSource | null> {
    const extractedDoc = this.entityExtractor.extractRequirement({
      id: payload.requirementId,
      title: payload.title,
      type: payload.type,
      priority: payload.priority,
      status: payload.status,
      description: payload.description,
      acceptanceCriteria: payload.acceptanceCriteria,
      rationale: payload.rationale,
    });

    return this.processKnowledgeSource({
      projectId,
      sourceType: KnowledgeSourceType.REQUIREMENT,
      sourceId: payload.requirementId,
      sourceRevision: payload.revision ?? 1,
      title: payload.title,
      extractedDoc,
    });
  }

  async syncDecision(projectId: string, payload: DecisionPayload): Promise<KnowledgeSource | null> {
    const extractedDoc = this.entityExtractor.extractDecision({
      id: payload.decisionId,
      title: payload.title,
      status: payload.status,
      category: payload.category,
      context: payload.context,
      decision: payload.decision,
      consequences: payload.consequences,
    });

    return this.processKnowledgeSource({
      projectId,
      sourceType: KnowledgeSourceType.DECISION,
      sourceId: payload.decisionId,
      sourceRevision: payload.revision ?? 1,
      title: payload.title,
      extractedDoc,
    });
  }

  async syncTask(projectId: string, payload: TaskPayload): Promise<KnowledgeSource | null> {
    const extractedDoc = this.entityExtractor.extractTask({
      id: payload.taskId,
      title: payload.title,
      description: payload.description,
      status: payload.status,
      priority: payload.priority,
      dueDate: payload.dueDate,
    });

    return this.processKnowledgeSource({
      projectId,
      sourceType: KnowledgeSourceType.TASK,
      sourceId: payload.taskId,
      sourceRevision: payload.revision ?? 1,
      title: payload.title,
      extractedDoc,
    });
  }

  async syncMeeting(projectId: string, payload: MeetingPayload): Promise<KnowledgeSource | null> {
    const extractedDoc = this.entityExtractor.extractMeeting({
      id: payload.meetingId,
      title: payload.title,
      status: payload.status,
      scheduledAt: payload.scheduledAt,
      agenda: payload.agenda,
      notes: payload.notes,
      actionItems: payload.actionItems,
    });

    return this.processKnowledgeSource({
      projectId,
      sourceType: KnowledgeSourceType.MEETING,
      sourceId: payload.meetingId,
      sourceRevision: payload.revision ?? 1,
      title: payload.title,
      extractedDoc,
    });
  }

  private async processKnowledgeSource(params: {
    projectId: string;
    sourceType: KnowledgeSourceType;
    sourceId: string;
    sourceRevision: number;
    title: string;
    extractedDoc: ExtractedDocument;
  }): Promise<KnowledgeSource | null> {
    const { projectId, sourceType, sourceId, sourceRevision, title, extractedDoc } = params;

    let source = await this.sourceRepo.findOne({
      where: { projectId, sourceType, sourceId },
    });

    if (!source) {
      source = this.sourceRepo.create({
        projectId,
        sourceType,
        sourceId,
        sourceRevision,
        title,
        status: KnowledgeSourceStatus.QUEUED,
        activeIndexVersion: 0,
        contentHash: null,
      });
      source = await this.sourceRepo.save(source);
    }

    if (source.deletedAt) {
      this.logger.debug(`Source ${sourceId} is deleted. Skipping indexing.`);
      return null;
    }

    if (sourceRevision < source.sourceRevision) {
      this.logger.debug(
        `Source revision ${sourceRevision} is older than current ${source.sourceRevision}. Skipping.`,
      );
      return source;
    }

    // Hash check for idempotency
    const contentHash = createHash('sha256').update(extractedDoc.text).digest('hex');
    if (
      source.contentHash === contentHash &&
      source.status === KnowledgeSourceStatus.INDEXED &&
      source.activeIndexVersion > 0
    ) {
      source.title = title;
      source.sourceRevision = sourceRevision;
      return this.sourceRepo.save(source);
    }

    source.status = KnowledgeSourceStatus.PROCESSING;
    source.title = title;
    source.sourceRevision = sourceRevision;
    await this.sourceRepo.save(source);

    try {
      const chunks = this.chunker.chunk(extractedDoc);

      if (chunks.length === 0) {
        source.contentHash = contentHash;
        source.status = KnowledgeSourceStatus.INDEXED;
        source.lastErrorCode = null;
        return await this.sourceRepo.save(source);
      }

      // Generate embeddings
      const texts = chunks.map((c) => c.text);
      const embeddings = await this.embeddingProvider.embed(texts);

      // Atomic activation in transaction
      return await this.dataSource.transaction(async (tx) => {
        const freshSource = await tx.findOne(KnowledgeSource, {
          where: { id: source.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!freshSource || freshSource.deletedAt || sourceRevision < freshSource.sourceRevision) {
          return null;
        }

        const nextIndexVersion = freshSource.activeIndexVersion + 1;

        const chunkEntities = chunks.map((c, idx) =>
          tx.create(KnowledgeChunk, {
            projectId,
            knowledgeSourceId: freshSource.id,
            indexVersion: nextIndexVersion,
            chunkIndex: c.chunkIndex,
            text: c.text,
            tokenCount: c.tokenCount,
            metadata: c.metadata,
            embeddingModel: this.embeddingProvider.modelName,
            embeddingDimensions: this.embeddingProvider.dimensions,
            embedding: embeddings[idx] ?? [],
          }),
        );

        await tx.save(KnowledgeChunk, chunkEntities);

        freshSource.activeIndexVersion = nextIndexVersion;
        freshSource.contentHash = contentHash;
        freshSource.status = KnowledgeSourceStatus.INDEXED;
        freshSource.lastErrorCode = null;
        const savedSource = await tx.save(KnowledgeSource, freshSource);

        // Garbage collect old inactive chunks
        await tx.delete(KnowledgeChunk, {
          knowledgeSourceId: freshSource.id,
          indexVersion: LessThan(nextIndexVersion),
        });

        return savedSource;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to index knowledge source ${source.id} (${sourceType}:${sourceId}): ${message}`,
      );
      source.status = KnowledgeSourceStatus.FAILED;
      source.lastErrorCode = message;
      await this.sourceRepo.save(source);
      throw err;
    }
  }

  async deleteSource(
    projectId: string,
    sourceType: KnowledgeSourceType,
    sourceId: string,
  ): Promise<void> {
    const source = await this.sourceRepo.findOne({
      where: { projectId, sourceType, sourceId },
    });

    if (!source) return;

    await this.dataSource.transaction(async (tx) => {
      source.deletedAt = new Date();
      source.status = KnowledgeSourceStatus.QUEUED;
      await tx.save(KnowledgeSource, source);

      // Delete chunks immediately so deleted content disappears from search & AI context
      await tx.delete(KnowledgeChunk, {
        knowledgeSourceId: source.id,
      });
    });
  }

  async listSources(
    projectId: string,
    query: ListKnowledgeSourcesDto,
  ): Promise<(KnowledgeSource & { chunkCount: number })[]> {
    const qb = this.sourceRepo
      .createQueryBuilder('source')
      .where('source.project_id = :projectId', { projectId })
      .andWhere('source.deleted_at IS NULL');

    if (query.sourceType) {
      qb.andWhere('source.source_type = :sourceType', { sourceType: query.sourceType });
    }

    if (query.status) {
      qb.andWhere('source.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('source.title ILIKE :search', { search: `%${query.search}%` });
    }

    qb.orderBy('source.updated_at', 'DESC');

    const sources = await qb.getMany();

    // Query chunk counts for active index versions
    const sourceIds = sources.map((s) => s.id);
    const chunkCountsMap = new Map<string, number>();

    if (sourceIds.length > 0) {
      const counts = await this.chunkRepo
        .createQueryBuilder('chunk')
        .select('chunk.knowledge_source_id', 'sourceId')
        .addSelect('COUNT(chunk.id)', 'count')
        .where('chunk.knowledge_source_id IN (:...sourceIds)', { sourceIds })
        .groupBy('chunk.knowledge_source_id')
        .getRawMany();

      for (const row of counts) {
        chunkCountsMap.set(row.sourceId, parseInt(row.count, 10));
      }
    }

    return sources.map((s) =>
      Object.assign(s, {
        chunkCount: chunkCountsMap.get(s.id) ?? 0,
      }),
    );
  }

  async getSource(
    projectId: string,
    sourceId: string,
  ): Promise<KnowledgeSource & { chunks: KnowledgeChunk[] }> {
    const source = await this.sourceRepo.findOne({
      where: { id: sourceId, projectId, deletedAt: IsNull() },
    });

    if (!source) {
      throw new NotFoundException(`Knowledge source ${sourceId} not found in project ${projectId}`);
    }

    const chunks = await this.chunkRepo.find({
      where: {
        knowledgeSourceId: source.id,
        indexVersion: source.activeIndexVersion,
      },
      order: { chunkIndex: 'ASC' },
    });

    return Object.assign(source, { chunks });
  }

  async reindexSource(
    projectId: string,
    sourceId: string,
    actorId?: string,
  ): Promise<ProcessingJob> {
    const source = await this.sourceRepo.findOne({
      where: { id: sourceId, projectId, deletedAt: IsNull() },
    });

    if (!source) {
      throw new NotFoundException(`Knowledge source ${sourceId} not found in project ${projectId}`);
    }

    // Reset status to QUEUED and force reindex
    source.status = KnowledgeSourceStatus.QUEUED;
    source.contentHash = null; // Forces recalculation
    await this.sourceRepo.save(source);

    // Create a processing job record
    const job = this.jobRepo.create({
      projectId,
      requestedBy: actorId ?? null,
      jobType: ProcessingJobType.REINDEX,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      sourceRevision: source.sourceRevision,
      status: ProcessingJobStatus.PENDING,
      attempts: 0,
      progress: 0,
    });

    const savedJob = await this.jobRepo.save(job);

    // Trigger re-ingestion asynchronously
    setImmediate(() => {
      void (async () => {
        savedJob.status = ProcessingJobStatus.RUNNING;
        savedJob.startedAt = new Date();
        await this.jobRepo.save(savedJob);

        try {
          // Emit outbox event to re-sync
          const eventType = `${source.sourceType}_UPDATED`;
          await this.handleOutboxEvent({
            id: 'manual-reindex',
            projectId,
            eventType,
            dedupeKey: `reindex:${source.id}:${Date.now()}`,
            payload: {
              [`${source.sourceType.toLowerCase()}Id`]: source.sourceId,
              title: source.title,
              revision: source.sourceRevision,
            },
            attempts: 0,
            dispatchedAt: null,
            lastError: null,
            createdAt: new Date(),
          });

          savedJob.status = ProcessingJobStatus.COMPLETED;
          savedJob.progress = 100;
          savedJob.completedAt = new Date();
          await this.jobRepo.save(savedJob);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          savedJob.status = ProcessingJobStatus.FAILED;
          savedJob.safeFailureReason = message;
          await this.jobRepo.save(savedJob);
        }
      })();
    });

    return savedJob;
  }

  async listJobs(projectId: string): Promise<ProcessingJob[]> {
    return this.jobRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
