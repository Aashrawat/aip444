import { z } from 'zod';

export const SourceTypeSchema = z
  .enum([
    'peer_reviewed_journal',
    'news_organization',
    'government_agency',
    'nonprofit_organization',
    'corporate_blog',
    'personal_blog',
    'social_media',
    'wiki',
    'unknown',
  ])
  .describe(
    'Best-fit category for the source. Use unknown only after investigation fails to classify it.'
  );

export const EditorialProcessSchema = z
  .enum(['peer_reviewed', 'editor_reviewed', 'self_published', 'unknown'])
  .describe(
    'How content is reviewed before publication. Use unknown if you could not determine this.'
  );

export const PrimaryVsSecondarySchema = z
  .enum(['primary_source', 'secondary_source', 'tertiary_source'])
  .describe(
    'primary_source = original data/research/official release; secondary_source = reporting or analysis of others; tertiary_source = summaries/encyclopedias/wikis.'
  );

export const OverallCredibilitySchema = z
  .enum(['high', 'medium', 'low', 'very_low'])
  .describe(
    'Overall credibility verdict based on evidence — not surface appearance. Defaults: government/major news with verified claims → high; vendor/advocacy blogs → medium; personal_blog / self-published opinion / anecdote → low; known misinformation outlets, predatory journals, or deceptive mimic-news → very_low. Do not inflate personal blogs to medium just because prose is polished.'
  );

export const AuthorSchema = z.object({
  name: z
    .string()
    .describe(
      'Author name. If unknown after investigation, write "Unknown" and explain what you checked.'
    ),
  credentials: z
    .string()
    .describe(
      'Qualifications, affiliations, or expertise relevant to the topic. If not found, describe what you searched for.'
    ),
  credibility_assessment: z
    .string()
    .describe(
      'Assessment of author credibility for this topic. If unknown, explain how that affects the overall rating.'
    ),
});

export const PublicationSchema = z.object({
  name: z
    .string()
    .describe(
      'Publication or website name. If not a recognized outlet, use the domain name.'
    ),
  reputation: z
    .string()
    .describe(
      'What research revealed about this publication. If unknown, describe what you searched for.'
    ),
  editorial_process: EditorialProcessSchema,
});

export const ContentAnalysisSchema = z.object({
  claims_supported_by_evidence: z
    .boolean()
    .describe(
      'True if the main claims are backed by data, citations, or primary sources you could inspect.'
    ),
  sources_cited: z
    .boolean()
    .describe('True if the article cites its sources (links, footnotes, references).'),
  corroborated_by_other_sources: z
    .boolean()
    .describe(
      'True if you found other credible sources reporting the same key claims.'
    ),
  contradicted_by_other_sources: z
    .boolean()
    .describe(
      'True if you found credible sources that contradict the key claims.'
    ),
  primary_vs_secondary: PrimaryVsSecondarySchema,
  funding_or_sponsorship: z
    .string()
    .describe(
      'Evidence of who funds the publication or research. If none found, say so explicitly.'
    ),
  date_published: z
    .string()
    .describe(
      'When was this published? Note whether the information still appears current.'
    ),
});

/**
 * Structured credibility rubric used by the assess_credibility "think" tool.
 * Field descriptions guide the agent; the schema forces a complete evaluation.
 */
export const CredibilityEvaluationSchema = z.object({
  source_url: z
    .string()
    .min(1)
    .describe('The URL being evaluated (full http/https URL).'),
  source_type: SourceTypeSchema,
  author: AuthorSchema,
  publication: PublicationSchema,
  content_analysis: ContentAnalysisSchema,
  transparency_score: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      '1–5 rating of how transparent the source is about authorship, methods, and funding.'
    ),
  overall_credibility: OverallCredibilitySchema,
  reasoning: z
    .string()
    .describe(
      'Explain the overall credibility rating, citing specific evidence from your research. Do not invent facts.'
    ),
});

export type CredibilityEvaluation = z.infer<typeof CredibilityEvaluationSchema>;
