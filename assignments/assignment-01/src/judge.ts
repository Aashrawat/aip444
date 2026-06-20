import type OpenAI from 'openai';

import { debugLog } from './logger.js';

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
      debugLog(`[${label}] Retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
      await sleep(delay);
    }
  }

  throw lastError;
}

function stripMarkdownFences(html: string): string {
  const trimmed = html.trim();
  const fenceMatch = trimmed.match(/^```(?:html)?\s*([\s\S]*?)```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

export interface RunJudgeOptions {
  client: OpenAI;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}

export async function runJudge(options: RunJudgeOptions): Promise<string> {
  const { client, model, systemPrompt, userPrompt } = options;

  debugLog('[Lead Dev] Starting synthesis...');

  const response = await withRetry('Lead Dev', () =>
    client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
    })
  );

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Lead Developer returned an empty HTML report');
  }

  const html = stripMarkdownFences(content);
  if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
    throw new Error('Lead Developer did not return valid HTML');
  }

  debugLog(`[Lead Dev] Generated HTML report (${html.length} characters)`);
  debugLog('[Lead Dev] Synthesis complete.');

  return html;
}
