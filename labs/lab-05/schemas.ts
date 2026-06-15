import * as z from 'zod';

export const GitHubFileRequestSchema = z.object({
  owner: z.string().describe('The GitHub repository owner or organization (e.g., microsoft).'),
  repo: z.string().describe('The repository name (e.g., vscode).'),
  path: z
    .string()
    .describe('The file path within the repo (e.g., package.json or src/index.ts).'),
  ref: z
    .string()
    .optional()
    .describe(
      'Branch name, tag, or commit SHA. Defaults to main. For PR analysis, prefer the PR head commit SHA or head branch from the pull request metadata.'
    ),
});

export const ReadGitHubFilesArgsSchema = z.object({
  files: z
    .array(GitHubFileRequestSchema)
    .min(1)
    .describe(
      'One or more GitHub files to read. Batch related files in a single call when possible.'
    ),
});

export type ReadGitHubFilesArgs = z.infer<typeof ReadGitHubFilesArgsSchema>;

export const readGitHubFilesTool = {
  type: 'function' as const,
  function: {
    name: 'read_github_files',
    description: [
      'Fetch full file contents from GitHub when a PR diff alone is insufficient.',
      'Use this when you need surrounding code, imports, type definitions, configuration, or related logic that the diff does not show.',
      'Prefer the PR head commit SHA or head branch ref from the pull request metadata.',
      'Only request files that appear in the diff or are clearly related to understanding the change.',
      'Do not fetch every file mentioned; fetch the minimum set needed to explain the change.',
      'Large files are truncated to the first 1,000 lines.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          description:
            'Array of GitHub file objects to read. Example: [{ owner: "microsoft", repo: "vscode", path: "package.json", ref: "main" }]',
          items: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'The GitHub repository owner/org.',
              },
              repo: {
                type: 'string',
                description: 'The repository name.',
              },
              path: {
                type: 'string',
                description: 'The file path within the repo.',
              },
              ref: {
                type: 'string',
                description:
                  'The branch name, commit SHA, or tag (e.g., main). Defaults to main if omitted.',
              },
            },
            required: ['owner', 'repo', 'path'],
            additionalProperties: false,
          },
        },
      },
      required: ['files'],
      additionalProperties: false,
    },
  },
};

export const prAdviceTools = [readGitHubFilesTool];
