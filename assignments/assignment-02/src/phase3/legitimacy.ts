import { Agent, Runner, tool } from '@openai/agents';
import { z } from 'zod';

import { getOpenRouterApiKey, resolveModelName } from '../lib/env.js';
import { debugLog, warn } from '../lib/logger.js';
import {
  LegitimacyAssessmentSchema,
  legitimacyJsonSchema,
  type LegitimacyAssessment,
} from '../schemas/application.js';
import type { JobPosting } from '../schemas/job.js';
import { runStructured } from '../tools/llm.js';
import { webSearch } from '../tools/webSearch.js';
import { whoisLookup } from '../tools/whois.js';
import { OpenRouterModelProvider } from './provider.js';

const MAX_TURNS = 12;

const agentWebSearch = tool({
  name: 'web_search',
  description:
    'Search the web for company careers pages, domain ownership, scam reports, Glassdoor/LinkedIn presence, and contact-email domain matches. Prefer specific queries.',
  parameters: z.object({
    query: z.string().min(1).describe('Search query'),
  }),
  async execute({ query }) {
    const result = await webSearch(query);
    return result;
  },
});

const agentWhois = tool({
  name: 'whois_lookup',
  description:
    'Look up WHOIS/domain registration data for a company domain (e.g. acmecorp.com). Returns registration date, registrar, org if available.',
  parameters: z.object({
    domain: z
      .string()
      .min(1)
      .describe('Domain name without path, e.g. acmecorp.com'),
  }),
  async execute({ domain }) {
    const result = await whoisLookup(domain);
    return result;
  },
});

const LEGITIMACY_INSTRUCTIONS = [
  'You investigate whether a job posting looks legitimate or like a scam/phishing risk.',
  'Use web_search and whois_lookup. Do not invent facts — if a tool fails, note that and continue.',
  '',
  'Investigate these red flags when relevant:',
  '- Asks for PII early (SSN, bank details, copies of ID) before an interview',
  '- Very new domain / recently registered company site',
  '- Contact email domain mismatches the company name/brand',
  '- No careers page / company website hard to find',
  '- Salary wildly above market for the role/level',
  '- Extremely vague JD with urgency pressure or "work from home easy money"',
  '- Poor grammar, copy-paste templates, unpaid "training fees"',
  '',
  'Investigate green flags:',
  '- Established company with LinkedIn/careers presence',
  '- Domain age and WHOIS consistent with brand',
  '- Contact email matches company domain',
  '- Realistic salary vs market; clear responsibilities',
  '',
  'After investigation, write a concise evidence summary (bullet points of what you found).',
  'Focus on whether THIS JOB POSTING is a scam/phishing risk — not general corporate controversies, lawsuits, or market-manipulation news unless they imply the posting itself is fake.',
  'Redacted or incomplete WHOIS alone is neutral if the company has a strong verified web presence.',
  'Do not output final JSON — a separate structured step will score the assessment.',
].join('\n');

function jobSummary(job: JobPosting): string {
  return [
    `Title: ${job.job_title}`,
    `Company: ${job.company_name}`,
    `Location: ${job.location ?? 'not listed'}`,
    `Remote: ${job.remote_status}`,
    `Salary: ${job.salary_range ?? 'not listed'}`,
    `Experience: ${job.experience_level ?? 'not listed'}`,
    `Required skills: ${job.required_skills.join(', ') || 'none listed'}`,
    `Responsibilities: ${job.key_responsibilities.slice(0, 8).join('; ')}`,
    job.company_research
      ? `Prior research notes: ${JSON.stringify(job.company_research)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function gatherInvestigationNotes(job: JobPosting): Promise<string> {
  const modelName = resolveModelName();
  const provider = new OpenRouterModelProvider(getOpenRouterApiKey(), modelName);
  const runner = new Runner({ modelProvider: provider });

  const agent = new Agent({
    name: 'Job Legitimacy Investigator',
    instructions: LEGITIMACY_INSTRUCTIONS,
    tools: [agentWebSearch, agentWhois],
    model: modelName,
  });

  const userPrompt = [
    'Investigate legitimacy of this job posting.',
    'Identify a likely company domain, check WHOIS age, search for careers page and scam reports.',
    '',
    jobSummary(job),
  ].join('\n');

  debugLog(`Legitimacy agent starting (maxTurns=${MAX_TURNS}, model=${modelName})`);
  const result = await runner.run(agent, userPrompt, { maxTurns: MAX_TURNS });
  const notes = String(result.finalOutput ?? '').trim();
  debugLog(
    `Legitimacy agent finished; notes length=${notes.length}; items=${result.newItems?.length ?? 0}`
  );
  return notes || '(Agent produced no summary; score from posting text and available research only.)';
}

/**
 * Investigate posting legitimacy with an Agents SDK tool loop, then
 * produce a Zod-validated LegitimacyAssessment via structured output.
 */
export async function assessLegitimacy(
  job: JobPosting
): Promise<LegitimacyAssessment> {
  let investigationNotes = '';
  try {
    investigationNotes = await gatherInvestigationNotes(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warn(`Legitimacy agent failed (continuing with structured fallback): ${message}`);
    investigationNotes = `Agent investigation unavailable: ${message}. Assess from posting content and optional web/WHOIS tools.`;
  }

  try {
    const assessment = await runStructured({
      label: 'legitimacy-assessment',
      schemaName: 'legitimacy_assessment',
      jsonSchema: legitimacyJsonSchema as unknown as Record<string, unknown>,
      zodSchema: LegitimacyAssessmentSchema,
      tools: 'web_and_whois',
      maxToolIterations: 6,
      system: [
        'You produce a structured legitimacy assessment for a job posting.',
        'Verdict: green (looks legitimate), yellow (caution/unclear), red (strong scam/phishing risk).',
        'Each signal must include type (red|green|neutral), signal name, and evidence.',
        'confidence is 0–1 based on how much evidence you have.',
        'company_domain is the best inferred domain or null.',
        'recommendation should tell the applicant what to do next (verify careers page, avoid sharing PII, etc.).',
        'If research/WHOIS failed, reflect uncertainty (prefer yellow over inventing red/green).',
        'Do not invent company facts not supported by the posting or tool results.',
      ].join(' '),
      user: [
        'JOB POSTING:',
        jobSummary(job),
        '',
        'INVESTIGATION NOTES FROM AGENT:',
        investigationNotes,
        '',
        'Optionally use web_search / whois_lookup to fill gaps, then return the legitimacy assessment JSON.',
      ].join('\n'),
    });

    for (const signal of assessment.signals) {
      debugLog(
        `Legitimacy signal [${signal.type}] ${signal.signal}: ${signal.evidence.slice(0, 200)}`
      );
    }
    debugLog(
      `Legitimacy verdict=${assessment.verdict} confidence=${assessment.confidence} domain=${assessment.company_domain ?? 'null'}`
    );

    return assessment;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warn(`Legitimacy structured assessment failed: ${message}`);
    return {
      verdict: 'yellow',
      confidence: 0.2,
      signals: [
        {
          type: 'neutral',
          signal: 'assessment_degraded',
          evidence: `Could not complete full legitimacy check: ${message}`,
        },
      ],
      recommendation:
        'Proceed with caution. Verify the company careers page and contact email yourself before applying or sharing personal information.',
      company_domain: null,
    };
  }
}
