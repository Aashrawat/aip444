import fs from 'node:fs';
import path from 'node:path';
import { rgPath } from '@vscode/ripgrep';
import { spawnSync } from 'node:child_process';

export const DEFAULT_MAX_LINES = 500;
export const MAX_RIPGREP_MATCHES = 50;
export const MAX_RIPGREP_OUTPUT_CHARS = 12_000;

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.pdf',
  '.zip',
  '.gz',
  '.woff',
  '.woff2',
  '.ico',
  '.mp4',
  '.mp3',
]);

function resolveSafePath(filePath: string, workspaceRoot: string): string {
  const resolved = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(workspaceRoot, filePath);

  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace: ${filePath}`);
  }

  return resolved;
}

function truncateLines(content: string, maxLines: number): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) {
    return content;
  }

  const truncated = lines.slice(0, maxLines).join('\n');
  return `${truncated}\n[Truncated: showing first ${maxLines} of ${lines.length} lines]`;
}

function truncateChars(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }
  return `${content.slice(0, maxChars)}\n[Truncated: output exceeded ${maxChars} characters]`;
}

export function readFileContent(
  filePath: string,
  workspaceRoot: string,
  startLine?: number,
  endLine?: number,
  maxLines = DEFAULT_MAX_LINES
): string {
  const resolved = resolveSafePath(filePath, workspaceRoot);

  if (!fs.existsSync(resolved)) {
    return `Error: File not found: ${filePath}`;
  }

  const ext = path.extname(resolved).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return `Error: Refusing to read binary file: ${filePath}`;
  }

  const stat = fs.statSync(resolved);
  if (stat.size > 500_000) {
    return `Error: File too large (${stat.size} bytes). Skipping ${filePath} to save tokens.`;
  }

  const raw = fs.readFileSync(resolved, 'utf-8');
  const allLines = raw.split('\n');

  let selected: string;
  if (startLine !== undefined || endLine !== undefined) {
    const start = Math.max(1, startLine ?? 1);
    const end = Math.min(allLines.length, endLine ?? allLines.length);
    if (start > end) {
      return `Error: Invalid line range ${start}-${end} for ${filePath} (${allLines.length} lines total)`;
    }
    selected = allLines.slice(start - 1, end).join('\n');
    selected = `[Lines ${start}-${end} of ${filePath}]\n${selected}`;
  } else {
    selected = raw;
  }

  return truncateLines(selected, maxLines);
}

export function ripgrepSearch(
  searchPattern: string,
  workspaceRoot: string,
  maxMatches = MAX_RIPGREP_MATCHES
): string {
  if (!searchPattern.trim()) {
    return 'Error: search_pattern must not be empty';
  }

  const args = [
    '--line-number',
    '--no-heading',
    '--color=never',
    '--max-count',
    String(maxMatches),
    '--glob',
    '!.git/**',
    '--glob',
    '!node_modules/**',
    '--glob',
    '!**/package-lock.json',
    searchPattern,
    workspaceRoot,
  ];

  const result = spawnSync(rgPath, args, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    return `Error running ripgrep: ${result.error.message}`;
  }

  if (result.status === 1) {
    return `No matches found for pattern: ${searchPattern}`;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || 'Unknown ripgrep error';
    return `Ripgrep failed (exit ${result.status}): ${stderr}`;
  }

  const output = result.stdout?.trim() || '';
  if (!output) {
    return `No matches found for pattern: ${searchPattern}`;
  }

  const lines = output.split('\n');
  const summary =
    lines.length >= maxMatches
      ? `\n[Showing first ${maxMatches} matches; refine your pattern if needed]`
      : `\n[Found ${lines.length} match(es)]`;

  return truncateChars(output + summary, MAX_RIPGREP_OUTPUT_CHARS);
}
