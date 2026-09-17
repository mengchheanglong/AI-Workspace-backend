import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Project } from '../../src/modules/projects/entities/project.entity';
import { AuditService } from '../../src/modules/audit/audit.service';
import { IngestionService } from '../../src/modules/ingestion/ingestion.service';
import { KnowledgeSourceType } from '../../src/modules/ingestion/entities/knowledge-source.entity';
import { MockGitHubClientService } from '../../src/modules/integrations/github/client/mock-github-client.service';
import {
  GitHubConnection,
  GitHubConnectionStatus,
} from '../../src/modules/integrations/github/entities/github-connection.entity';
import { GitHubIssue } from '../../src/modules/integrations/github/entities/github-issue.entity';
import { GitHubIntegrationService } from '../../src/modules/integrations/github/github-integration.service';

describe('GitHubIntegrationService', () => {
  let service: GitHubIntegrationService;
  let connectionRepo: jest.Mocked<Repository<GitHubConnection>>;
  let issueRepo: jest.Mocked<Repository<GitHubIssue>>;
  let projectRepo: jest.Mocked<Repository<Project>>;
  let githubClient: MockGitHubClientService;
  let ingestionService: jest.Mocked<IngestionService>;
  let auditService: jest.Mocked<AuditService>;
  let dataSource: jest.Mocked<DataSource>;

  const projectId = 'proj-123';
  const actorId = 'user-456';
  const mockProject = { id: projectId, name: 'AI Workspace' } as Project;

  beforeEach(() => {
    connectionRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ id: 'conn-1', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'conn-1', ...entity })),
      count: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<Repository<GitHubConnection>>;

    issueRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ id: 'issue-uuid-1', ...dto })),
      save: jest
        .fn()
        .mockImplementation((entity) => Promise.resolve({ id: 'issue-uuid-1', ...entity })),
      count: jest.fn().mockResolvedValue(5),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<GitHubIssue>>;

    projectRepo = {
      findOne: jest.fn().mockResolvedValue(mockProject),
    } as unknown as jest.Mocked<Repository<Project>>;

    githubClient = new MockGitHubClientService();

    ingestionService = {
      syncGitHubIssue: jest.fn().mockResolvedValue(null),
      deactivateSourcesByType: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IngestionService>;

    auditService = {
      record: jest.fn().mockResolvedValue({} as never),
    } as unknown as jest.Mocked<AuditService>;

    dataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb({ save: jest.fn(), delete: jest.fn() })),
    } as unknown as jest.Mocked<DataSource>;

    service = new GitHubIntegrationService(
      connectionRepo,
      issueRepo,
      projectRepo,
      githubClient,
      ingestionService,
      auditService,
      dataSource,
    );
  });

  describe('getConnection', () => {
    it('returns null when no connection exists', async () => {
      connectionRepo.findOne.mockResolvedValue(null);

      const result = await service.getConnection(projectId);
      expect(result).toBeNull();
      expect(projectRepo.findOne).toHaveBeenCalledWith({ where: { id: projectId } });
    });

    it('returns connection details with issue count', async () => {
      const mockConn = {
        id: 'conn-1',
        projectId,
        repositoryOwner: 'acme',
        repositoryName: 'workspace',
        repositoryId: '12345',
        status: GitHubConnectionStatus.CONNECTED,
        lastSyncedAt: new Date('2026-09-17T10:00:00Z'),
        errorSummary: null,
        createdAt: new Date('2026-09-17T09:00:00Z'),
        updatedAt: new Date('2026-09-17T10:00:00Z'),
      } as GitHubConnection;

      connectionRepo.findOne.mockResolvedValue(mockConn);
      issueRepo.count.mockResolvedValue(5);

      const result = await service.getConnection(projectId);
      expect(result).not.toBeNull();
      expect(result?.repositoryOwner).toBe('acme');
      expect(result?.repositoryName).toBe('workspace');
      expect(result?.issueCount).toBe(5);
    });

    it('throws NotFoundException if project does not exist', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(service.getConnection('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('connectRepository', () => {
    it('connects repository, saves connection, audits, and triggers sync', async () => {
      const savedConn = {
        id: 'conn-1',
        projectId,
        repositoryOwner: 'org',
        repositoryName: 'repo',
        status: GitHubConnectionStatus.CONNECTED,
        lastSyncedAt: new Date(),
        errorSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as GitHubConnection;

      connectionRepo.findOne.mockResolvedValueOnce(null).mockResolvedValue(savedConn);

      const result = await service.connectRepository(projectId, actorId, {
        repositoryOwner: 'org',
        repositoryName: 'repo',
      });

      expect(connectionRepo.save).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          actorId,
          action: 'GITHUB_CONNECTED',
        }),
      );
      expect(ingestionService.syncGitHubIssue).toHaveBeenCalled();
      expect(result.status).toBe(GitHubConnectionStatus.CONNECTED);
    });

    it('throws BadRequestException if repository verification fails', async () => {
      await expect(
        service.connectRepository(projectId, actorId, {
          repositoryOwner: 'invalid',
          repositoryName: 'not-found',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('syncIssues', () => {
    it('fetches issues from client, upserts, and indexes into knowledge sources', async () => {
      const mockConn = {
        id: 'conn-1',
        projectId,
        repositoryOwner: 'org',
        repositoryName: 'repo',
        status: GitHubConnectionStatus.CONNECTED,
        syncCursor: null,
      } as GitHubConnection;

      connectionRepo.findOne.mockResolvedValue(mockConn);

      const result = await service.syncIssues(projectId, actorId);

      expect(result.syncedCount).toBeGreaterThan(0);
      expect(ingestionService.syncGitHubIssue).toHaveBeenCalledTimes(result.syncedCount);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          actorId,
          action: 'GITHUB_SYNCED',
        }),
      );
    });

    it('throws BadRequestException if connection is disconnected', async () => {
      const mockConn = {
        id: 'conn-1',
        projectId,
        status: GitHubConnectionStatus.DISCONNECTED,
      } as GitHubConnection;

      connectionRepo.findOne.mockResolvedValue(mockConn);

      await expect(service.syncIssues(projectId, actorId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('disconnect', () => {
    it('marks connection disconnected and deactivates knowledge sources', async () => {
      const mockConn = {
        id: 'conn-1',
        projectId,
        repositoryOwner: 'org',
        repositoryName: 'repo',
        status: GitHubConnectionStatus.CONNECTED,
      } as GitHubConnection;

      connectionRepo.findOne.mockResolvedValue(mockConn);

      await service.disconnect(projectId, actorId);

      expect(mockConn.status).toBe(GitHubConnectionStatus.DISCONNECTED);
      expect(connectionRepo.save).toHaveBeenCalledWith(mockConn);
      expect(ingestionService.deactivateSourcesByType).toHaveBeenCalledWith(
        projectId,
        KnowledgeSourceType.GITHUB_ISSUE,
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          actorId,
          action: 'GITHUB_DISCONNECTED',
        }),
      );
    });
  });

  describe('listIssues', () => {
    it('queries issues with pagination and filters', async () => {
      const mockIssues = [
        {
          id: 'iss-1',
          projectId,
          connectionId: 'conn-1',
          issueNumber: 1,
          title: 'Issue 1',
          body: 'Body text',
          state: 'open',
          htmlUrl: 'https://github.com/org/repo/issues/1',
          authorLogin: 'alice',
          labels: ['bug'],
          githubCreatedAt: new Date(),
          githubUpdatedAt: new Date(),
          syncedAt: new Date(),
        },
      ] as GitHubIssue[];

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockIssues, 1]),
      };

      issueRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      const result = await service.listIssues(projectId, {
        page: 1,
        limit: 10,
        state: 'open',
        q: 'Issue',
      });

      expect(result.total).toBe(1);
      expect(result.items.length).toBe(1);
      expect(result.items[0]?.title).toBe('Issue 1');
      expect(mockQb.andWhere).toHaveBeenCalled();
    });
  });
});
