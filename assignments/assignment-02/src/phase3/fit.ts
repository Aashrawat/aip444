import { debugLog } from '../lib/logger.js';
import {
  FitAssessmentSchema,
  fitAssessmentJsonSchema,
  type FitAssessment,
} from '../schemas/application.js';
import type { GapAnalysis } from '../schemas/gap.js';
import type { JobPosting } from '../schemas/job.js';
import type { MarketAnalysis } from '../schemas/market.js';
import type { Resume } from '../schemas/resume.js';
import { runStructured } from '../tools/llm.js';

function bandFromScore(score: number): FitAssessment['band'] {
  if (score >= 80) return 'strong';
  if (score >= 50) return 'good';
  if (score >= 30) return 'stretch';
  return 'growth_target';
}

/**
 * Score how well the resume fits this posting (encouraging, never bleak).
 */
export async function assessFit(options: {
  job: JobPosting;
  resume: Resume;
  market: MarketAnalysis;
  gap?: GapAnalysis | null;
}): Promise<FitAssessment> {
  const { job, resume, market, gap } = options;

  const raw = await runStructured({
    label: 'fit-assessment',
    schemaName: 'fit_assessment',
    jsonSchema: fitAssessmentJsonSchema as unknown as Record<string, unknown>,
    zodSchema: FitAssessmentSchema,
    tools: 'none',
    system: [
      'You assess resume–job fit for a specific posting.',
      'Score overall_score 0–100. Bands MUST match score:',
      '  strong = 80+, good = 50–79, stretch = 30–49, growth_target = 0–29.',
      'List requirements_met, requirements_partial, requirements_missing with concrete items from the JD.',
      'scoring_notes: short bullets explaining the score breakdown.',
      'Tone: encourage applying when there is any reasonable path.',
      'Never say "don\'t apply" for marginal/stretch matches — frame as stretch or growth opportunity with how to position yourself.',
      'Only discourage applying if the role is a clear mismatch in seniority/domain with no transferable path (still stay constructive).',
      'Use market context for calibration, not as a hard filter.',
    ].join(' '),
    user: [
      'JOB POSTING JSON:',
      JSON.stringify(job, null, 2),
      '',
      'RESUME JSON:',
      JSON.stringify(resume, null, 2),
      '',
      'MARKET ANALYSIS JSON:',
      JSON.stringify(market, null, 2),
      '',
      gap
        ? `GAP ANALYSIS JSON:\n${JSON.stringify(gap, null, 2)}`
        : 'GAP ANALYSIS: not available',
    ].join('\n'),
  });

  const overall = Math.max(0, Math.min(100, Number(raw.overall_score)));
  const band = bandFromScore(overall);
  const assessment: FitAssessment = {
    ...raw,
    overall_score: overall,
    band,
  };

  debugLog(
    `Fit score=${assessment.overall_score} band=${assessment.band} (llm band was ${raw.band})`
  );
  debugLog(`Fit met=${assessment.requirements_met.length} partial=${assessment.requirements_partial.length} missing=${assessment.requirements_missing.length}`);
  for (const note of assessment.scoring_notes) {
    debugLog(`Fit note: ${note}`);
  }

  return assessment;
}
