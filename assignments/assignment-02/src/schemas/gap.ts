import { z } from 'zod';

export const GapItemSchema = z.object({
  skill_or_qualification: z.string(),
  why_it_matters: z.string(),
  evidence_from_market: z.string(),
  triage_level: z.enum(['quick_win', 'short_term', 'medium_term', 'long_term']),
  actionable_advice: z.string(),
});

export const GapAnalysisSchema = z.object({
  strengths: z.array(
    z.object({
      item: z.string(),
      why: z.string(),
    })
  ),
  gaps: z.array(GapItemSchema),
  unique_value: z.array(
    z.object({
      item: z.string(),
      why: z.string(),
    })
  ),
  summary: z.string(),
  generated_at: z.string().optional(),
});

export type GapAnalysis = z.infer<typeof GapAnalysisSchema>;

export const gapAnalysisJsonSchema = {
  type: 'object',
  properties: {
    strengths: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['item', 'why'],
        additionalProperties: false,
      },
    },
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skill_or_qualification: { type: 'string' },
          why_it_matters: { type: 'string' },
          evidence_from_market: { type: 'string' },
          triage_level: {
            type: 'string',
            enum: ['quick_win', 'short_term', 'medium_term', 'long_term'],
          },
          actionable_advice: { type: 'string' },
        },
        required: [
          'skill_or_qualification',
          'why_it_matters',
          'evidence_from_market',
          'triage_level',
          'actionable_advice',
        ],
        additionalProperties: false,
      },
    },
    unique_value: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['item', 'why'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string' },
  },
  required: ['strengths', 'gaps', 'unique_value', 'summary'],
  additionalProperties: false,
} as const;
