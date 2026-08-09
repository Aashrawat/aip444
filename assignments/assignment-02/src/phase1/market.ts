import { listFiles, readJson, writeJson } from '../lib/files.js';
import { debugLog, info } from '../lib/logger.js';
import { PATHS } from '../lib/paths.js';
import {
  MarketAnalysisSchema,
  marketAnalysisJsonSchema,
  type MarketAnalysis,
} from '../schemas/market.js';
import type { JobPosting } from '../schemas/job.js';
import { runMarkdownGeneration, runStructured } from '../tools/llm.js';

export async function loadAllJobs(): Promise<JobPosting[]> {
  const files = await listFiles(PATHS.dataJobs, ['.json']);
  const jobs: JobPosting[] = [];
  for (const f of files) {
    jobs.push(await readJson<JobPosting>(f));
  }
  return jobs;
}

export async function generateMarketAnalysis(
  jobs: JobPosting[]
): Promise<{ analysis: MarketAnalysis; markdown: string }> {
  if (jobs.length === 0) {
    throw new Error('No job JSON files in data/jobs. Run extraction first.');
  }

  debugLog(`Aggregating market analysis across ${jobs.length} postings`);

  const compact = jobs.map((j) => ({
    job_title: j.job_title,
    company_name: j.company_name,
    location: j.location,
    remote_status: j.remote_status,
    posting_age_days: j.posting_age_days,
    required_skills: j.required_skills,
    preferred_skills: j.preferred_skills,
    experience_level: j.experience_level,
    education_requirements: j.education_requirements,
    salary_range: j.salary_range,
    key_responsibilities: j.key_responsibilities,
    company_research: j.company_research
      ? {
          industry: j.company_research.industry,
          company_size: j.company_research.company_size,
          culture_signals: j.company_research.culture_signals.slice(0, 3),
          recent_news: j.company_research.recent_news.slice(0, 3),
        }
      : null,
  }));

  const analysis = await runStructured({
    label: 'market-analysis',
    schemaName: 'market_analysis',
    jsonSchema: marketAnalysisJsonSchema as unknown as Record<string, unknown>,
    zodSchema: MarketAnalysisSchema,
    tools: 'none',
    system: [
      'You aggregate multiple extracted job postings into a market analysis.',
      'Count skill frequencies carefully. Note patterns in experience, education, salary, remote work, and culture.',
      'Do not invent salaries or skills not present in the inputs.',
    ].join(' '),
    user: [
      `Analyze these ${jobs.length} job postings (JSON):`,
      JSON.stringify(compact, null, 2),
    ].join('\n'),
  });

  const withMeta: MarketAnalysis = {
    ...analysis,
    posting_count: jobs.length,
    generated_at: new Date().toISOString(),
  };

  await writeJson(PATHS.marketAnalysisJson, withMeta);
  info(`Wrote ${PATHS.marketAnalysisJson}`);

  const markdown = await runMarkdownGeneration({
    label: 'market-analysis-md',
    system:
      'Write a clear Markdown market analysis report for a job seeker. Use headings, bullet lists, and concrete observations. No JSON fences.',
    user: [
      'Turn this structured market analysis into a detailed Markdown report.',
      'Include sections: Overview, Skills demand, Experience & education, Compensation, Responsibilities & role patterns, Remote/location, Culture & industry, Trends.',
      '',
      JSON.stringify(withMeta, null, 2),
    ].join('\n'),
  });

  const { default: fs } = await import('node:fs/promises');
  await fs.writeFile(PATHS.marketAnalysisMd, markdown.trim() + '\n', 'utf8');
  info(`Wrote ${PATHS.marketAnalysisMd}`);

  return { analysis: withMeta, markdown };
}
