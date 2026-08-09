import path from 'node:path';

import {
  extractTextFromFile,
  fileExists,
  listFiles,
  readJson,
  writeJson,
} from '../lib/files.js';
import { debugLog, info, warn } from '../lib/logger.js';
import { PATHS } from '../lib/paths.js';
import { slugify, todayIsoDate } from '../lib/slug.js';
import {
  CompanyResearchSchema,
  JobPostingSchema,
  companyResearchJsonSchema,
  jobPostingJsonSchema,
  type JobPosting,
} from '../schemas/job.js';
import { runStructured } from '../tools/llm.js';

function captureDateHint(filePath: string): string {
  return [
    'If the posting uses a relative date (e.g. "Posted 3 days ago"), treat the PDF capture/file date as the reference.',
    `File: ${path.basename(filePath)}.`,
    `If capture date is unknown, use today's date (${todayIsoDate()}) as an approximation and note that in posting_date_note.`,
  ].join(' ');
}

export async function findExistingBySource(
  sourceBasename: string
): Promise<{ path: string; job: JobPosting } | null> {
  const files = await listFiles(PATHS.dataJobs, ['.json']);
  for (const f of files) {
    try {
      const data = await readJson<JobPosting>(f);
      if (data.source_file === sourceBasename) {
        return { path: f, job: JobPostingSchema.parse(data) };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export async function researchCompany(
  companyName: string,
  jobTitle: string,
  postingSnippet: string
) {
  debugLog(`Researching company: ${companyName}`);
  return runStructured({
    label: `research:${companyName}`,
    schemaName: 'company_research',
    jsonSchema: companyResearchJsonSchema as unknown as Record<string, unknown>,
    zodSchema: CompanyResearchSchema,
    tools: 'web',
    maxToolIterations: 5,
    system: [
      'You research employers for job applicants using the web_search tool.',
      'Gather company size/industry, recent news (layoffs, expansions), and culture signals.',
      'Do not invent facts. If search fails or finds little, say so in notes and use null/empty arrays.',
      'Cite sources (URLs) you used.',
    ].join(' '),
    user: [
      `Company: ${companyName}`,
      `Role: ${jobTitle}`,
      'Posting snippet:',
      postingSnippet,
      '',
      'Search for this company and summarize findings into the schema.',
    ].join('\n'),
  });
}

export async function extractJobFromPdf(
  filePath: string,
  options: { force?: boolean; skipResearch?: boolean } = {}
): Promise<{ job: JobPosting; outputPath: string; skipped: boolean }> {
  const basename = path.basename(filePath);
  debugLog(`Extracting posting: ${basename}`);

  if (!options.force) {
    const existing = await findExistingBySource(basename);
    if (existing) {
      debugLog(`Skipping already-extracted job (source_file match): ${existing.path}`);
      info(`Skip (already processed): ${basename} → ${existing.path}`);
      return { job: existing.job, outputPath: existing.path, skipped: true };
    }
  }

  const text = await extractTextFromFile(filePath);
  const today = todayIsoDate();

  const extracted = await runStructured({
    label: `extract-job:${basename}`,
    schemaName: 'job_posting',
    jsonSchema: jobPostingJsonSchema as unknown as Record<string, unknown>,
    zodSchema: JobPostingSchema,
    tools: 'none',
    system: [
      'You extract structured job posting data from raw text.',
      'Use ONLY information present in the posting. Never invent salary, skills, or dates.',
      'If a field is missing, use null or an empty array as appropriate.',
      `Today's date is ${today}. Use it to compute posting_age_days from any absolute or relative posting date.`,
      'salary_range must be null when not listed (do not guess market rates).',
    ].join(' '),
    user: [
      captureDateHint(filePath),
      '',
      'Extract the job posting fields from this text:',
      '---',
      text.slice(0, 60_000),
      '---',
    ].join('\n'),
  });

  const slug = slugify([extracted.job_title, extracted.company_name]);
  const outputPath = path.join(PATHS.dataJobs, `${slug}.json`);

  if (!options.force && (await fileExists(outputPath))) {
    debugLog(`Output slug already exists, skipping overwrite: ${slug}.json`);
    const existing = JobPostingSchema.parse(await readJson(outputPath));
    info(`Skip (slug exists): ${basename} → ${outputPath}`);
    return { job: existing, outputPath, skipped: true };
  }

  debugLog(
    `Extracted ${extracted.required_skills.length} required skills, ${extracted.preferred_skills.length} preferred skills`
  );
  debugLog(`Salary field: ${extracted.salary_range ?? 'not found in posting'}`);
  debugLog(
    `posting_age_days: ${
      extracted.posting_age_days === null ? 'null' : extracted.posting_age_days
    }` + (extracted.posting_date_note ? ` (${extracted.posting_date_note})` : '')
  );

  let company_research = extracted.company_research;
  if (!options.skipResearch) {
    try {
      company_research = await researchCompany(
        extracted.company_name,
        extracted.job_title,
        text.slice(0, 2000)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      warn(`Company research failed for ${extracted.company_name}: ${message}`);
      company_research = {
        company_size: null,
        industry: null,
        recent_news: [],
        culture_signals: [],
        sources: [],
        notes: `Research failed: ${message}`,
      };
    }
  }

  const job: JobPosting = {
    ...extracted,
    slug,
    source_file: basename,
    extracted_at: new Date().toISOString(),
    company_research,
  };

  await writeJson(outputPath, job);
  info(`Wrote ${outputPath}`);
  return { job, outputPath, skipped: false };
}
