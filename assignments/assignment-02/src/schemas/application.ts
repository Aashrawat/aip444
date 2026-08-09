import { z } from 'zod';

export const LegitimacySignalSchema = z.object({
  type: z.enum(['red', 'green', 'neutral']),
  signal: z.string(),
  evidence: z.string(),
});

export const LegitimacyAssessmentSchema = z.object({
  verdict: z.enum(['green', 'yellow', 'red']),
  confidence: z.number().min(0).max(1),
  signals: z.array(LegitimacySignalSchema),
  recommendation: z.string(),
  company_domain: z.string().nullable(),
});

export type LegitimacyAssessment = z.infer<typeof LegitimacyAssessmentSchema>;

export const legitimacyJsonSchema = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['green', 'yellow', 'red'] },
    confidence: { type: 'number' },
    signals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['red', 'green', 'neutral'] },
          signal: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['type', 'signal', 'evidence'],
        additionalProperties: false,
      },
    },
    recommendation: { type: 'string' },
    company_domain: { type: ['string', 'null'] },
  },
  required: [
    'verdict',
    'confidence',
    'signals',
    'recommendation',
    'company_domain',
  ],
  additionalProperties: false,
} as const;

export const FitAssessmentSchema = z.object({
  overall_score: z.number().min(0).max(100),
  band: z.enum(['strong', 'good', 'stretch', 'growth_target']),
  recommendation: z.string(),
  requirements_met: z.array(z.string()),
  requirements_partial: z.array(z.string()),
  requirements_missing: z.array(z.string()),
  scoring_notes: z.array(z.string()),
});

export type FitAssessment = z.infer<typeof FitAssessmentSchema>;

export const fitAssessmentJsonSchema = {
  type: 'object',
  properties: {
    overall_score: { type: 'number' },
    band: {
      type: 'string',
      enum: ['strong', 'good', 'stretch', 'growth_target'],
    },
    recommendation: { type: 'string' },
    requirements_met: { type: 'array', items: { type: 'string' } },
    requirements_partial: { type: 'array', items: { type: 'string' } },
    requirements_missing: { type: 'array', items: { type: 'string' } },
    scoring_notes: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'overall_score',
    'band',
    'recommendation',
    'requirements_met',
    'requirements_partial',
    'requirements_missing',
    'scoring_notes',
  ],
  additionalProperties: false,
} as const;

export const ApplicationAdviceSchema = z.object({
  resume_adaptation: z.array(z.string()),
  cover_letter_guidance: z.array(z.string()),
  interview_prep: z.object({
    likely_questions: z.array(z.string()),
    skills_to_brush_up: z.array(z.string()),
    company_research_topics: z.array(z.string()),
    talking_points: z.array(z.string()),
  }),
});

export type ApplicationAdvice = z.infer<typeof ApplicationAdviceSchema>;

export const applicationAdviceJsonSchema = {
  type: 'object',
  properties: {
    resume_adaptation: { type: 'array', items: { type: 'string' } },
    cover_letter_guidance: { type: 'array', items: { type: 'string' } },
    interview_prep: {
      type: 'object',
      properties: {
        likely_questions: { type: 'array', items: { type: 'string' } },
        skills_to_brush_up: { type: 'array', items: { type: 'string' } },
        company_research_topics: { type: 'array', items: { type: 'string' } },
        talking_points: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'likely_questions',
        'skills_to_brush_up',
        'company_research_topics',
        'talking_points',
      ],
      additionalProperties: false,
    },
  },
  required: [
    'resume_adaptation',
    'cover_letter_guidance',
    'interview_prep',
  ],
  additionalProperties: false,
} as const;
