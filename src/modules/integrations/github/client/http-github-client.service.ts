import { Injectable, Logger } from '@nestjs/common';
import { FetchIssuesOptions, GitHubApiIssue, IGitHubClient } from './github-client.interface';

@Injectable()
export class HttpGitHubClientService implements IGitHubClient {
  private readonly logger = new Logger(HttpGitHubClientService.name);
  private readonly baseUrl = 'https://api.github.com';

  async verifyRepository(
    owner: string,
    repo: string,
    accessToken?: string,
  ): Promise<{ id: number; name: string; full_name: string; owner: string }> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'AI-Workspace-Backend',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      this.logger.warn(`GitHub repository verification failed: ${res.status} ${errorText}`);
      throw new Error(`GitHub repository ${owner}/${repo} returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as { id: number; name: string; full_name: string };
    return {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      owner,
    };
  }

  async fetchIssues(
    owner: string,
    repo: string,
    options?: FetchIssuesOptions,
    accessToken?: string,
  ): Promise<{ issues: GitHubApiIssue[]; hasMore: boolean }> {
    const query = new URLSearchParams();
    query.set('state', options?.state ?? 'all');
    query.set('per_page', String(options?.perPage ?? 100));
    query.set('page', String(options?.page ?? 1));
    if (options?.since) {
      query.set('since', options.since);
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'AI-Workspace-Backend',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues?${query.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      this.logger.error(`Failed to fetch issues from ${owner}/${repo}: ${res.status} ${errorText}`);
      throw new Error(`GitHub issues API returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as GitHubApiIssue[];

    // Exclude pull requests (GitHub issues API includes PRs unless filtered)
    const issuesOnly = data.filter((item) => !item.pull_request);

    // Check Link header for 'rel="next"' pagination
    const linkHeader = res.headers.get('link') || '';
    const hasMore = linkHeader.includes('rel="next"');

    return {
      issues: issuesOnly,
      hasMore,
    };
  }
}
