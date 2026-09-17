import { Injectable } from '@nestjs/common';
import { FetchIssuesOptions, GitHubApiIssue, IGitHubClient } from './github-client.interface';

@Injectable()
export class MockGitHubClientService implements IGitHubClient {
  private readonly defaultMockIssues: GitHubApiIssue[] = [
    {
      id: 1001,
      number: 1,
      title: 'Fix cookie session expiration on Safari mobile',
      body: 'Users report being logged out on iOS Safari after 15 minutes due to ITP cookie partitioning policies. Need to ensure SameSite and Secure attributes are compliant.',
      state: 'open',
      html_url: 'https://github.com/example/repo/issues/1',
      user: { login: 'alice-dev' },
      labels: [{ name: 'bug' }, { name: 'auth' }, { name: 'high-priority' }],
      created_at: '2026-09-10T08:00:00Z',
      updated_at: '2026-09-12T14:30:00Z',
    },
    {
      id: 1002,
      number: 2,
      title: 'Support pgvector cosine distance operator in hybrid retrieval',
      body: 'Evaluate <=> cosine distance index performance compared to inner product for 1536-dimensional OpenAI embeddings.',
      state: 'closed',
      html_url: 'https://github.com/example/repo/issues/2',
      user: { login: 'bob-engineer' },
      labels: [{ name: 'feature' }, { name: 'database' }, { name: 'pgvector' }],
      created_at: '2026-09-11T10:15:00Z',
      updated_at: '2026-09-14T09:00:00Z',
    },
    {
      id: 1003,
      number: 3,
      title: 'Add rate limiting for AI conversation endpoints',
      body: 'Protect DeepSeek API budget by enforcing 10 requests per minute per user on /projects/:id/ai/conversations.',
      state: 'open',
      html_url: 'https://github.com/example/repo/issues/3',
      user: { login: 'charlie-sec' },
      labels: [{ name: 'security' }, { name: 'api' }],
      created_at: '2026-09-13T12:00:00Z',
      updated_at: '2026-09-15T16:45:00Z',
    },
    {
      id: 1004,
      number: 4,
      title: 'Improve Docker Compose test database startup and cleanup speed',
      body: 'Running integration tests against postgres-test port 55433 should spin up and tear down cleanly without zombie containers.',
      state: 'closed',
      html_url: 'https://github.com/example/repo/issues/4',
      user: { login: 'alice-dev' },
      labels: [{ name: 'dx' }, { name: 'devops' }],
      created_at: '2026-09-14T07:30:00Z',
      updated_at: '2026-09-16T11:20:00Z',
    },
    {
      id: 1005,
      number: 5,
      title: 'Implement optimistic concurrency control on Task updates',
      body: 'Tasks should reject concurrent modifications with 409 Conflict when version numbers collide.',
      state: 'closed',
      html_url: 'https://github.com/example/repo/issues/5',
      user: { login: 'bob-engineer' },
      labels: [{ name: 'bug' }, { name: 'tasks' }],
      created_at: '2026-09-15T09:00:00Z',
      updated_at: '2026-09-16T15:00:00Z',
    },
  ];

  async verifyRepository(
    owner: string,
    repo: string,
  ): Promise<{ id: number; name: string; full_name: string; owner: string }> {
    if (owner.toLowerCase() === 'invalid' || repo.toLowerCase() === 'not-found') {
      throw new Error(`GitHub repository ${owner}/${repo} not found`);
    }

    return {
      id: 88889999,
      name: repo,
      full_name: `${owner}/${repo}`,
      owner,
    };
  }

  async fetchIssues(
    owner: string,
    repo: string,
    options?: FetchIssuesOptions,
  ): Promise<{ issues: GitHubApiIssue[]; hasMore: boolean }> {
    let filtered = [...this.defaultMockIssues];

    if (options?.state && options.state !== 'all') {
      filtered = filtered.filter((i) => i.state === options.state);
    }

    if (options?.since) {
      const sinceDate = new Date(options.since);
      filtered = filtered.filter((i) => new Date(i.updated_at) >= sinceDate);
    }

    const page = options?.page ?? 1;
    const perPage = options?.perPage ?? 30;
    const start = (page - 1) * perPage;
    const end = start + perPage;

    const pageIssues = filtered.slice(start, end).map((issue) => ({
      ...issue,
      html_url: `https://github.com/${owner}/${repo}/issues/${issue.number}`,
    }));

    return {
      issues: pageIssues,
      hasMore: end < filtered.length,
    };
  }
}
