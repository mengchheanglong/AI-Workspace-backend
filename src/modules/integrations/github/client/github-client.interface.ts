export interface GitHubApiIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  user: {
    login: string;
  } | null;
  labels: Array<{ name: string } | string>;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

export interface GitHubApiComment {
  id: number;
  body: string;
  user: {
    login: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubApiPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  user: {
    login: string;
  } | null;
  base?: { ref: string };
  head?: { ref: string };
  merged_at: string | null;
  labels: Array<{ name: string } | string>;
  created_at: string;
  updated_at: string;
}

export interface GitHubApiTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubApiFileContent {
  path: string;
  sha: string;
  size: number;
  content: string;
  html_url: string;
}

export interface FetchIssuesOptions {
  since?: string;
  page?: number;
  perPage?: number;
  state?: 'all' | 'open' | 'closed';
}

export interface FetchPullRequestsOptions {
  page?: number;
  perPage?: number;
  state?: 'all' | 'open' | 'closed';
}

export interface IGitHubClient {
  verifyRepository(
    owner: string,
    repo: string,
    accessToken?: string,
  ): Promise<{ id: number; name: string; full_name: string; owner: string }>;

  fetchIssues(
    owner: string,
    repo: string,
    options?: FetchIssuesOptions,
    accessToken?: string,
  ): Promise<{ issues: GitHubApiIssue[]; hasMore: boolean }>;

  fetchIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
    accessToken?: string,
  ): Promise<GitHubApiComment[]>;

  fetchPullRequests(
    owner: string,
    repo: string,
    options?: FetchPullRequestsOptions,
    accessToken?: string,
  ): Promise<{ pullRequests: GitHubApiPullRequest[]; hasMore: boolean }>;

  fetchRepositoryTree(
    owner: string,
    repo: string,
    branch?: string,
    accessToken?: string,
  ): Promise<GitHubApiTreeEntry[]>;

  fetchFileContent(
    owner: string,
    repo: string,
    path: string,
    accessToken?: string,
  ): Promise<GitHubApiFileContent | null>;
}

export const GITHUB_CLIENT = Symbol('GITHUB_CLIENT');
