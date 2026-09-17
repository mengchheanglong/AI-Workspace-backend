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

export interface FetchIssuesOptions {
  since?: string;
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
}

export const GITHUB_CLIENT = Symbol('GITHUB_CLIENT');
