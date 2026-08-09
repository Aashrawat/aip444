#!/usr/bin/env node
import path from 'node:path';

import '../lib/env.js';
import { extractJobFromPdf } from '../extract/job.js';
import { fileExists, readJson } from '../lib/files.js';
import { error, info, setDebug, warn } from '../lib/logger.js';
import { PATHS } from '../lib/paths.js';
import { generateApplicationAdvice } from '../phase3/advice.js';
import { assessFit } from '../phase3/fit.js';
import { assessLegitimacy } from '../phase3/legitimacy.js';
import { writeApplicationReportHtml } from '../phase3/reportHtml.js';
import type { GapAnalysis } from '../schemas/gap.js';
import type { MarketAnalysis } from '../schemas/market.js';
import type { Resume } from '../schemas/resume.js';

function usage(): never {
  console.error(`Usage:
  npm run advise -- <posting.pdf> [--verbose] [--force]

Example:
  npm run advise -- inputs/advise/role.pdf --verbose
`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const args = {
    force: false,
    verbose: false,
    posting: null as string | null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--verbose' || a === '--debug') args.verbose = true;
    else if (a === '--help' || a === '-h') usage();
    else if (a.startsWith('-')) throw new Error(`Unknown flag: ${a}`);
    else args.posting = path.resolve(a);
  }
  return args;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.posting) usage();
  if (opts.verbose) setDebug(true);

  info('Phase 3: Application Advisor');

  if (!(await fileExists(opts.posting!))) {
    throw new Error(`Posting file not found: ${opts.posting}`);
  }
  if (!(await fileExists(PATHS.marketAnalysisJson))) {
    throw new Error(
      `Missing ${PATHS.marketAnalysisJson}. Run Phase 1 first: npm run market`
    );
  }
  if (!(await fileExists(PATHS.resumeJson))) {
    throw new Error(
      `Missing ${PATHS.resumeJson}. Run Phase 2 first: npm run gaps`
    );
  }

  info(`Extracting posting: ${opts.posting}`);
  const { job, outputPath } = await extractJobFromPdf(opts.posting!, {
    force: opts.force,
  });
  info(`Job JSON: ${outputPath}`);

  const market = await readJson<MarketAnalysis>(PATHS.marketAnalysisJson);
  const resume = await readJson<Resume>(PATHS.resumeJson);

  let gap: GapAnalysis | null = null;
  if (await fileExists(PATHS.gapAnalysisJson)) {
    gap = await readJson<GapAnalysis>(PATHS.gapAnalysisJson);
  } else {
    warn(
      `Gap analysis not found at ${PATHS.gapAnalysisJson}; continuing without it.`
    );
  }

  info('Running legitimacy assessment…');
  const legitimacy = await assessLegitimacy(job);
  info(`Legitimacy verdict: ${legitimacy.verdict}`);

  info('Running fit assessment…');
  const fit = await assessFit({ job, resume, market, gap });
  info(`Fit score: ${fit.overall_score} (${fit.band})`);

  info('Generating application advice…');
  const advice = await generateApplicationAdvice({
    job,
    resume,
    fit,
    legitimacy,
    gap,
  });

  info('Building HTML report…');
  const reportPath = await writeApplicationReportHtml({
    job,
    legitimacy,
    fit,
    advice,
  });

  info(`Phase 3 complete. Open: ${reportPath}`);
}

main().catch((err) => {
  error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
