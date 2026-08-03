import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tool } from '@openai/agents';
import { tavily } from '@tavily/core';
import { z } from 'zod';

import { CredibilityEvaluationSchema } from './schemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPORTS_DIR = path.join(__dirname, 'reports');

const MAX_PAGE_CHARS = 12_000;

let tavilyClient: ReturnType<typeof tavily> | null = null;

function getTavily(): ReturnType<typeof tavily> {
  if (tavilyClient) return tavilyClient;
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not found in environment');
  }
  tavilyClient = tavily({ apiKey });
  return tavilyClient;
}

function logTool(name: string, detail: string): void {
  console.error(`[tool:${name}] ${detail}`);
}

/**
 * Fetch a URL via Jina Reader and return Markdown (truncated).
 */
export const readUrlTool = tool({
  name: 'read_url',
  description:
    'Fetch a web page and return its main content as Markdown via Jina Reader. Use this to read the source under evaluation, About/author/editorial pages, and corroborating articles. If the fetch fails (404/403/timeout), report the error and try an alternate URL or search instead.',
  parameters: z.object({
    url: z
      .string()
      .min(1)
      .describe('Fully-qualified HTTP(S) URL to fetch and read.'),
  }),
  async execute({ url }) {
    logTool('read_url', url);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);
      const response = await fetch(`https://r.jina.ai/${url}`, {
        signal: controller.signal,
        headers: {
          Accept: 'text/plain',
          'X-Return-Format': 'markdown',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return {
          ok: false,
          url,
          error: `HTTP ${response.status} ${response.statusText} while fetching via Jina Reader. Do not invent page content. Try an About page, a different URL, or web_search.`,
        };
      }

      const text = await response.text();
      const truncated = text.length > MAX_PAGE_CHARS;
      return {
        ok: true,
        url,
        truncated,
        char_count: Math.min(text.length, MAX_PAGE_CHARS),
        content: text.slice(0, MAX_PAGE_CHARS),
        note: truncated
          ? `Content truncated to ${MAX_PAGE_CHARS} characters. If author bios or references seem missing, search for them or try a more specific URL.`
          : undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        url,
        error: `Failed to read URL: ${message}. Do not invent content. Use web_search or try another URL.`,
      };
    }
  },
});

/**
 * Search the web with Tavily for author/publication/claim investigation.
 */
export const webSearchTool = tool({
  name: 'web_search',
  description:
    'Search the web (Tavily) for information about authors, publications, editorial standards, corroborating sources, fact-checks, or contradictions. Prefer specific queries (quoted titles, author + affiliation, claim + fact check).',
  parameters: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        'Search query. Include names, outlet domains, claim keywords, or "fact check" as needed.'
      ),
  }),
  async execute({ query }) {
    logTool('web_search', query);
    try {
      const tvly = getTavily();
      const response = await tvly.search(query, {
        searchDepth: 'advanced',
        topic: 'general',
        maxResults: 5,
        includeAnswer: true,
      });

      const results = (response.results ?? []).map((r, i) => ({
        rank: i + 1,
        title: r.title ?? 'Untitled',
        url: r.url ?? '',
        content: (r.content ?? '').slice(0, 800),
        score: r.score,
        publishedDate: r.publishedDate,
      }));

      return {
        ok: true,
        query,
        answer: response.answer ?? null,
        result_count: results.length,
        results,
        note:
          results.length === 0
            ? 'No results. Try a broader or differently phrased query. Do not fabricate sources.'
            : undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        query,
        error: `web_search failed: ${message}. If this looks like a rate limit, wait and retry with a narrower query. Never invent search hits.`,
      };
    }
  },
});

/**
 * "Think" tool: no side effects. Forces a complete structured credibility rubric
 * into the agent context before the final report (Anthropic think-tool pattern).
 */
export const assessCredibilityTool = tool({
  name: 'assess_credibility',
  description:
    'Record a structured credibility evaluation using the full rubric. Call this AFTER investigation (read_url + web_search), and BEFORE save_report. Every field must be grounded in evidence you actually found — never guess. If something is unknown after honest investigation, say so explicitly in the relevant field.',
  parameters: CredibilityEvaluationSchema,
  async execute(evaluation) {
    logTool(
      'assess_credibility',
      `${evaluation.overall_credibility} — ${evaluation.source_url}`
    );
    return {
      status: 'evaluation_recorded',
      evaluation,
    };
  },
});

/**
 * Write the final Markdown credibility report to labs/lab-09/reports/.
 */
export const saveReportTool = tool({
  name: 'save_report',
  description:
    'Write the final credibility report as a Markdown file under the reports/ directory. Call this only after assess_credibility. Include a summary, the structured evaluation, and a clear verdict with reasoning and sources checked.',
  parameters: z.object({
    filename: z
      .string()
      .min(1)
      .describe(
        'Filename only (no directories), ending in .md. Example: reuters-ai-coding-credibility.md'
      ),
    markdown: z
      .string()
      .min(1)
      .describe('Full Markdown report content to write to disk.'),
  }),
  async execute({ filename, markdown }) {
    const safeName = path.basename(filename).replace(/[^\w.\-]+/g, '_');
    const finalName = safeName.toLowerCase().endsWith('.md')
      ? safeName
      : `${safeName}.md`;
    const outPath = path.join(REPORTS_DIR, finalName);

    logTool('save_report', outPath);
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    await fs.writeFile(outPath, markdown, 'utf-8');

    return {
      status: 'saved',
      path: outPath,
      filename: finalName,
      bytes: Buffer.byteLength(markdown, 'utf-8'),
    };
  },
});

export const credibilityTools = [
  readUrlTool,
  webSearchTool,
  assessCredibilityTool,
  saveReportTool,
];
