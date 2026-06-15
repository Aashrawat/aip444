import fs from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from 'openai/resources/chat/completions';

import {
  fetchPullRequestData,
  formatPullRequestForPrompt,
} from './github.js';
import { prAdviceTools, ReadGitHubFilesArgsSchema } from './schemas.js';
import { readGitHubFiles } from './tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
} else {
  dotenv.config({ quiet: true });
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('Error: OPENROUTER_API_KEY not found');
  process.exit(1);
}

console.log('pr-advice:Developed by: Aashrawat Shrestha-179413232');

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
});

const defaultModel = 'google/gemini-2.5-flash-lite';
const model =
  process.env.OPENROUTER_MODEL?.split(',').map((m) => m.trim()).filter(Boolean)[0] ??
  defaultModel;

const MAX_TOOL_ITERATIONS = 5;

async function loadSystemPrompt(): Promise<string> {
  const promptPath = path.join(__dirname, 'SYSTEM_PROMPT.md');
  return readFile(promptPath, 'utf-8');
}

function buildUserPrompt(prContent: string): string {
  return [
    'Analyze this pull request. Use read_github_files only when the diff and comments are not enough.',
    '',
    prContent,
  ].join('\n');
}

function executeTool(name: string, args: unknown): Promise<string> | string {
  if (name !== 'read_github_files') {
    return `Unknown tool: ${name}`;
  }

  const parsed = ReadGitHubFilesArgsSchema.safeParse(args);
  if (!parsed.success) {
    return `Invalid arguments for read_github_files: ${parsed.error.message}`;
  }

  console.log('[pr-advice] executing read_github_files with args:', JSON.stringify(parsed.data, null, 2));
  return readGitHubFiles(parsed.data.files);
}

function toAssistantMessage(message: OpenAI.Chat.Completions.ChatCompletionMessage) {
  return {
    role: 'assistant' as const,
    content: message.content,
    tool_calls: message.tool_calls,
  };
}

export async function analyzePullRequestWithTools(prContent: string): Promise<string> {
  const systemPrompt = await loadSystemPrompt();
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildUserPrompt(prContent) },
  ];

  for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration += 1) {
    console.log(`[pr-advice] LLM call iteration ${iteration}/${MAX_TOOL_ITERATIONS}`);

    const response = await client.chat.completions.create({
      model,
      messages,
      tools: prAdviceTools,
      temperature: 0.3,
    });

    const assistantMessage = response.choices[0]?.message;
    if (!assistantMessage) {
      throw new Error('The model returned an empty response');
    }

    const toolCalls = assistantMessage.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const content = assistantMessage.content?.trim();
      if (!content) {
        throw new Error('The model returned an empty analysis');
      }
      return content;
    }

    console.log(`[pr-advice] model requested ${toolCalls.length} tool call(s)`);
    messages.push(toAssistantMessage(assistantMessage));

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function') {
        continue;
      }

      const { name } = toolCall.function;
      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        const toolMessage: ChatCompletionToolMessageParam = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `Failed to parse tool arguments as JSON: ${toolCall.function.arguments}`,
        };
        messages.push(toolMessage);
        continue;
      }

      console.log(`[pr-advice] tool call: ${name}`);
      const result = await executeTool(name, parsedArgs);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  return 'Max tool-calling iterations reached. The model did not produce a final analysis.';
}

function parseArguments(): { prUrl: string } {
  let positionals: string[];
  try {
    ({ positionals } = parseArgs({ allowPositionals: true }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error parsing arguments:', message);
    process.exit(1);
    throw err;
  }

  if (positionals.length === 0) {
    console.error('Usage: npm run pr-advice -- <github-pr-url>');
    console.error('Example: npm run pr-advice -- https://github.com/microsoft/vscode/pull/12345');
    process.exit(1);
  }

  return { prUrl: positionals[0] };
}

async function main() {
  const { prUrl } = parseArguments();

  console.log(`Fetching PR data from ${prUrl}...`);
  const prData = await fetchPullRequestData(prUrl);
  const prContent = formatPullRequestForPrompt(prData);

  console.log(`Analyzing PR #${prData.number}: ${prData.title}`);
  const analysis = await analyzePullRequestWithTools(prContent);

  console.log('\n--- PR Analysis ---\n');
  console.log(analysis);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error:', message);
  process.exit(1);
});
