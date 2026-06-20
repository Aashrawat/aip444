import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export function findWorkspaceRoot(startDir: string): string {
  let current = path.resolve(startDir);

  while (true) {
    if (existsSync(path.join(current, '.git'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

export function getStagedDiff(cwd: string): string | null {
  try {
    const diff = execSync('git diff --staged', {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

    return diff.length > 0 ? diff : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to run git diff --staged: ${message}`);
  }
}

export function readReviewFile(filePath: string, cwd: string): { content: string; resolvedPath: string } {
  const resolved = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(cwd, filePath);

  if (!existsSync(resolved)) {
    throw new Error(`File not found: ${filePath}`);
  }

  try {
    const content = readFileSync(resolved, 'utf-8');
    return { content, resolvedPath: resolved };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read file "${filePath}": ${message}`);
  }
}

export function defaultOutputFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  return `review-${day}-${month}-${year}-${hours}-${minutes}-${seconds}.html`;
}
