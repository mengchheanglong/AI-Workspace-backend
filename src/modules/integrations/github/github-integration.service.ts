import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { AuditService } from '../../audit/audit.service';
import { IngestionService } from '../../ingestion/ingestion.service';
import { KnowledgeSourceType } from '../../ingestion/entities/knowledge-source.entity';
import { GITHUB_CLIENT, IGitHubClient } from './client/github-client.interface';
import { ConnectGitHubDto } from './dto/connect-github.dto';
import {
  GitHubConnectionResponseDto,
  GitHubIssueResponseDto,
  SyncGitHubResponseDto,
} from './dto/github-responses.dto';
import { ListGitHubIssuesQueryDto } from './dto/list-github-issues-query.dto';
import { GitHubConnection, GitHubConnectionStatus } from './entities/github-connection.entity';
import { GitHubIssue } from './entities/github-issue.entity';

@Injectable()
export class GitHubIntegrationService {
  private readonly logger = new Logger(GitHubIntegrationService.name);

  constructor(
    @InjectRepository(GitHubConnection)
    private readonly connectionRepo: Repository<GitHubConnection>,
    @InjectRepository(GitHubIssue)
    private readonly issueRepo: Repository<GitHubIssue>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @Inject(GITHUB_CLIENT)
    private readonly githubClient: IGitHubClient,
    private readonly ingestionService: IngestionService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async getConnection(projectId: string): Promise<GitHubConnectionResponseDto | null> {
    await this.ensureProjectExists(projectId);

    const connection = await this.connectionRepo.findOne({
      where: { projectId },
    });

    if (!connection) {
      return null;
    }

    const issueCount = await this.issueRepo.count({
      where: { connectionId: connection.id },
    });

    return this.mapConnectionDto(connection, issueCount);
  }

  async connectRepository(
    projectId: string,
    actorId: string,
    dto: ConnectGitHubDto,
  ): Promise<GitHubConnectionResponseDto> {
    await this.ensureProjectExists(projectId);

    // Verify repository with GitHub API (or mock)
    let repoInfo: { id: number; name: string; full_name: string; owner: string };
    try {
      repoInfo = await this.githubClient.verifyRepository(
        dto.repositoryOwner,
        dto.repositoryName,
        dto.accessToken,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException({
        code: 'GITHUB_REPOSITORY_INVALID',
        message: `Failed to verify repository ${dto.repositoryOwner}/${dto.repositoryName}: ${msg}`,
      });
    }

    let connection = await this.connectionRepo.findOne({
      where: { projectId },
    });

    if (connection) {
      connection.repositoryOwner = dto.repositoryOwner;
      connection.repositoryName = dto.repositoryName;
      connection.repositoryId = String(repoInfo.id);
      connection.status = GitHubConnectionStatus.CONNECTED;
      connection.errorSummary = null;
      connection.updatedAt = new Date();
      connection = await this.connectionRepo.save(connection);
    } else {
      connection = this.connectionRepo.create({
        projectId,
        repositoryOwner: dto.repositoryOwner,
        repositoryName: dto.repositoryName,
        repositoryId: String(repoInfo.id),
        status: GitHubConnectionStatus.CONNECTED,
        lastSyncedAt: null,
        errorSummary: null,
        syncCursor: null,
      });
      connection = await this.connectionRepo.save(connection);
    }

    await this.auditService.record({
      projectId,
      actorId,
      action: 'GITHUB_CONNECTED',
      entityType: 'GITHUB_CONNECTION',
      entityId: connection.id,
      metadata: {
        repository: `${dto.repositoryOwner}/${dto.repositoryName}`,
      },
    });

    // Trigger initial sync
    await this.syncIssues(projectId, actorId, dto.accessToken);

    return (await this.getConnection(projectId))!;
  }

  async syncIssues(
    projectId: string,
    actorId: string,
    accessToken?: string,
  ): Promise<SyncGitHubResponseDto> {
    await this.ensureProjectExists(projectId);

    const connection = await this.connectionRepo.findOne({
      where: { projectId },
    });

    if (!connection) {
      throw new NotFoundException({
        code: 'GITHUB_CONNECTION_NOT_FOUND',
        message: 'No GitHub connection found for this project',
      });
    }

    if (connection.status === GitHubConnectionStatus.DISCONNECTED) {
      throw new BadRequestException({
        code: 'GITHUB_CONNECTION_DISCONNECTED',
        message: 'Cannot sync a disconnected GitHub repository. Reconnect first.',
      });
    }

    let fetchResult;
    try {
      fetchResult = await this.githubClient.fetchIssues(
        connection.repositoryOwner,
        connection.repositoryName,
        {
          since: connection.syncCursor ?? undefined,
          state: 'all',
          perPage: 100,
        },
        accessToken,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      connection.status = GitHubConnectionStatus.ERROR;
      connection.errorSummary = msg;
      await this.connectionRepo.save(connection);
      throw new BadRequestException({
        code: 'GITHUB_SYNC_FAILED',
        message: `Failed to fetch issues from GitHub: ${msg}`,
      });
    }

    const { issues } = fetchResult;

    for (const apiIssue of issues) {
      let issue = await this.issueRepo.findOne({
        where: { connectionId: connection.id, issueNumber: apiIssue.number },
      });

      const labelNames = (apiIssue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));

      if (issue) {
        issue.title = apiIssue.title;
        issue.body = apiIssue.body;
        issue.state = apiIssue.state;
        issue.htmlUrl = apiIssue.html_url;
        issue.authorLogin = apiIssue.user?.login ?? null;
        issue.labels = labelNames;
        issue.githubUpdatedAt = new Date(apiIssue.updated_at);
        issue.syncedAt = new Date();
      } else {
        issue = this.issueRepo.create({
          projectId,
          connectionId: connection.id,
          githubIssueId: String(apiIssue.id),
          issueNumber: apiIssue.number,
          title: apiIssue.title,
          body: apiIssue.body,
          state: apiIssue.state,
          htmlUrl: apiIssue.html_url,
          authorLogin: apiIssue.user?.login ?? null,
          labels: labelNames,
          githubCreatedAt: new Date(apiIssue.created_at),
          githubUpdatedAt: new Date(apiIssue.updated_at),
          syncedAt: new Date(),
        });
      }

      issue = await this.issueRepo.save(issue);

      // Ingest and vectorize into KnowledgeSource for RAG and search
      await this.ingestionService.syncGitHubIssue(projectId, {
        issueId: issue.id,
        issueNumber: issue.issueNumber,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        htmlUrl: issue.htmlUrl,
        authorLogin: issue.authorLogin,
        labels: issue.labels,
        repositoryOwner: connection.repositoryOwner,
        repositoryName: connection.repositoryName,
        revision: Math.floor(issue.githubUpdatedAt.getTime() / 1000),
      });
    }

    const now = new Date();
    connection.status = GitHubConnectionStatus.CONNECTED;
    connection.errorSummary = null;
    connection.lastSyncedAt = now;
    connection.syncCursor = now.toISOString();
    await this.connectionRepo.save(connection);

    const totalCount = await this.issueRepo.count({
      where: { connectionId: connection.id },
    });

    await this.auditService.record({
      projectId,
      actorId,
      action: 'GITHUB_SYNCED',
      entityType: 'GITHUB_CONNECTION',
      entityId: connection.id,
      metadata: {
        syncedCount: issues.length,
        totalCount,
      },
    });

    return {
      syncedCount: issues.length,
      totalCount,
      lastSyncedAt: now.toISOString(),
    };
  }

  async disconnect(projectId: string, actorId: string): Promise<void> {
    await this.ensureProjectExists(projectId);

    const connection = await this.connectionRepo.findOne({
      where: { projectId },
    });

    if (!connection) {
      throw new NotFoundException({
        code: 'GITHUB_CONNECTION_NOT_FOUND',
        message: 'No GitHub connection found for this project',
      });
    }

    connection.status = GitHubConnectionStatus.DISCONNECTED;
    await this.connectionRepo.save(connection);

    // Immediately deactivate knowledge sources and delete chunks so they disappear from search & AI
    await this.ingestionService.deactivateSourcesByType(
      projectId,
      KnowledgeSourceType.GITHUB_ISSUE,
    );

    await this.auditService.record({
      projectId,
      actorId,
      action: 'GITHUB_DISCONNECTED',
      entityType: 'GITHUB_CONNECTION',
      entityId: connection.id,
      metadata: {
        repository: `${connection.repositoryOwner}/${connection.repositoryName}`,
      },
    });
  }

  async listIssues(
    projectId: string,
    query: ListGitHubIssuesQueryDto,
  ): Promise<{ items: GitHubIssueResponseDto[]; total: number; page: number; limit: number }> {
    await this.ensureProjectExists(projectId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.issueRepo
      .createQueryBuilder('issue')
      .where('issue.project_id = :projectId', { projectId });

    if (query.state && query.state !== 'all') {
      qb.andWhere('issue.state = :state', { state: query.state });
    }

    if (query.q) {
      const search = `%${query.q.toLowerCase()}%`;
      const num = parseInt(query.q, 10);
      if (!isNaN(num)) {
        qb.andWhere(
          '(LOWER(issue.title) LIKE :search OR LOWER(issue.body) LIKE :search OR issue.issue_number = :num)',
          { search, num },
        );
      } else {
        qb.andWhere('(LOWER(issue.title) LIKE :search OR LOWER(issue.body) LIKE :search)', {
          search,
        });
      }
    }

    qb.orderBy('issue.issue_number', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [issues, total] = await qb.getManyAndCount();

    return {
      items: issues.map(this.mapIssueDto),
      total,
      page,
      limit,
    };
  }

  private async ensureProjectExists(projectId: string): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
      });
    }
    return project;
  }

  private mapConnectionDto(
    conn: GitHubConnection,
    issueCount: number,
  ): GitHubConnectionResponseDto {
    return {
      id: conn.id,
      projectId: conn.projectId,
      repositoryOwner: conn.repositoryOwner,
      repositoryName: conn.repositoryName,
      repositoryId: conn.repositoryId,
      status: conn.status,
      lastSyncedAt: conn.lastSyncedAt ? conn.lastSyncedAt.toISOString() : null,
      errorSummary: conn.errorSummary,
      issueCount,
      createdAt: conn.createdAt.toISOString(),
      updatedAt: conn.updatedAt.toISOString(),
    };
  }

  private mapIssueDto(issue: GitHubIssue): GitHubIssueResponseDto {
    return {
      id: issue.id,
      projectId: issue.projectId,
      connectionId: issue.connectionId,
      issueNumber: issue.issueNumber,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      htmlUrl: issue.htmlUrl,
      authorLogin: issue.authorLogin,
      labels: issue.labels || [],
      githubCreatedAt: issue.githubCreatedAt.toISOString(),
      githubUpdatedAt: issue.githubUpdatedAt.toISOString(),
      syncedAt: issue.syncedAt.toISOString(),
    };
  }
}
