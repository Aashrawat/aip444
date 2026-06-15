export interface PullRequestComment {
  author: string;
  body: string;
  path?: string;
  createdAt: string;
}

export interface PullRequestData {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  baseRef: string;
  headRef: string;
  headSha: string;
  diff: string;
  reviewComments: PullRequestComment[];
  issueComments: PullRequestComment[];
  url: string;
}

export function parsePullRequestUrl(prUrl: string): {
  owner: string;
  repo: string;
  number: number;
} {
  let parsed: URL;
  try {
    parsed = new URL(prUrl);
  } catch {
    throw new Error(`Invalid PR URL: ${prUrl}`);
  }

  if (parsed.hostname !== 'github.com') {
    throw new Error('PR URL must be a github.com link');
  }

  const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    throw new Error(
      'PR URL must look like https://github.com/{owner}/{repo}/pull/{number}'
    );
  }

  return {
    owner: match[1],
    repo: match[2],
    number: Number.parseInt(match[3], 10),
  };
}

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'aip444-lab-05-pr-advice',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function githubGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: githubHeaders() });

  if (response.status === 404) {
    throw new Error(`GitHub resource not found: ${url}`);
  }

  if (response.status === 403 || response.status === 429) {
    throw new Error(
      `GitHub API rate limit or access denied (${response.status}). Set GITHUB_TOKEN or wait before retrying.`
    );
  }

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function githubGetText(url: string, accept: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      ...githubHeaders(),
      Accept: accept,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

interface GitHubPullRequest {
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: { login: string } | null;
  base: { ref: string };
  head: { ref: string; sha: string };
}

interface GitHubReviewComment {
  user: { login: string } | null;
  body: string;
  path?: string;
  created_at: string;
}

interface GitHubIssueComment {
  user: { login: string } | null;
  body: string;
  created_at: string;
}

function mapReviewComments(comments: GitHubReviewComment[]): PullRequestComment[] {
  return comments.map((comment) => ({
    author: comment.user?.login ?? 'unknown',
    body: comment.body,
    path: comment.path,
    createdAt: comment.created_at,
  }));
}

function mapIssueComments(comments: GitHubIssueComment[]): PullRequestComment[] {
  return comments.map((comment) => ({
    author: comment.user?.login ?? 'unknown',
    body: comment.body,
    createdAt: comment.created_at,
  }));
}

export async function fetchPullRequestData(prUrl: string): Promise<PullRequestData> {
  const { owner, repo, number } = parsePullRequestUrl(prUrl);
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  const [pullRequest, diff, reviewComments, issueComments] = await Promise.all([
    githubGet<GitHubPullRequest>(`${base}/pulls/${number}`),
    githubGetText(`${base}/pulls/${number}`, 'application/vnd.github.diff'),
    githubGet<GitHubReviewComment[]>(`${base}/pulls/${number}/comments`),
    githubGet<GitHubIssueComment[]>(`${base}/issues/${number}/comments`),
  ]);

  return {
    owner,
    repo,
    number,
    title: pullRequest.title,
    body: pullRequest.body ?? '',
    state: pullRequest.state,
    author: pullRequest.user?.login ?? 'unknown',
    baseRef: pullRequest.base.ref,
    headRef: pullRequest.head.ref,
    headSha: pullRequest.head.sha,
    diff,
    reviewComments: mapReviewComments(reviewComments),
    issueComments: mapIssueComments(issueComments),
    url: pullRequest.html_url,
  };
}

export function formatPullRequestForPrompt(data: PullRequestData): string {
  const reviewSection =
    data.reviewComments.length > 0
      ? data.reviewComments
          .map(
            (comment) =>
              `- **${comment.author}**${comment.path ? ` on \`${comment.path}\`` : ''} (${comment.createdAt}):\n  ${comment.body.replace(/\n/g, '\n  ')}`
          )
          .join('\n')
      : '_No inline review comments._';

  const issueSection =
    data.issueComments.length > 0
      ? data.issueComments
          .map(
            (comment) =>
              `- **${comment.author}** (${comment.createdAt}):\n  ${comment.body.replace(/\n/g, '\n  ')}`
          )
          .join('\n')
      : '_No general PR comments._';

  return [
    '<pull_request>',
    `URL: ${data.url}`,
    `Title: ${data.title}`,
    `Author: ${data.author}`,
    `State: ${data.state}`,
    `Base branch: ${data.baseRef}`,
    `Head branch: ${data.headRef}`,
    `Head commit SHA: ${data.headSha}`,
    '',
    'Description:',
    data.body || '_No description provided._',
    '',
    'Repository context for read_github_files:',
    `- owner: ${data.owner}`,
    `- repo: ${data.repo}`,
    `- ref for changed files on this PR: ${data.headSha} (preferred) or ${data.headRef}`,
    '</pull_request>',
    '',
    '<review_comments>',
    reviewSection,
    '</review_comments>',
    '',
    '<issue_comments>',
    issueSection,
    '</issue_comments>',
    '',
    '<diff>',
    data.diff || '_No diff available._',
    '</diff>',
  ].join('\n');
}
