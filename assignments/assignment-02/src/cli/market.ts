#!/usr/bin/env node
import path from 'node:path';

import '../lib/env.js';
import { extractJobFromPdf } from '../extract/job.js';
import { listFiles } from '../lib/files.js';
import { error, info, setDebug, warn } from '../lib/logger.js';
import { PATHS } from '../lib/paths.js';
import { generateMarketAnalysis, loadAllJobs } from '../phase1/market.js';

function parseArgs(argv: string[]) {
  const args = {
    force: false,
    skipResearch: false,
    jobsDir: PATHS.inputsJobs,
    verbose: false,
  };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--skip-research') args.skipResearch = true;
    else if (a === '--verbose' || a === '--debug') args.verbose = true;
    else if (a === '--jobs-dir') args.jobsDir = path.resolve(argv[++i] ?? '');
    else if (a.startsWith('-')) {
      throw new Error(`Unknown flag: ${a}`);
    } else positional.push(a);
  }
  return { ...args, positional };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.verbose) setDebug(true);

  info('Phase 1: Job Market Analysis');
  const pdfs =
    opts.positional.length > 0
      ? opts.positional.map((p) => path.resolve(p))
      : await listFiles(opts.jobsDir, ['.pdf', '.txt', '.md']);

  if (pdfs.length === 0) {
    throw new Error(
      `No job postings found in ${opts.jobsDir}. Drop PDF/TXT files there (need 8+).`
    );
  }

  info(`Found ${pdfs.length} posting file(s)`);
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of pdfs) {
    try {
      const result = await extractJobFromPdf(file, {
        force: opts.force,
        skipResearch: opts.skipResearch,
      });
      if (result.skipped) skipped += 1;
      else processed += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      warn(`Failed on ${file}: ${message}`);
    }
  }

  info(`Extraction done — new=${processed} skipped=${skipped} failed=${failed}`);

  const jobs = await loadAllJobs();
  if (jobs.length < 8) {
    warn(
      `Only ${jobs.length} job JSON file(s) in data/jobs (assignment asks for 8+). Continuing anyway.`
    );
  }

  await generateMarketAnalysis(jobs);
  info('Phase 1 complete.');
}

main().catch((err) => {
  error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
