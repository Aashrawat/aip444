import type OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from 'openai/resources/chat/completions';

import { debugLog } from './logger.js';
import {
  ReadFileArgsSchema,
  RipgrepArgsSchema,
  ReviewOutputSchema,
  reviewerTools,
  reviewOutputJsonSchema,
  type ReviewFinding,
} from './schemas.js';
import { readFileContent, ripgrepSearch } from './tools.js';

const MAX_TOOL_ITERATIONS = 8;
const MAX_RETRIES = 4;
const INITIAL_RETRY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('timeout') ||
    message.includes('overloaded')
  );
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = INITIAL_RETRY_MS * 2 ** (attempt - 1);
      debugLog(`[${label}] Rate limited or transient error, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
      await sleep(delay);
    }
  }

  throw lastError;
}

function executeTool(
  name: string,
  args: unknown,
  workspaceRoot: string,
  reviewerLabel: string
): string {
  if (name === 'read_file') {
    const parsed = ReadFileArgsSchema.safeParse(args);
    if (!parsed.success) {
      return `Invalid read_file arguments: ${parsed.error.message}`;
    }

    const { file_path, start_line, end_line } = parsed.data;
    debugLog(`[${reviewerLabel}] Calling read_file("${file_path}"${start_line ? `, ${start_line}` : ''}${end_line ? `, ${end_line}` : ''})`);

    const result = readFileContent(file_path, workspaceRoot, start_line, end_line);
    debugLog(`[Tool] read_file returned ${result.length} characters`);
    return result;
  }

  if (name === 'ripgrep') {
    const parsed = RipgrepArgsSchema.safeParse(args);
    if (!parsed.success) {
      return `Invalid ripgrep arguments: ${parsed.error.message}`;
    }

    debugLog(`[${reviewerLabel}] Calling ripgrep("${parsed.data.search_pattern}")`);
    const result = ripgrepSearch(parsed.data.search_pattern, workspaceRoot);
    debugLog(`[Tool] ripgrep returned ${result.length} characters`);
    return result;
  }

  return `Unknown tool: ${name}. Only read_file and ripgrep are available.`;
}

function toAssistantMessage(message: OpenAI.Chat.Completions.ChatCompletionMessage) {
  return {
    role: 'assistant' as const,
    content: message.content,
    tool_calls: message.tool_calls,
  };
}

export interface RunReviewerOptions {
  client: OpenAI;
  model: string;
  reviewerName: string;
  reviewerLabel: string;
  systemPrompt: string;
  userPrompt: string;
  workspaceRoot: string;
  temperature: number;
}

export async function runReviewer(options: RunReviewerOptions): Promise<ReviewFinding[]> {
  const {
    client,
    model,
    reviewerName,
    reviewerLabel,
    systemPrompt,
    userPrompt,
    workspaceRoot,
    temperature,
  } = options;

  debugLog(`[${reviewerLabel}] Starting review...`);

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration += 1) {
    debugLog(`[${reviewerLabel}] LLM iteration ${iteration}/${MAX_TOOL_ITERATIONS}`);

    const response = await withRetry(reviewerLabel, () =>
      client.chat.completions.create({
        model,
        messages,
        tools: reviewerTools,
        temperature,
      })
    );

    const assistantMessage = response.choices[0]?.message;
    if (!assistantMessage) {
      throw new Error(`${reviewerName} returned an empty response`);
    }

    const toolCalls = assistantMessage.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      break;
    }

    debugLog(`[${reviewerLabel}] Requested ${toolCalls.length} tool call(s)`);
    messages.push(toAssistantMessage(assistantMessage));

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function') {
        continue;
      }

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

      const result = executeTool(toolCall.function.name, parsedArgs, workspaceRoot, reviewerLabel);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  messages.push({
    role: 'user',
    content:
      'You have finished gathering context. Return your final review as JSON matching the required schema with a `findings` array. Include only issues supported by the code and your tool results.',
  });

  const structuredResponse = await withRetry(reviewerLabel, () =>
    client.chat.completions.create({
      model,
      messages,
      temperature,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'code_review_findings',
          strict: true,
          schema: reviewOutputJsonSchema,
        },
      },
    })
  );

  const rawContent = structuredResponse.choices[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new Error(`${reviewerName} returned empty structured output`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(`${reviewerName} returned invalid JSON: ${rawContent.slice(0, 200)}`);
  }

  const validated = ReviewOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`${reviewerName} output failed validation: ${validated.error.message}`);
  }

  debugLog(`[${reviewerLabel}] Found ${validated.data.findings.length} issue(s)`);
  debugLog(`[${reviewerLabel}] Raw findings JSON:\n${JSON.stringify(validated.data, null, 2)}`);
  debugLog(`[${reviewerLabel}] Review complete.`);

  return validated.data.findings;
}
