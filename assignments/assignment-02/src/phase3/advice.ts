import { debugLog } from '../lib/logger.js';
import {
  ApplicationAdviceSchema,
  applicationAdviceJsonSchema,
  type ApplicationAdvice,
  type FitAssessment,
  type LegitimacyAssessment,
} from '../schemas/application.js';
import type { GapAnalysis } from '../schemas/gap.js';
import type { JobPosting } from '../schemas/job.js';
import type { Resume } from '../schemas/resume.js';
import { runStructured } from '../tools/llm.js';

/**
 * Produce posting-specific resume, cover letter, and interview advice.
 */
export async function generateApplicationAdvice(options: {
  job: JobPosting;
  resume: Resume;
  fit: FitAssessment;
  legitimacy: LegitimacyAssessment;
  gap?: GapAnalysis | null;
}): Promise<ApplicationAdvice> {
  const { job, resume, fit, legitimacy, gap } = options;

  const advice = await runStructured({
    label: 'application-advice',
    schemaName: 'application_advice',
    jsonSchema: applicationAdviceJsonSchema as unknown as Record<string, unknown>,
    zodSchema: ApplicationAdviceSchema,
    tools: 'none',
    system: [
      'You give concrete application advice tailored to ONE job posting and ONE resume.',
      'resume_adaptation: specific bullets — what to reorder, quantify, keyword-mirror, or add from projects/experience.',
      'cover_letter_guidance: 4–8 actionable points (hook, role fit, proof stories, company why, close). Not a full letter unless a short outline helps.',
      'interview_prep: likely questions for THIS role, skills to brush up, company research topics, and talking points grounded in the resume.',
      'Reference the posting\'s required skills and responsibilities by name.',
      'If legitimacy is yellow/red, include one safety-minded note in cover_letter_guidance or talking_points (verify contact channel) without making the whole advice about scams.',
      'Be specific to this company and title — no generic filler.',
    ].join(' '),
    user: [
      'JOB POSTING JSON:',
      JSON.stringify(job, null, 2),
      '',
      'RESUME JSON:',
      JSON.stringify(resume, null, 2),
      '',
      'FIT ASSESSMENT:',
      JSON.stringify(fit, null, 2),
      '',
      'LEGITIMACY ASSESSMENT:',
      JSON.stringify(legitimacy, null, 2),
      '',
      gap
        ? `GAP ANALYSIS:\n${JSON.stringify(gap, null, 2)}`
        : 'GAP ANALYSIS: not available',
    ].join('\n'),
  });

  debugLog(
    `Advice: resume tips=${advice.resume_adaptation.length}, cover=${advice.cover_letter_guidance.length}, questions=${advice.interview_prep.likely_questions.length}`
  );

  return advice;
}
