import path from 'node:path';
import { config } from 'dotenv';

import { PROJECT_ROOT } from './paths.js';

config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });
// Also allow repo-root .env for convenience
config({ path: path.join(PROJECT_ROOT, '../..', '.env'), quiet: true });

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Copy .env.example to .env and set your keys.`
    );
  }
  return value;
}

export function resolveModelName(): string {
  const configured = process.env.OPENROUTER_MODEL?.split(',')
    .map((m) => m.trim())
    .filter(Boolean)[0];

  const fallback = 'google/gemini-2.5-flash';
  if (!configured || configured === 'openrouter/free') {
    return fallback;
  }
  return configured;
}

export function getOpenRouterApiKey(): string {
  return requireEnv('OPENROUTER_API_KEY');
}

export function getTavilyApiKey(): string {
  return requireEnv('TAVILY_API_KEY');
}
