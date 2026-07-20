import fs from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from 'openai/resources/chat/completions';

import { processImage } from './image.js';
import { imgDebugTools, LookupErrorArgsSchema } from './schemas.js';
import { lookupError } from './search.js';

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

if (!process.env.TAVILY_API_KEY) {
  console.error('Error: TAVILY_API_KEY not found');
  console.error('Add your Tavily API key to the project .env file (see https://app.tavily.com).');
  process.exit(1);
}

console.error('img-debug: Developed by: Aashrawat Shrestha-179413232');

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
});

const defaultModel = 'google/gemini-3-flash-preview';
const configuredModel = process.env.OPENROUTER_MODEL?.split(',')
  .map((m) => m.trim())
  .filter(Boolean)[0];
// openrouter/free is flaky and often lacks reliable vision+tools support.
const model =
  !configuredModel || configuredModel === 'openrouter/free'
    ? defaultModel
    : configuredModel;

const MAX_TOOL_ITERATIONS = 5;

async function loadSystemPrompt(): Promise<string> {
  const promptPath = path.join(__dirname, 'SYSTEM_PROMPT.md');
  return readFile(promptPath, 'utf-8');
}

function buildUserContent(
  prompt: string,
  base64Jpeg: string
): ChatCompletionContentPart[] {
  return [
    {
      type: 'text',
      text: prompt,
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${base64Jpeg}`,
      },
    },
  ];
}

async function executeTool(name: string, args: unknown): Promise<string> {
  if (name !== 'lookup_error') {
    return `Unknown tool: ${name}`;
  }

  const parsed = LookupErrorArgsSchema.safeParse(args);
  if (!parsed.success) {
    return `Invalid arguments for lookup_error: ${parsed.error.message}`;
  }

  try {
    return await lookupError(parsed.data.query);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `lookup_error failed: ${message}`;
  }
}

function toAssistantMessage(message: OpenAI.Chat.Completions.ChatCompletionMessage) {
  return {
    role: 'assistant' as const,
    content: message.content,
    tool_calls: message.tool_calls,
  };
}

export async function debugScreenshot(
  imagePath: string,
  userPrompt: string
): Promise<string> {
  const systemPrompt = await loadSystemPrompt();
  const base64 = await processImage(imagePath);

  console.error(`[img-debug] model: ${model}`);
  console.error(`[img-debug] prompt: ${userPrompt}`);

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: buildUserContent(userPrompt, base64),
    },
  ];

  for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration += 1) {
    console.error(`[img-debug] LLM call iteration ${iteration}/${MAX_TOOL_ITERATIONS}`);

    const response = await client.chat.completions.create({
      model,
      messages,
      tools: imgDebugTools,
      temperature: 0.2,
    });

    if (!response.choices?.length) {
      const errDetail =
        typeof (response as { error?: unknown }).error === 'object'
          ? JSON.stringify((response as { error?: unknown }).error)
          : JSON.stringify(response).slice(0, 500);
      throw new Error(
        `The model returned no choices (model=${model}). Response: ${errDetail}`
      );
    }

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

    console.error(`[img-debug] model requested ${toolCalls.length} tool call(s)`);
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

      console.error(`[img-debug] tool call: ${name}`);
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

function parseArguments(): { imagePath: string; prompt: string } {
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
    console.error('Usage: npm run img-debug -- <image-path> [prompt...]');
    console.error('Example: npm run img-debug -- ./error.png "Why is this failing?"');
    process.exit(1);
  }

  const imagePath = path.resolve(positionals[0]);
  const prompt =
    positionals.slice(1).join(' ').trim() ||
    'Debug the error shown in this screenshot. Identify the cause and provide a concrete fix. Use lookup_error when you need current documentation.';

  return { imagePath, prompt };
}

async function main() {
  const { imagePath, prompt } = parseArguments();

  const analysis = await debugScreenshot(imagePath, prompt);

  // Final answer to stdout (debug logs go to stderr).
  console.log(analysis);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error:', message);
  process.exit(1);
});
