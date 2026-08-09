import { writeJson } from '../lib/files.js';
import { debugLog, info } from '../lib/logger.js';
import { PATHS } from '../lib/paths.js';
import {
  GapAnalysisSchema,
  gapAnalysisJsonSchema,
  type GapAnalysis,
} from '../schemas/gap.js';
import type { MarketAnalysis } from '../schemas/market.js';
import type { Resume } from '../schemas/resume.js';
import { runMarkdownGeneration, runStructured } from '../tools/llm.js';

export async function generateGapAnalysis(
  resume: Resume,
  market: MarketAnalysis
): Promise<{ analysis: GapAnalysis; markdown: string }> {
  debugLog('Generating gap analysis vs market');

  const analysis = await runStructured({
    label: 'gap-analysis',
    schemaName: 'gap_analysis',
    jsonSchema: gapAnalysisJsonSchema as unknown as Record<string, unknown>,
    zodSchema: GapAnalysisSchema,
    tools: 'web',
    maxToolIterations: 6,
    system: [
      'You compare a candidate resume against aggregated job-market demand.',
      'Identify strengths (skills the market wants that the candidate has),',
      'gaps (frequent market asks missing or weak on the resume),',
      'and unique value (differentiating assets not commonly listed).',
      'Triage each gap: quick_win | short_term | medium_term | long_term.',
      'Advice must be specific and actionable (not "learn AWS" — name a cert/course/project with rough effort).',
      'You MUST call web_search at least once to verify a concrete certification, course, or learning resource before finalizing short_term or medium_term gap advice.',
      'Encourage realistic progress; do not demoralize.',
    ].join(' '),
    user: [
      'RESUME JSON:',
      JSON.stringify(resume, null, 2),
      '',
      'MARKET ANALYSIS JSON:',
      JSON.stringify(market, null, 2),
    ].join('\n'),
  });

  const withMeta: GapAnalysis = {
    ...analysis,
    generated_at: new Date().toISOString(),
  };

  await writeJson(PATHS.gapAnalysisJson, withMeta);
  info(`Wrote ${PATHS.gapAnalysisJson}`);

  const markdown = await runMarkdownGeneration({
    label: 'gap-analysis-md',
    system:
      'Write a practical Markdown gap-analysis report. Group gaps by triage level. Be specific. No JSON fences.',
    user: [
      'Produce the gap analysis report from this structured data:',
      JSON.stringify(withMeta, null, 2),
      '',
      'Sections: Summary, Strengths, Unique value, Gaps by triage (Quick wins, Short-term, Medium-term, Long-term), Suggested 30-day plan.',
    ].join('\n'),
  });

  const { default: fs } = await import('node:fs/promises');
  await fs.writeFile(PATHS.gapAnalysisMd, markdown.trim() + '\n', 'utf8');
  info(`Wrote ${PATHS.gapAnalysisMd}`);

  return { analysis: withMeta, markdown };
}
