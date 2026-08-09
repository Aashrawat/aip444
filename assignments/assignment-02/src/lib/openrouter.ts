import OpenAI from 'openai';

import { getOpenRouterApiKey, resolveModelName } from './env.js';
import { debugLog } from './logger.js';

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (client) return client;
  client = new OpenAI({
    apiKey: getOpenRouterApiKey(),
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/Aashrawat/AIP444',
      'X-OpenRouter-Title': 'AIP444 Assignment 02 Job Search',
    },
  });
  return client;
}

export function getModel(): string {
  return resolveModelName();
}

export function logUsage(
  label: string,
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null
): void {
  if (!usage) {
    debugLog(`LLM call: ${model} (${label}) — usage unavailable`);
    return;
  }
  const prompt = usage.prompt_tokens ?? 0;
  const completion = usage.completion_tokens ?? 0;
  const total = usage.total_tokens ?? prompt + completion;
  debugLog(
    `LLM call: ${model} (${label}) — prompt=${prompt} completion=${completion} total=${total}`
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('timeout') ||
    message.includes('overloaded') ||
    message.includes('econnreset') ||
    message.includes('fetch failed')
  );
}

const MAX_RETRIES = 4;
const INITIAL_RETRY_MS = 1000;

export async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
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
      debugLog(
        `${label}: transient error, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`
      );
      await sleep(delay);
    }
  }
  throw lastError;
}
