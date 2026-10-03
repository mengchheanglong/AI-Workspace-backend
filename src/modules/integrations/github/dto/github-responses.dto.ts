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
  pullRequestCount?: number;
  fileCount?: number;
  createdAt!: string;
  updatedAt!: string;
}

export class SyncGitHubResponseDto {
  syncedCount!: number;
  totalCount!: number;
  syncedPrCount?: number;
  totalPrCount?: number;
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

export class GitHubPullRequestResponseDto {
  id!: string;
  projectId!: string;
  connectionId!: string;
  prNumber!: number;
  title!: string;
  body!: string | null;
  state!: string;
  htmlUrl!: string;
  authorLogin!: string | null;
  baseBranch!: string | null;
  headBranch!: string | null;
  isMerged!: boolean;
  mergedAt!: string | null;
  labels!: string[];
  githubCreatedAt!: string;
  githubUpdatedAt!: string;
  syncedAt!: string;
}

export class GitHubRepoFileResponseDto {
  id!: string;
  projectId!: string;
  connectionId!: string;
  path!: string;
  fileName!: string;
  extension!: string;
  size!: number;
  htmlUrl!: string;
  syncedAt!: string;
}

export class SyncCodebaseResponseDto {
  nextCursor!: number | null;
  treeVersion!: string;
  candidateFilesCount!: number;
  unchangedFilesCount!: number;
  indexedFilesCount!: number;
  totalFiles!: number;
  lastSyncedAt!: string;
}
