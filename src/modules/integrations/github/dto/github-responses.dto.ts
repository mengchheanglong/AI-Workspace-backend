import { GitHubConnectionStatus } from '../entities/github-connection.entity';

export class GitHubConnectionResponseDto {
  id!: string;
  projectId!: string;
  repositoryOwner!: string;
  repositoryName!: string;
  repositoryId!: string | null;
  status!: GitHubConnectionStatus;
  lastSyncedAt!: string | null;
  errorSummary!: string | null;
  issueCount?: number;
  createdAt!: string;
  updatedAt!: string;
}

export class SyncGitHubResponseDto {
  syncedCount!: number;
  totalCount!: number;
  lastSyncedAt!: string;
}

export class GitHubIssueResponseDto {
  id!: string;
  projectId!: string;
  connectionId!: string;
  issueNumber!: number;
  title!: string;
  body!: string | null;
  state!: string;
  htmlUrl!: string;
  authorLogin!: string | null;
  labels!: string[];
  githubCreatedAt!: string;
  githubUpdatedAt!: string;
  syncedAt!: string;
}
