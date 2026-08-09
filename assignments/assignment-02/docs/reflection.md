# Reflection — Assignment 02

## Evaluation Evidence

Detailed tables and notes live in:

- `eval/extraction-spot-check.md`
- `eval/scoring-check.md`
- `eval/legitimacy-check.md`
- `eval/failure-analysis.md`

### What you tested

**Extraction spot-check** (`eval/extraction-spot-check.md`):

- Shopify Full Stack — `inputs/jobs/01-fullstack-shopify.txt` → `data/jobs/software-engineer-full-stack-shopify.json`
- Stripe Backend — `inputs/jobs/02-backend-stripe.txt` → `data/jobs/backend-software-engineer-stripe.json`

**Phase 3 advisor** (`eval/scoring-check.md`, `eval/legitimacy-check.md`):

| Posting | Path | Expected fit / purpose |
| ------- | ---- | ---------------------- |
| Linear Full Stack | `inputs/advise/linear-fullstack.txt` | Good / strong-ish fit (~75) |
| Jane Street Senior Staff Distributed Systems | `inputs/advise/weak-fit-janestreet.txt` | Weak / growth target (~5) |
| GlobalTek scam (crafted) | `inputs/advise/scam-globaltek.txt` | Legitimacy red (not a fit test) |

### What worked and what didn't

1. **Skills packaging on extraction** — Titles, company, salary, remote status, and posting age were usually correct, but required skills sometimes included experience phrases (e.g. “4+ years backend engineering”) as skill strings instead of only technologies. Schema/prompt allowed free-form skill arrays; the model packed seniority into the list.
2. **Jane Street legitimacy = yellow** — A clearly real company was marked yellow because WHOIS looked incomplete and search surfaced regulatory-controversy news. The agent did not cleanly separate “fake job posting / phishing” from “company controversy,” so green careers signals were diluted.
3. **Gap analysis under-used search (early runs)** — Phase 2 could finish with strong-looking triage advice without calling `web_search`, so certification/course tips were not freshly verified. The prompt said “search when needed”; the model often decided it already knew enough. Later runs required at least one search for short/medium-term gaps.

### Your overall take

I would trust this system as a **first-pass job-search assistant**: structuring market themes, surfacing resume gaps, drafting apply/don’t-panic framing, and catching **obvious** scam patterns (PII upfront, gift cards, Gmail “HR,” absurd pay). I would **not** auto-submit applications or personal data based only on its legitimacy score, and I would not treat fit percentages as precise. A human should double-check: official careers pages and contact domains, anything that would change whether you apply, borderline yellow legitimacy cases, and any “learn X this week” recommendation before spending time or money.

### Consistency check

I ran Phase 3 twice on the same Linear posting (`inputs/advise/linear-fullstack.txt`). Both runs scored **75 / good** with similar met / partial / missing breakdowns and an apply-encouraging recommendation. Narrative wording in the HTML advice can vary slightly between runs (LLM generation), but decision-relevant score and band stayed stable. That level of variance is acceptable for this use case; large score swings would not be.

---

## Reflection questions

### Did you structure your phases as workflows, agents, or a hybrid? What factors influenced this decision?

**Hybrid.** Phases 1 and 2 (and most of Phase 3 after investigation) are a deterministic workflow: parse document → structured extract → write JSON → aggregate/compare → write report. Agentic tool loops appear only where the next step is open-ended: Tavily company research during Phase 1 extraction, optional search during gap triage, and the Phase 3 legitimacy investigator (`@openai/agents` with `web_search` + `whois_lookup`, `maxTurns ≤ 12`).

Factors: cost control (hard iteration caps), re-runnability (skip-if-exists), reuse of shared schemas/tools, and assignment requirements for a true legitimacy agent with tools—without turning every step into an expensive multi-turn agent.

### Which prompt engineering choices most improved extraction consistency across varied job postings?

1. Injecting **today’s date** and explicit rules for absolute vs relative posting dates (and capture/extraction approximation).
2. Hard instruction: **only extract what is present**; use `null` / empty arrays; never invent salary, skills, or education.
3. **Strict structured outputs** (`response_format: json_schema` + Zod validation + one retry on schema failure), matching the Assignment 01 pattern.

Together these kept Shopify-style and Stripe-style postings aligned on core fields even when formatting differed.

### How did you design the legitimacy agent? What signals did you prioritize and why? What limitations does it have?

Design: Agents SDK loop investigates with tools, then a separate structured call produces green/yellow/red + signals + recommendation; the HTML report leads with legitimacy (red banner if needed).

**Prioritized red flags:** upfront SSN/SIN/bank/ID asks, training/equipment fees, contact email domain mismatch, little/no verifiable web presence, very new domain, pay far above market, vague “easy remote money” copy. These are high-precision scam indicators and protect the user from PII theft.

**Prioritized green flags:** established careers page / web presence, domain age when available, matching corporate email, salary consistent with Phase 1 market data, specific technical requirements.

**Limitations:** WHOIS often redacted or incomplete (even for real companies); search can pull corporate controversy that is not “fake job” evidence; yellow/green judgment remains probabilistic; tool failures must degrade gracefully rather than invent facts.

### What models did you use, and how did cost influence your choices?

Primary model: **`google/gemini-2.5-flash`** via OpenRouter (`OPENROUTER_MODEL`). It supports tool calling and strict JSON schema at relatively low cost. I avoided `openrouter/free` after earlier labs showed unreliable multi-step tool use. When a low balance triggered 402 errors on huge default `max_tokens`, I capped completions (~4096) so runs could finish. Cost pushed toward one mid-tier Flash model for all phases instead of heavier multi-model ensembles.

### Coding agent process for Phase 3: Which coding agent did you use? What were your initial instructions? How many iterations did it take? What did you have to manually fix? What did the agent get right vs. wrong about your codebase?

- **Agent:** Cursor coding agent (subagent), directed to build Phase 3 primarily by composing existing code.
- **Initial instructions:** Reuse `extract/job`, schemas, `webSearch` / `whois`, and `runStructured`; implement legitimacy (Agents SDK + OpenRouter provider, maxTurns ≤ 12), fit bands that encourage applying, application advice, single-file HTML with five sections, and `src/cli/advise.ts`.
- **Iterations:** About **one main agent implementation pass**, then a short human review/fix pass (typing, cost caps, WHOIS/RDAP, prompt tweaks), plus live eval runs.
- **Manual fixes:** `ChatCompletionMessageToolCall` typing in `src/tools/llm.ts`; `max_tokens` caps; RDAP fallback in WHOIS; legitimacy instructions to ignore unrelated corporate controversy; gap-analysis “must search” nudge; eval/docs.
- **Got right:** Module composition, CLI shape, five-section HTML report, wiring fit/advice/legitimacy to existing JSON paths.
- **Got wrong / incomplete:** Did not fully anticipate OpenRouter credit/`max_tokens` failures, WHOIS flakiness on modern TLDs, or legitimacy over-weighting news without extra prompting.

### What other AI tools did you use while building? For each, describe one specific instance where it helped and one where it produced something you had to significantly correct or reject.

| Tool | Helped | Had to correct / reject |
| ---- | ------ | ----------------------- |
| **Cursor Composer (main chat)** | Scaffolded Phase 1–2 layout, Zod schemas, and OpenRouter/`json_schema` helpers quickly. | Broad “search whole PC for resume” style commands needed narrowing; had to keep `.env` / resume PDF out of git. |
| **OpenRouter + Gemini Flash** | Reliable structured job/resume extracts and stable Linear fit score (75 twice). | Verbose skill lists; Jane Street yellow from controversy noise; early huge default completion size caused credit 402s. |
| **Tavily Search** | Useful Shopify/Stripe/Linear company size, news, and culture snippets for research fields. | Results sometimes skewed to layoffs or tangential pages; legitimacy queries needed tighter “job scam / phishing” framing. |
| **Cursor Phase 3 coding agent** | Produced working `phase3/*` + `advise` CLI on first directed pass. | Needed human hardening for WHOIS/RDAP, token caps, and legitimacy rubric edge cases. |

---

## Honesty / inputs note

Sample `.txt` job fixtures were used so the pipeline is reproducible without committing personal Print-to-PDF files. A real resume PDF was used locally for Phase 2 (`inputs/resume/resume.pdf`, gitignored); structured output is in `data/resume/resume.json`. For a live search I would replace fixtures with real postings under `inputs/jobs/` and re-run `npm run market`, `npm run gaps`, and `npm run advise`.
