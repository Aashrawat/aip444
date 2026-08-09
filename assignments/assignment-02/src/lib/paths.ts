import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Root of assignments/assignment-02 */
export const PROJECT_ROOT = path.resolve(__dirname, '../..');

export const PATHS = {
  root: PROJECT_ROOT,
  inputsJobs: path.join(PROJECT_ROOT, 'inputs', 'jobs'),
  inputsResume: path.join(PROJECT_ROOT, 'inputs', 'resume'),
  inputsAdvise: path.join(PROJECT_ROOT, 'inputs', 'advise'),
  dataJobs: path.join(PROJECT_ROOT, 'data', 'jobs'),
  dataResume: path.join(PROJECT_ROOT, 'data', 'resume'),
  dataAnalysis: path.join(PROJECT_ROOT, 'data', 'analysis'),
  reports: path.join(PROJECT_ROOT, 'reports'),
  eval: path.join(PROJECT_ROOT, 'eval'),
  resumeJson: path.join(PROJECT_ROOT, 'data', 'resume', 'resume.json'),
  marketAnalysisJson: path.join(PROJECT_ROOT, 'data', 'analysis', 'market-analysis.json'),
  marketAnalysisMd: path.join(PROJECT_ROOT, 'reports', 'market-analysis.md'),
  gapAnalysisJson: path.join(PROJECT_ROOT, 'data', 'analysis', 'gap-analysis.json'),
  gapAnalysisMd: path.join(PROJECT_ROOT, 'reports', 'gap-analysis.md'),
  applicationReportHtml: path.join(PROJECT_ROOT, 'reports', 'application-report.html'),
} as const;
