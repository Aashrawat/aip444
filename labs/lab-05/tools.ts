import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '.cache');

export const DEFAULT_MAX_LINES = 1000;

export interface GitHubFileRequest {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

export interface ReadGitHubFilesOptions {
  maxLines?: number;
  useCache?: boolean;
}

function normalizeRef(ref: string): string {
  if (/^[0-9a-f]{40}$/i.test(ref) || ref.startsWith('refs/')) {
    return ref;
  }
  return `refs/heads/${ref}`;
}

export function buildRawGitHubUrl(
  owner: string,
  repo: string,
  filePath: string,
  ref = 'main'
): string {
  const normalizedRef = normalizeRef(ref);
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://raw.githubusercontent.com/${owner}/${repo}/${normalizedRef}/${encodedPath}`;
}

function cacheKey(owner: string, repo: string, ref: string, filePath: string): string {
  const safePath = filePath.replace(/[/\\]/g, '__');
  return `${owner}__${repo}__${ref.replace(/[/\\]/g, '_')}__${safePath}.txt`;
}

async function readFromCache(key: string): Promise<string | null> {
  const cachePath = path.join(CACHE_DIR, key);
  try {
    return await readFile(cachePath, 'utf-8');
  } catch {
    return null;
  }
}

async function writeToCache(key: string, content: string): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, key), content, 'utf-8');
}

function truncateContent(content: string, maxLines: number): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) {
    return content;
  }

  const truncated = lines.slice(0, maxLines).join('\n');
  return `${truncated}\n[File truncated: showing first ${maxLines.toLocaleString()} of ${lines.length.toLocaleString()} lines]`;
}

async function fetchFileContent(
  file: GitHubFileRequest,
  options: ReadGitHubFilesOptions
): Promise<string> {
  const ref = file.ref ?? 'main';
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const useCache = options.useCache ?? true;
  const key = cacheKey(file.owner, file.repo, ref, file.path);

  if (useCache) {
    const cached = await readFromCache(key);
    if (cached !== null) {
      console.log(`[read_github_files] cache hit: ${file.owner}/${file.repo}/${file.path}@${ref}`);
      return cached;
    }
  }

  const url = buildRawGitHubUrl(file.owner, file.repo, file.path, ref);
  console.log(`[read_github_files] fetching: ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'aip444-lab-05-pr-advice',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Network error fetching ${file.owner}/${file.repo}/${file.path}: ${message}`
    );
  }

  if (response.status === 404) {
    throw new Error(
      `File not found: ${file.owner}/${file.repo}/${file.path} at ref "${ref}"`
    );
  }

  if (response.status === 403 || response.status === 429) {
    throw new Error(
      `GitHub rate limit or access denied (${response.status}) for ${file.owner}/${file.repo}/${file.path}. Wait and retry, or use a GITHUB_TOKEN.`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${file.owner}/${file.repo}/${file.path}: HTTP ${response.status} ${response.statusText}`
    );
  }

  const rawContent = await response.text();
  const content = truncateContent(rawContent, maxLines);

  if (useCache) {
    await writeToCache(key, content);
  }

  return content;
}

function formatFileSection(file: GitHubFileRequest, content: string): string {
  const ref = file.ref ?? 'main';
  return [
    `## ${file.path}`,
    '',
    `- **Repository:** \`${file.owner}/${file.repo}\``,
    `- **Ref:** \`${ref}\``,
    '',
    '```',
    content,
    '```',
  ].join('\n');
}

/**
 * Fetches one or more files from GitHub raw URLs, truncating large files.
 */
export async function readGitHubFiles(
  files: GitHubFileRequest[],
  options: ReadGitHubFilesOptions = {}
): Promise<string> {
  if (!Array.isArray(files) || files.length === 0) {
    return 'Error: files array is required and must contain at least one file object.';
  }

  const sections: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!file.owner || !file.repo || !file.path) {
      errors.push(
        `Invalid file entry: owner, repo, and path are required (got ${JSON.stringify(file)})`
      );
      continue;
    }

    try {
      const content = await fetchFileContent(file, options);
      sections.push(formatFileSection(file, content));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
    }
  }

  const parts: string[] = [];
  if (sections.length > 0) {
    parts.push(sections.join('\n\n---\n\n'));
  }
  if (errors.length > 0) {
    parts.push(['## Errors', ...errors.map((e) => `- ${e}`)].join('\n'));
  }

  if (parts.length === 0) {
    return 'No files could be fetched.';
  }

  return parts.join('\n\n');
}
