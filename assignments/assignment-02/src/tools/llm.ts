import type OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ZodType } from 'zod';

import { debugLog } from '../lib/logger.js';
import { getModel, getOpenAIClient, logUsage, withRetry } from '../lib/openrouter.js';
import { webSearch, webSearchToolDef } from './webSearch.js';
import { whoisLookup, whoisToolDef } from './whois.js';

const MAX_TOOL_ITERATIONS = 8;
const MAX_SCHEMA_RETRIES = 2;
/** Cap completion size so low OpenRouter balances are not rejected (default can be 65k). */
const MAX_COMPLETION_TOKENS = 4096;

export type StructuredCallOptions<T> = {
  label: string;
  system: string;
  user: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: ZodType<T>;
  tools?: 'none' | 'web' | 'web_and_whois';
  temperature?: number;
  maxToolIterations?: number;
};

async function executeTool(name: string, argsJson: string): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson) as Record<string, unknown>;
  } catch {
    return JSON.stringify({ error: 'Invalid tool arguments JSON' });
  }

  if (name === 'web_search') {
    const query = String(args.query ?? '');
    const result = await webSearch(query);
    return JSON.stringify(result);
  }
  if (name === 'whois_lookup') {
    const domain = String(args.domain ?? '');
    const result = await whoisLookup(domain);
    return JSON.stringify(result);
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

function toolDefsFor(mode: StructuredCallOptions<unknown>['tools']) {
  if (mode === 'web') return [webSearchToolDef];
  if (mode === 'web_and_whois') return [webSearchToolDef, whoisToolDef];
  return undefined;
}

/**
 * Optional tool loop, then a final structured-output call validated with Zod.
 */
export async function runStructured<T>(options: StructuredCallOptions<T>): Promise<T> {
  const client = getOpenAIClient();
  const model = getModel();
  const temperature = options.temperature ?? 0.2;
  const tools = toolDefsFor(options.tools ?? 'none');
  const maxIter = options.maxToolIterations ?? MAX_TOOL_ITERATIONS;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: options.system },
    { role: 'user', content: options.user },
  ];

  if (tools) {
    for (let i = 0; i < maxIter; i += 1) {
      const response = await withRetry(options.label, () =>
        client.chat.completions.create({
          model,
          temperature,
          max_tokens: MAX_COMPLETION_TOKENS,
          messages,
          tools,
        })
      );
      logUsage(`${options.label} tool-loop`, model, response.usage);

      const choice = response.choices[0]?.message;
      if (!choice) throw new Error(`${options.label}: empty tool-loop response`);

      messages.push({
        role: 'assistant',
        content: choice.content,
        tool_calls: choice.tool_calls,
      });

      if (!choice.tool_calls?.length) {
        debugLog(`${options.label}: tool loop finished (no more tool calls)`);
        break;
      }

      for (const call of choice.tool_calls) {
        if (call.type !== 'function') {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: `Unsupported tool call type: ${call.type}` }),
          });
          continue;
        }
        const result = await executeTool(
          call.function.name,
          call.function.arguments
        );
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result,
        });
      }

      if (i === maxIter - 1) {
        debugLog(`${options.label}: hit max tool iterations (${maxIter})`);
      }
    }
  }

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= MAX_SCHEMA_RETRIES; attempt += 1) {
    const structuredMessages = [...messages];
    if (lastError) {
      structuredMessages.push({
        role: 'user',
        content: `Your previous JSON failed validation: ${lastError}. Return corrected JSON matching the schema. Do not invent missing fields — use null or empty arrays.`,
      });
    }

    const response = await withRetry(`${options.label}-structured`, () =>
      client.chat.completions.create({
        model,
        temperature,
        max_tokens: MAX_COMPLETION_TOKENS,
        messages: structuredMessages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: options.schemaName,
            strict: true,
            schema: options.jsonSchema,
          },
        },
      })
    );
    logUsage(`${options.label} structured`, model, response.usage);

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      lastError = 'empty content';
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      lastError = 'invalid JSON';
      debugLog(`${options.label}: Structured output validation: failed (invalid JSON)`);
      continue;
    }

    const validated = options.zodSchema.safeParse(parsedJson);
    if (!validated.success) {
      lastError = validated.error.message;
      debugLog(
        `${options.label}: Structured output validation: failed — ${lastError}`
      );
      continue;
    }

    debugLog(`${options.label}: Structured output validation: passed`);
    return validated.data;
  }

  throw new Error(
    `${options.label}: failed structured output validation after retries: ${lastError}`
  );
}

export async function runMarkdownGeneration(options: {
  label: string;
  system: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const client = getOpenAIClient();
  const model = getModel();
  const response = await withRetry(options.label, () =>
    client.chat.completions.create({
      model,
      temperature: options.temperature ?? 0.3,
      max_tokens: MAX_COMPLETION_TOKENS,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
    })
  );
  logUsage(options.label, model, response.usage);
  const text = response.choices[0]?.message?.content?.trim();
  if (!text) throw new Error(`${options.label}: empty markdown response`);
  return text;
}

/** Unused import guard helper for OpenAI type re-export if needed */
export type { OpenAI };
