import { tavily } from '@tavily/core';

let client: ReturnType<typeof tavily> | null = null;

function getClient(): ReturnType<typeof tavily> {
  if (client) {
    return client;
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not found in environment');
  }

  client = tavily({ apiKey });
  return client;
}

export interface SearchResultSummary {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
}

/**
 * Search the web via Tavily for docs / error fixes.
 * Prefers recent results (startDate) to catch post-cutoff framework changes.
 */
export async function lookupError(query: string): Promise<string> {
  const tvly = getClient();

  console.error(`[img-debug] lookup_error query: ${query}`);

  const response = await tvly.search(query, {
    searchDepth: 'advanced',
    topic: 'general',
    maxResults: 5,
    includeAnswer: true,
    // Bias toward current docs for modern frameworks (lab tip).
    startDate: '2025-01-01',
  });

  const results: SearchResultSummary[] = (response.results ?? []).map((r) => ({
    title: r.title ?? 'Untitled',
    url: r.url ?? '',
    content: r.content ?? '',
    score: r.score,
    publishedDate: r.publishedDate,
  }));

  const parts: string[] = [];

  if (response.answer) {
    parts.push(`## Tavily Answer\n\n${response.answer}`);
  }

  if (results.length === 0) {
    parts.push('## Search Results\n\nNo results found for this query.');
  } else {
    const formatted = results
      .map((r, i) => {
        const meta = [
          r.publishedDate ? `Published: ${r.publishedDate}` : null,
          typeof r.score === 'number' ? `Score: ${r.score.toFixed(3)}` : null,
        ]
          .filter(Boolean)
          .join(' | ');

        return [
          `### ${i + 1}. ${r.title}`,
          `URL: ${r.url}`,
          meta || null,
          '',
          r.content,
        ]
          .filter((line) => line !== null)
          .join('\n');
      })
      .join('\n\n---\n\n');

    parts.push(`## Search Results\n\n${formatted}`);
  }

  return parts.join('\n\n');
}
