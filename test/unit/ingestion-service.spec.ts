import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { IngestionService } from '../../src/modules/ingestion/ingestion.service';
import {
  KnowledgeSource,
  KnowledgeChunk,
  ProcessingJob,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
} from '../../src/modules/ingestion/entities';
import { MockEmbeddingProvider } from '../../src/modules/ingestion/embedding/mock-embedding-provider';
import { EntityExtractor } from '../../src/modules/ingestion/extractors/entity-extractor';
import { OutboxService } from '../../src/modules/ingestion/outbox.service';
import { LocalStorageService } from '../../src/modules/storage/local-storage.service';

describe('IngestionService', () => {
  let service: IngestionService;
  let sourceRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let chunkRepo: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let jobRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let storageDriver: {
    getAbsolutePath: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let outboxService: {
    setEventHandler: jest.Mock;
    emit: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };
  let dataSource: {
    transaction: jest.Mock;
  };

  beforeEach(() => {
    sourceRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'source-uuid-1' })),
      save: jest.fn(async (entity) => ({ ...entity, id: entity.id || 'source-uuid-1' })),
    };

    chunkRepo = {
      create: jest.fn((dto) => ({ ...dto, id: 'chunk-uuid-1' })),
      save: jest.fn(async (chunks) => chunks),
      delete: jest.fn(async () => {}),
      find: jest.fn(async () => []),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    jobRepo = {
      create: jest.fn((dto) => ({ ...dto, id: 'job-uuid-1' })),
      save: jest.fn(async (job) => job),
      find: jest.fn(async () => []),
    };

    storageDriver = {
      getAbsolutePath: jest.fn(() => 'test.txt'),
      save: jest.fn(),
      delete: jest.fn(),
    };

    outboxService = {
      setEventHandler: jest.fn(),
      emit: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'AI_EMBEDDING_PROVIDER') return 'mock';
        return null;
      }),
    };

    dataSource = {
      transaction: jest.fn(async (cb) => {
        const tx = {
          findOne: jest.fn(async () =>
            sourceRepo.create({
              id: 'source-uuid-1',
              projectId: 'proj-1',
              sourceType: KnowledgeSourceType.REQUIREMENT,
              sourceId: 'req-1',
              sourceRevision: 1,
              title: 'Test Req',
              activeIndexVersion: 0,
              status: KnowledgeSourceStatus.PROCESSING,
            }),
          ),
          create: jest.fn((_, dto) => ({ ...dto, id: 'new-chunk-1' })),
          save: jest.fn(async (_, entity) => entity),
          delete: jest.fn(async () => {}),
        };
        return cb(tx);
      }),
    };

    service = new IngestionService(
      sourceRepo as unknown as Repository<KnowledgeSource>,
      chunkRepo as unknown as Repository<KnowledgeChunk>,
      jobRepo as unknown as Repository<ProcessingJob>,
      storageDriver as unknown as LocalStorageService,
      outboxService as unknown as OutboxService,
      configService as unknown as ConfigService,
      dataSource as unknown as DataSource,
    );

    service.setEmbeddingProvider(new MockEmbeddingProvider(1536));
  });

  it('should initialize and register event handler on onModuleInit', () => {
    service.onModuleInit();
    expect(outboxService.setEventHandler).toHaveBeenCalled();
  });

  it('should index a requirement and activate chunks atomically', async () => {
    sourceRepo.findOne.mockResolvedValueOnce(null);

    const result = await service.syncRequirement('proj-1', {
      requirementId: 'req-1',
      revision: 1,
      title: 'User Login Support',
      description: 'System must allow users to log in with secure passwords.',
      status: 'APPROVED',
      priority: 'HIGH',
    });

    expect(result).toBeDefined();
    expect(sourceRepo.save).toHaveBeenCalled();
    expect(dataSource.transaction).toHaveBeenCalled();
  });

  it('should skip stale older revision', async () => {
    sourceRepo.findOne.mockResolvedValueOnce({
      id: 'source-uuid-1',
      projectId: 'proj-1',
      sourceType: KnowledgeSourceType.REQUIREMENT,
      sourceId: 'req-1',
      sourceRevision: 3, // Already at revision 3
      title: 'Existing',
      status: KnowledgeSourceStatus.INDEXED,
    });

    const result = await service.syncRequirement('proj-1', {
      requirementId: 'req-1',
      revision: 2, // Older revision 2 arrives late
      title: 'Old Title',
    });

    expect(result).toBeDefined();
    expect(result?.sourceRevision).toBe(3);
    // Should not run transaction to chunk or embed older revision
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('should skip re-chunking when content hash is unchanged and source is already indexed', async () => {
    const existing = sourceRepo.create({
      id: 'source-uuid-1',
      projectId: 'proj-1',
      sourceType: KnowledgeSourceType.REQUIREMENT,
      sourceId: 'req-1',
      sourceRevision: 1,
      title: 'User Login Support',
      status: KnowledgeSourceStatus.INDEXED,
      activeIndexVersion: 1,
      contentHash: null,
    });

    // Compute expected hash of the requirement
    const extractor = new EntityExtractor();
    const doc = extractor.extractRequirement({
      id: 'req-1',
      title: 'User Login Support',
    });
    const crypto = await import('node:crypto');
    existing.contentHash = crypto.createHash('sha256').update(doc.text).digest('hex');

    sourceRepo.findOne.mockResolvedValueOnce(existing);

    const result = await service.syncRequirement('proj-1', {
      requirementId: 'req-1',
      revision: 2,
      title: 'User Login Support',
    });

    expect(result).toBeDefined();
    // Re-chunking transaction was bypassed due to identical content hash
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('should clean up chunks when a source is deleted', async () => {
    sourceRepo.findOne.mockResolvedValueOnce({
      id: 'source-uuid-1',
      projectId: 'proj-1',
      sourceType: KnowledgeSourceType.TASK,
      sourceId: 'task-1',
    });

    await service.deleteSource('proj-1', KnowledgeSourceType.TASK, 'task-1');

    expect(dataSource.transaction).toHaveBeenCalled();
  });
});
