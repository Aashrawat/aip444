import { z } from 'zod';

export const MarketAnalysisSchema = z.object({
  posting_count: z.number().int(),
  most_common_required_skills: z.array(
    z.object({ skill: z.string(), count: z.number().int() })
  ),
  most_common_preferred_skills: z.array(
    z.object({ skill: z.string(), count: z.number().int() })
  ),
  typical_experience_levels: z.array(z.string()),
  education_patterns: z.array(z.string()),
  salary_observations: z.array(z.string()),
  common_responsibilities: z.array(z.string()),
  remote_work_patterns: z.array(z.string()),
  industry_and_culture_notes: z.array(z.string()),
  notable_trends: z.array(z.string()),
  companies_analyzed: z.array(z.string()),
  generated_at: z.string().optional(),
});

export type MarketAnalysis = z.infer<typeof MarketAnalysisSchema>;

export const marketAnalysisJsonSchema = {
  type: 'object',
  properties: {
    posting_count: { type: 'integer' },
    most_common_required_skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skill: { type: 'string' },
          count: { type: 'integer' },
        },
        required: ['skill', 'count'],
        additionalProperties: false,
      },
    },
    most_common_preferred_skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skill: { type: 'string' },
          count: { type: 'integer' },
        },
        required: ['skill', 'count'],
        additionalProperties: false,
      },
    },
    typical_experience_levels: { type: 'array', items: { type: 'string' } },
    education_patterns: { type: 'array', items: { type: 'string' } },
    salary_observations: { type: 'array', items: { type: 'string' } },
    common_responsibilities: { type: 'array', items: { type: 'string' } },
    remote_work_patterns: { type: 'array', items: { type: 'string' } },
    industry_and_culture_notes: { type: 'array', items: { type: 'string' } },
    notable_trends: { type: 'array', items: { type: 'string' } },
    companies_analyzed: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'posting_count',
    'most_common_required_skills',
    'most_common_preferred_skills',
    'typical_experience_levels',
    'education_patterns',
    'salary_observations',
    'common_responsibilities',
    'remote_work_patterns',
    'industry_and_culture_notes',
    'notable_trends',
    'companies_analyzed',
  ],
  additionalProperties: false,
} as const;
