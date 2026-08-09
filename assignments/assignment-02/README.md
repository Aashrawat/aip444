# Assignment 02 — Job Search Assistant

End-to-end assistant that analyzes a set of job postings, compares them to your resume, and produces a targeted application report (fit, resume/cover/interview advice, and posting legitimacy).

## Setup

```bash
cd assignments/assignment-02
npm install
cp .env.example .env
```

Fill in `.env` (never commit it):

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | yes | All LLM generation / chat completions |
| `TAVILY_API_KEY` | yes | `web_search` tool |
| `OPENROUTER_MODEL` | no | Defaults to `google/gemini-2.5-flash` |
| `LOG_LEVEL=debug` | no | Same as `--verbose` |

This project also loads a repo-root `.env` if present.

### Input files

Drop personal files here (PDFs preferred; `.txt` / `.md` / `.docx` also work):

- `inputs/jobs/` — **8+** postings in a similar domain
- `inputs/resume/` — your resume (`resume.pdf`, `resume.docx`, or `resume.txt`)
- `inputs/advise/` — Phase 3 target posting(s)

Sample `.txt` fixtures are included so you can dry-run the pipeline. Replace them with your real Print-to-PDF postings for a genuine job search.

## Phase 1 — Job market analysis

```bash
npm run market
npm run market -- --verbose
npm run market -- --force          # re-extract even if JSON exists
npm run market -- --skip-research  # extract only (cheaper)
npm run market -- path/to/one.pdf  # process specific files
```

**Outputs**

- `data/jobs/<slug>.json` — structured extraction + company research per posting
- `data/analysis/market-analysis.json`
- `reports/market-analysis.md`

Already-processed postings (matched by `source_file`) are skipped on re-run.

## Phase 2 — Resume gap analysis

Requires Phase 1 market JSON.

```bash
npm run gaps
npm run gaps -- --verbose
npm run gaps -- --force
npm run gaps -- --resume path/to/resume.pdf
```

**Outputs**

- `data/resume/resume.json`
- `data/analysis/gap-analysis.json`
- `reports/gap-analysis.md`

## Phase 3 — Application advisor

Requires Phase 1 + resume JSON (gap analysis optional but recommended). Built primarily with a coding agent on top of shared Phase 1/2 modules.

```bash
npm run advise -- inputs/advise/linear-fullstack.txt
npm run advise -- path/to/new-posting.pdf --verbose
npm run advise -- path/to/posting.pdf --force
```

**Output**

- `reports/application-report.html` — single-file HTML with:
  1. Legitimacy assessment (web search + WHOIS agent)
  2. Fit assessment
  3. Resume adaptation
  4. Cover letter guidance
  5. Interview prep

## Evaluation

After running the system on your inputs, review and update:

| File | Purpose |
|------|---------|
| `eval/extraction-spot-check.md` | Manual expected vs extracted tables (≥2 postings) |
| `eval/scoring-check.md` | Strong vs weak fit + re-run consistency |
| `eval/legitimacy-check.md` | Legitimate vs scam posting |
| `eval/failure-analysis.md` | ≥2 weaknesses + overall notes |

Suggested legitimacy fixtures:

```bash
npm run advise -- inputs/advise/linear-fullstack.txt --verbose
npm run advise -- inputs/advise/scam-globaltek.txt --verbose
npm run advise -- inputs/advise/weak-fit-janestreet.txt --verbose
```

## Observability

Use `--verbose` or `LOG_LEVEL=debug`. Diagnostics go to **stderr** (`[DEBUG] …`): extraction fields, tool calls, LLM token usage, fit breakdown, legitimacy signals.

## Safety & reliability

- API keys only via `.env` (gitignored)
- PDF/Word parse failures skip that file and continue
- Schema validation retries; tool/network failures degrade with notes instead of crashing
- Agentic loops capped (`maxToolIterations` / legitimacy `maxTurns ≤ 12`)

## Extras

- Skip-if-exists extraction for cheap re-runs
- `.txt` inputs for quick testing without PDFs
- Repo-root `.env` fallback for course workflows

## Reflection

See [`docs/reflection.md`](docs/reflection.md).
