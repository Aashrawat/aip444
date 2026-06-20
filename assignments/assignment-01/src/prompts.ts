import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadPrompt(name: string): Promise<string> {
  const promptPath = path.join(__dirname, 'prompts', `${name}.md`);
  return readFile(promptPath, 'utf-8');
}

export function buildReviewUserPrompt(inputType: 'git' | 'file', content: string, filePath?: string): string {
  if (inputType === 'git') {
    return [
      'Review the following **staged git diff**:',
      '',
      '```diff',
      content,
      '```',
    ].join('\n');
  }

  return [
    `Review the following **source file** (${filePath ?? 'unknown'}):`,
    '',
    '```',
    content,
    '```',
  ].join('\n');
}

export function buildJudgeUserPrompt(
  inputType: 'git' | 'file',
  content: string,
  reviewer1Name: string,
  reviewer1Findings: unknown,
  reviewer2Name: string,
  reviewer2Findings: unknown,
  filePath?: string
): string {
  const sourceLabel =
    inputType === 'git'
      ? 'Staged git diff under review:'
      : `Source file under review (${filePath ?? 'unknown'}):`;

  return [
    sourceLabel,
    '',
    '```',
    content,
    '```',
    '',
    `## ${reviewer1Name} findings`,
    '```json',
    JSON.stringify(reviewer1Findings, null, 2),
    '```',
    '',
    `## ${reviewer2Name} findings`,
    '```json',
    JSON.stringify(reviewer2Findings, null, 2),
    '```',
    '',
    'Synthesize these reviews into a single HTML report following your instructions.',
  ].join('\n');
}
