import { z } from 'zod';

export const WorkExperienceSchema = z.object({
  role: z.string(),
  company: z.string(),
  duration: z.string().nullable(),
  responsibilities: z.array(z.string()),
  achievements: z.array(z.string()),
});

export const ResumeSchema = z.object({
  candidate_name: z.string().nullable(),
  hard_skills: z.array(z.string()),
  soft_skills: z.array(z.string()),
  work_experience: z.array(WorkExperienceSchema),
  education: z.array(
    z.object({
      degree: z.string().nullable(),
      institution: z.string().nullable(),
      relevant_coursework: z.array(z.string()),
    })
  ),
  certifications: z.array(z.string()),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      technologies: z.array(z.string()),
    })
  ),
  keywords_and_domain_expertise: z.array(z.string()),
  extracted_at: z.string().optional(),
  source_file: z.string().optional(),
});

export type Resume = z.infer<typeof ResumeSchema>;

export const resumeJsonSchema = {
  type: 'object',
  properties: {
    candidate_name: { type: ['string', 'null'] },
    hard_skills: { type: 'array', items: { type: 'string' } },
    soft_skills: { type: 'array', items: { type: 'string' } },
    work_experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          company: { type: 'string' },
          duration: { type: ['string', 'null'] },
          responsibilities: { type: 'array', items: { type: 'string' } },
          achievements: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'role',
          'company',
          'duration',
          'responsibilities',
          'achievements',
        ],
        additionalProperties: false,
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          degree: { type: ['string', 'null'] },
          institution: { type: ['string', 'null'] },
          relevant_coursework: { type: 'array', items: { type: 'string' } },
        },
        required: ['degree', 'institution', 'relevant_coursework'],
        additionalProperties: false,
      },
    },
    certifications: { type: 'array', items: { type: 'string' } },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          technologies: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'description', 'technologies'],
        additionalProperties: false,
      },
    },
    keywords_and_domain_expertise: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'candidate_name',
    'hard_skills',
    'soft_skills',
    'work_experience',
    'education',
    'certifications',
    'projects',
    'keywords_and_domain_expertise',
  ],
  additionalProperties: false,
} as const;
