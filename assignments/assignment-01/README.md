# Assignment 01 — AI Code Review CLI

A CLI tool that runs two specialized AI reviewers in parallel, then synthesizes their findings into a single HTML report via a Lead Developer judge.

## Reviewers

- **Security Auditor** — hardcoded secrets, injection risks, unsafe patterns
- **Maintainability Critic** — naming, types, unused imports, readability

## Setup

```bash
cd assignments/assignment-01
npm install
```

Create a `.env` file at the **repo root** (`AIP444/.env`):

```env
OPENROUTER_API_KEY=your_key_here

# Optional overrides (defaults shown)
OPENROUTER_REVIEWER_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_JUDGE_MODEL=google/gemini-2.5-flash-lite
```

Never commit your API key.

## Usage

**File mode** — review a specific file:

```bash
npm run review -- --file bad_code.ts
npm run review -- --debug --file bad_code.ts
npm run review -- --file bad_code.ts --output my-report.html
```

**Git mode** — review staged changes (default):

```bash
git add path/to/changed-file
npm run review
npm run review -- --debug
```

If there is nothing to review, the tool exits with an error message.

**Debug mode** (`--debug`) prints detailed execution logs to stderr (reviewer state, tool calls, raw JSON findings). Final output still goes to stdout only.

## Output

Reports are saved as a single HTML file (HTML + CSS). Default filename: `review-DD-MM-YYYY-HH-MM-SS.html`.

## Models & cost

| Role      | Model                         | Temperature |
|-----------|-------------------------------|-------------|
| Reviewers | `google/gemini-2.5-flash-lite` | 0.1 (Security), 0.3 (Maintainability) |
| Judge     | `google/gemini-2.5-flash-lite` | 0.4 |

Chosen for low cost and fast responses on OpenRouter while supporting tool calling and structured JSON output.

<!-- TODO: Fill in for submission -->
**AI usage notes:** _Describe how you used AI while building this assignment (e.g. prompt drafting, debugging, testing)._

**Cost notes:** _Approximate token usage or OpenRouter spend from your experiments._

## Sample report

See `my-report.html` for example output from `--file bad_code.ts`.

## Type check

```bash
npm run typecheck
```
