import { tavily } from '@tavily/core';

import { getTavilyApiKey } from '../lib/env.js';
import { debugLog } from '../lib/logger.js';

let tavilyClient: ReturnType<typeof tavily> | null = null;

function getTavily(): ReturnType<typeof tavily> {
  if (tavilyClient) return tavilyClient;
  tavilyClient = tavily({ apiKey: getTavilyApiKey() });
  return tavilyClient;
}

export type WebSearchResult = {
  ok: boolean;
  query: string;
  results: Array<{ title: string; url: string; content: string }>;
  error?: string;
};

export async function webSearch(
  query: string,
  maxResults = 5
): Promise<WebSearchResult> {
  debugLog(`Tool call: web_search("${query}")`);
  try {
    const response = await getTavily().search(query, {
      maxResults,
      searchDepth: 'basic',
    });
    const results = (response.results ?? []).slice(0, maxResults).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: (r.content ?? '').slice(0, 800),
    }));
    debugLog(
      `Search returned ${results.length} results, top: ${results[0]?.url ?? 'none'}`
    );
    return { ok: true, query, results };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debugLog(`web_search failed: ${message}`);
    return {
      ok: false,
      query,
      results: [],
      error: `Search failed: ${message}. Continue without this research.`,
    };
  }
}

/** OpenAI Chat Completions tool definition */
export const webSearchToolDef = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description:
      'Search the web for company info, news, culture signals, careers pages, certifications, or learning resources. Prefer specific queries.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};
