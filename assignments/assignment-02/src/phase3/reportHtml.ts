import fs from 'node:fs/promises';

import { ensureDir } from '../lib/files.js';
import { info } from '../lib/logger.js';
import { PATHS } from '../lib/paths.js';
import type {
  ApplicationAdvice,
  FitAssessment,
  LegitimacyAssessment,
} from '../schemas/application.js';
import type { JobPosting } from '../schemas/job.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function list(items: string[]): string {
  if (items.length === 0) return '<p class="muted">None listed.</p>';
  return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

function verdictClass(verdict: LegitimacyAssessment['verdict']): string {
  if (verdict === 'red') return 'verdict-red';
  if (verdict === 'yellow') return 'verdict-yellow';
  return 'verdict-green';
}

function bandClass(band: FitAssessment['band']): string {
  return `band-${band}`;
}

export type ApplicationReportInput = {
  job: JobPosting;
  legitimacy: LegitimacyAssessment;
  fit: FitAssessment;
  advice: ApplicationAdvice;
};

/**
 * Build a polished single-file HTML+CSS application report and write to PATHS.applicationReportHtml.
 */
export async function writeApplicationReportHtml(
  input: ApplicationReportInput,
  outputPath: string = PATHS.applicationReportHtml
): Promise<string> {
  const { job, legitimacy, fit, advice } = input;
  const title = `${job.job_title} @ ${job.company_name}`;
  const generated = new Date().toISOString();

  const redBanner =
    legitimacy.verdict === 'red'
      ? `<div class="banner-red" role="alert">
          <strong>Warning — RED legitimacy verdict</strong>
          <p>${escapeHtml(legitimacy.recommendation)}</p>
          <p class="muted">Other sections below are still included so you can review fit and prep if you choose to proceed carefully.</p>
        </div>`
      : '';

  const signalRows = legitimacy.signals
    .map(
      (s) => `<tr class="signal-${escapeHtml(s.type)}">
        <td><span class="pill pill-${escapeHtml(s.type)}">${escapeHtml(s.type)}</span></td>
        <td>${escapeHtml(s.signal)}</td>
        <td>${escapeHtml(s.evidence)}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Application Report — ${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #f6f4ef;
      --surface: #fffcf7;
      --ink: #1c2430;
      --muted: #5c6675;
      --line: #d8d2c6;
      --accent: #0f6e56;
      --red: #9b1c1c;
      --red-bg: #fde8e8;
      --yellow: #92400e;
      --yellow-bg: #fef3c7;
      --green: #065f46;
      --green-bg: #d1fae5;
      --shadow: 0 12px 40px rgba(28, 36, 48, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(ellipse at top left, #e8f5f0 0%, transparent 45%),
        radial-gradient(ellipse at bottom right, #efe8dc 0%, transparent 40%),
        var(--bg);
      line-height: 1.55;
    }
    .wrap { max-width: 920px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    header.hero {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 1.75rem 1.75rem 1.5rem;
      box-shadow: var(--shadow);
      margin-bottom: 1.5rem;
    }
    header.hero h1 { margin: 0 0 0.35rem; font-size: 1.75rem; letter-spacing: -0.02em; }
    header.hero .meta { color: var(--muted); font-size: 0.95rem; }
    .banner-red {
      background: var(--red-bg);
      border: 2px solid var(--red);
      color: var(--red);
      border-radius: 14px;
      padding: 1.1rem 1.25rem;
      margin-bottom: 1.5rem;
    }
    .banner-red p { margin: 0.4rem 0 0; }
    section.card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 1.4rem 1.5rem 1.2rem;
      margin-bottom: 1.25rem;
      box-shadow: var(--shadow);
    }
    section.card h2 {
      margin: 0 0 0.85rem;
      font-size: 1.2rem;
      border-bottom: 1px solid var(--line);
      padding-bottom: 0.55rem;
    }
    .muted { color: var(--muted); font-size: 0.92rem; }
    .row { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; align-items: center; margin-bottom: 0.85rem; }
    .pill {
      display: inline-block;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .pill-red, .verdict-red { background: var(--red-bg); color: var(--red); }
    .pill-yellow, .verdict-yellow { background: var(--yellow-bg); color: var(--yellow); }
    .pill-green, .verdict-green { background: var(--green-bg); color: var(--green); }
    .pill-neutral { background: #eef1f4; color: var(--muted); }
    .band-strong { background: var(--green-bg); color: var(--green); }
    .band-good { background: #e0f2fe; color: #075985; }
    .band-stretch { background: var(--yellow-bg); color: var(--yellow); }
    .band-growth_target { background: #f3e8ff; color: #6b21a8; }
    .score {
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent);
      line-height: 1;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; }
    ul { margin: 0.35rem 0 0.6rem; padding-left: 1.2rem; }
    li { margin: 0.28rem 0; }
    h3 { margin: 1rem 0 0.4rem; font-size: 1rem; color: var(--accent); }
    footer { margin-top: 1.5rem; color: var(--muted); font-size: 0.85rem; text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1>Application Report</h1>
      <p class="meta"><strong>${escapeHtml(title)}</strong></p>
      <p class="meta">Location: ${escapeHtml(job.location ?? 'not listed')} · ${escapeHtml(job.remote_status)} · Generated ${escapeHtml(generated)}</p>
    </header>

    ${redBanner}

    <section class="card" id="legitimacy">
      <h2>1. Legitimacy Assessment</h2>
      <div class="row">
        <span class="pill ${verdictClass(legitimacy.verdict)}">Verdict: ${escapeHtml(legitimacy.verdict)}</span>
        <span class="muted">Confidence: ${escapeHtml(String(legitimacy.confidence))}</span>
        <span class="muted">Domain: ${escapeHtml(legitimacy.company_domain ?? 'unknown')}</span>
      </div>
      <p>${escapeHtml(legitimacy.recommendation)}</p>
      <table>
        <thead><tr><th>Type</th><th>Signal</th><th>Evidence</th></tr></thead>
        <tbody>${signalRows || '<tr><td colspan="3" class="muted">No signals recorded.</td></tr>'}</tbody>
      </table>
    </section>

    <section class="card" id="fit">
      <h2>2. Fit Assessment</h2>
      <div class="row">
        <div class="score">${escapeHtml(String(fit.overall_score))}</div>
        <span class="pill ${bandClass(fit.band)}">${escapeHtml(fit.band.replace('_', ' '))}</span>
      </div>
      <p>${escapeHtml(fit.recommendation)}</p>
      <h3>Requirements met</h3>
      ${list(fit.requirements_met)}
      <h3>Partial match</h3>
      ${list(fit.requirements_partial)}
      <h3>Missing / weaker</h3>
      ${list(fit.requirements_missing)}
      <h3>Scoring notes</h3>
      ${list(fit.scoring_notes)}
    </section>

    <section class="card" id="resume">
      <h2>3. Resume Adaptation</h2>
      ${list(advice.resume_adaptation)}
    </section>

    <section class="card" id="cover">
      <h2>4. Cover Letter Guidance</h2>
      ${list(advice.cover_letter_guidance)}
    </section>

    <section class="card" id="interview">
      <h2>5. Interview Prep</h2>
      <h3>Likely questions</h3>
      ${list(advice.interview_prep.likely_questions)}
      <h3>Skills to brush up</h3>
      ${list(advice.interview_prep.skills_to_brush_up)}
      <h3>Company research topics</h3>
      ${list(advice.interview_prep.company_research_topics)}
      <h3>Talking points</h3>
      ${list(advice.interview_prep.talking_points)}
    </section>

    <footer>Assignment 02 · Phase 3 Application Advisor</footer>
  </div>
</body>
</html>
`;

  await ensureDir(PATHS.reports);
  await fs.writeFile(outputPath, html, 'utf8');
  info(`Wrote ${outputPath}`);
  return outputPath;
}
