import { z } from 'zod';

export const CompanyResearchSchema = z.object({
  company_size: z.string().nullable().describe('Employee count / size band, or null'),
  industry: z.string().nullable(),
  recent_news: z.array(z.string()).describe('Short bullet summaries of recent news'),
  culture_signals: z.array(z.string()).describe('Culture signals from reviews, blogs, etc.'),
  sources: z.array(z.string()).describe('URLs or source titles consulted'),
  notes: z.string().nullable().describe('Any caveats about research quality'),
});

export type CompanyResearch = z.infer<typeof CompanyResearchSchema>;

export const JobPostingSchema = z.object({
  job_title: z.string(),
  company_name: z.string(),
  location: z.string().nullable().describe('City/region or null if not listed'),
  remote_status: z
    .enum(['remote', 'hybrid', 'onsite', 'not_listed'])
    .describe('Remote / hybrid / onsite / not_listed'),
  posting_age_days: z
    .number()
    .int()
    .nullable()
    .describe('Days since posted; null if date unknown'),
  posting_date_note: z
    .string()
    .nullable()
    .describe('How age was determined, or limitation note'),
  required_skills: z.array(z.string()),
  preferred_skills: z.array(z.string()),
  experience_level: z
    .string()
    .nullable()
    .describe('Years / seniority as stated, or null'),
  education_requirements: z.string().nullable(),
  salary_range: z.string().nullable().describe('As listed, or null if not listed'),
  key_responsibilities: z.array(z.string()),
  source_file: z.string().optional(),
  slug: z.string().optional(),
  company_research: CompanyResearchSchema.optional(),
  extracted_at: z.string().optional(),
});

export type JobPosting = z.infer<typeof JobPostingSchema>;

/** Strict JSON Schema for OpenAI structured outputs */
export const jobPostingJsonSchema = {
  type: 'object',
  properties: {
    job_title: { type: 'string' },
    company_name: { type: 'string' },
    location: { type: ['string', 'null'] },
    remote_status: {
      type: 'string',
      enum: ['remote', 'hybrid', 'onsite', 'not_listed'],
    },
    posting_age_days: { type: ['integer', 'null'] },
    posting_date_note: { type: ['string', 'null'] },
    required_skills: { type: 'array', items: { type: 'string' } },
    preferred_skills: { type: 'array', items: { type: 'string' } },
    experience_level: { type: ['string', 'null'] },
    education_requirements: { type: ['string', 'null'] },
    salary_range: { type: ['string', 'null'] },
    key_responsibilities: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'job_title',
    'company_name',
    'location',
    'remote_status',
    'posting_age_days',
    'posting_date_note',
    'required_skills',
    'preferred_skills',
    'experience_level',
    'education_requirements',
    'salary_range',
    'key_responsibilities',
  ],
  additionalProperties: false,
} as const;

export const companyResearchJsonSchema = {
  type: 'object',
  properties: {
    company_size: { type: ['string', 'null'] },
    industry: { type: ['string', 'null'] },
    recent_news: { type: 'array', items: { type: 'string' } },
    culture_signals: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'string' } },
    notes: { type: ['string', 'null'] },
  },
  required: [
    'company_size',
    'industry',
    'recent_news',
    'culture_signals',
    'sources',
    'notes',
  ],
  additionalProperties: false,
} as const;
