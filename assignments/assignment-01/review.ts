#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import OpenAI from 'openai';

import {
  defaultOutputFilename,
  findWorkspaceRoot,
  getStagedDiff,
  readReviewFile,
} from './src/git.js';
import { runJudge } from './src/judge.js';
import { debugLog, error, info, setDebug } from './src/logger.js';
import {
  buildJudgeUserPrompt,
  buildReviewUserPrompt,
  loadPrompt,
} from './src/prompts.js';
import { runReviewer } from './src/reviewer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const repoRoot = findWorkspaceRoot(path.resolve(__dirname, '../..'));
const envPath = path.join(repoRoot, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
} else {
  dotenv.config({ quiet: true });
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  error('Error: OPENROUTER_API_KEY not found. Add it to your .env file at the repo root.');
  process.exit(1);
}

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
});

const defaultReviewerModel = 'google/gemini-2.5-flash-lite';
const defaultJudgeModel = 'google/gemini-2.5-flash-lite';

const reviewerModel =
  process.env.OPENROUTER_REVIEWER_MODEL?.trim() || defaultReviewerModel;
const judgeModel = process.env.OPENROUTER_JUDGE_MODEL?.trim() || defaultJudgeModel;

interface CliOptions {
  debug: boolean;
  file?: string;
  output?: string;
}

function parseCliOptions(): CliOptions {
  try {
    const { values } = parseArgs({
      options: {
        debug: { type: 'boolean', default: false },
        file: { type: 'string' },
        output: { type: 'string' },
      },
      allowPositionals: false,
    });

    return {
      debug: values.debug ?? false,
      file: values.file,
      output: values.output,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(`Error parsing arguments: ${message}`);
    error('');
    error('Usage:');
    error('  npm run review                              # Git mode (staged changes)');
    error('  npm run review -- --file path/to/file.ts    # File mode');
    error('  npm run review -- --debug --file bad_code.ts');
    error('  npm run review -- --output report.html');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const options = parseCliOptions();
  setDebug(options.debug);

  const assignmentDir = __dirname;
  const workspaceRoot = findWorkspaceRoot(assignmentDir);

  let inputType: 'git' | 'file';
  let reviewContent: string;
  let sourceLabel: string;
  let filePath: string | undefined;

  if (options.file) {
    inputType = 'file';
    try {
      const { content, resolvedPath } = readReviewFile(options.file, process.cwd());
      reviewContent = content;
      filePath = path.relative(workspaceRoot, resolvedPath) || resolvedPath;
      sourceLabel = filePath;
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    if (!reviewContent.trim()) {
      error('Nothing to review: the file is empty.');
      process.exit(1);
    }
  } else {
    inputType = 'git';
    let diff: string | null;
    try {
      diff = getStagedDiff(workspaceRoot);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    if (!diff) {
      error('Nothing to review: no staged changes found.');
      error('Stage changes with `git add` or use --file to review a specific file.');
      process.exit(1);
    }

    reviewContent = diff;
    sourceLabel = 'staged git changes';
  }

  debugLog(`Input mode: ${inputType}`);
  debugLog(`Workspace root: ${workspaceRoot}`);
  debugLog(`Reviewer model: ${reviewerModel}`);
  debugLog(`Judge model: ${judgeModel}`);

  const userPrompt = buildReviewUserPrompt(inputType, reviewContent, filePath);

  const [securityPrompt, maintainabilityPrompt, leadDevPrompt] = await Promise.all([
    loadPrompt('security-auditor'),
    loadPrompt('maintainability-critic'),
    loadPrompt('lead-developer'),
  ]);

  debugLog('Phase 1: Running reviewers in parallel...');

  const [securityFindings, maintainabilityFindings] = await Promise.all([
    runReviewer({
      client,
      model: reviewerModel,
      reviewerName: 'Security Auditor',
      reviewerLabel: 'Security',
      systemPrompt: securityPrompt,
      userPrompt,
      workspaceRoot,
      temperature: 0.1,
    }),
    runReviewer({
      client,
      model: reviewerModel,
      reviewerName: 'Maintainability Critic',
      reviewerLabel: 'Maintainability',
      systemPrompt: maintainabilityPrompt,
      userPrompt,
      workspaceRoot,
      temperature: 0.3,
    }),
  ]);

  debugLog('Phase 2: Lead Developer synthesizing report...');

  const judgePrompt = buildJudgeUserPrompt(
    inputType,
    reviewContent,
    'Security Auditor',
    { findings: securityFindings },
    'Maintainability Critic',
    { findings: maintainabilityFindings },
    filePath
  );

  const htmlReport = await runJudge({
    client,
    model: judgeModel,
    systemPrompt: leadDevPrompt,
    userPrompt: judgePrompt,
  });

  const outputPath = path.resolve(
    process.cwd(),
    options.output ?? defaultOutputFilename()
  );

  await writeFile(outputPath, htmlReport, 'utf-8');

  info(`Review complete. Report saved to: ${outputPath}`);
  info(`Reviewed: ${sourceLabel}`);
  info(
    `Findings: ${securityFindings.length} security + ${maintainabilityFindings.length} maintainability (before synthesis)`
  );
}

main().catch((err) => {
  error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
