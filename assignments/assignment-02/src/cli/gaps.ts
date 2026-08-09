#!/usr/bin/env node
import path from 'node:path';

import '../lib/env.js';
import { extractResume, findResumeInput } from '../extract/resume.js';
import { fileExists, readJson } from '../lib/files.js';
import { error, info, setDebug } from '../lib/logger.js';
import { PATHS } from '../lib/paths.js';
import { generateGapAnalysis } from '../phase2/gaps.js';
import type { MarketAnalysis } from '../schemas/market.js';

function parseArgs(argv: string[]) {
  const args = {
    force: false,
    resumePath: null as string | null,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--verbose' || a === '--debug') args.verbose = true;
    else if (a === '--resume') args.resumePath = path.resolve(argv[++i] ?? '');
    else if (a.startsWith('-')) throw new Error(`Unknown flag: ${a}`);
    else args.resumePath = path.resolve(a);
  }
  return args;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.verbose) setDebug(true);

  info('Phase 2: Resume Gap Analysis');

  if (!(await fileExists(PATHS.marketAnalysisJson))) {
    throw new Error(
      `Missing ${PATHS.marketAnalysisJson}. Run Phase 1 first: npm run market`
    );
  }

  const resumePath = opts.resumePath ?? (await findResumeInput());
  const { resume } = await extractResume(resumePath, { force: opts.force });
  const market = await readJson<MarketAnalysis>(PATHS.marketAnalysisJson);

  await generateGapAnalysis(resume, market);
  info('Phase 2 complete.');
}

main().catch((err) => {
  error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
