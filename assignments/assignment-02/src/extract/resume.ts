import path from 'node:path';

import {
  extractTextFromFile,
  fileExists,
  listFiles,
  writeJson,
} from '../lib/files.js';
import { debugLog, info } from '../lib/logger.js';
import { PATHS } from '../lib/paths.js';
import { ResumeSchema, resumeJsonSchema, type Resume } from '../schemas/resume.js';
import { runStructured } from '../tools/llm.js';

export async function findResumeInput(): Promise<string> {
  const files = await listFiles(PATHS.inputsResume, [
    '.pdf',
    '.docx',
    '.doc',
    '.txt',
    '.md',
  ]);
  if (files.length === 0) {
    throw new Error(
      `No resume found in ${PATHS.inputsResume}. Place resume.pdf or resume.docx there.`
    );
  }
  // Prefer files named resume.*
  const preferred = files.find((f) =>
    /^resume\./i.test(path.basename(f))
  );
  return preferred ?? files[0];
}

export async function extractResume(
  filePath: string,
  options: { force?: boolean } = {}
): Promise<{ resume: Resume; outputPath: string; skipped: boolean }> {
  const outputPath = PATHS.resumeJson;

  if (!options.force && (await fileExists(outputPath))) {
    debugLog(`Skipping resume extraction; ${outputPath} exists`);
    const { readJson } = await import('../lib/files.js');
    const resume = ResumeSchema.parse(await readJson(outputPath));
    info(`Skip (already processed): resume → ${outputPath}`);
    return { resume, outputPath, skipped: true };
  }

  debugLog(`Extracting resume: ${path.basename(filePath)}`);
  const text = await extractTextFromFile(filePath);

  const extracted = await runStructured({
    label: 'extract-resume',
    schemaName: 'resume',
    jsonSchema: resumeJsonSchema as unknown as Record<string, unknown>,
    zodSchema: ResumeSchema,
    tools: 'none',
    system: [
      'You parse resumes into structured ATS-aligned categories.',
      'Extract only what is present. Do not invent employers, degrees, or skills.',
      'Normalize technology names lightly (e.g. JS → JavaScript) but do not add skills not evidenced.',
    ].join(' '),
    user: [
      'Parse this resume into the schema:',
      '---',
      text.slice(0, 60_000),
      '---',
    ].join('\n'),
  });

  debugLog(
    `Resume hard_skills=${extracted.hard_skills.length} soft_skills=${extracted.soft_skills.length} roles=${extracted.work_experience.length}`
  );

  const resume: Resume = {
    ...extracted,
    source_file: path.basename(filePath),
    extracted_at: new Date().toISOString(),
  };

  await writeJson(outputPath, resume);
  info(`Wrote ${outputPath}`);
  return { resume, outputPath, skipped: false };
}
