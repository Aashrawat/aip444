# Reflection — Assignment 02

## What I built

A TypeScript Job Search assistant under `assignments/assignment-02/` with three CLIs:

1. **Phase 1** (`npm run market`) — PDF/TXT extraction → Zod-validated structured outputs → Tavily company research → market JSON + Markdown  
2. **Phase 2** (`npm run gaps`) — resume extraction → triaged gap analysis vs market  
3. **Phase 3** (`npm run advise`) — legitimacy agent (web search + WHOIS) + fit + application advice → single-file HTML report  

Shared modules (schemas, OpenRouter client, tools, extractors) are reused across phases. Design is a **hybrid**: deterministic pipeline for extract → analyze → report, with an **agentic loop** only where investigation is open-ended (company research tool loops; Phase 3 legitimacy agent via OpenAI Agents SDK).

## AI products used

| Product | Role |
| ------- | ---- |
| Cursor (Composer / agent) | Primary implementation partner for scaffolding, Phase 1–2, fixes |
| Cursor coding agent (subagent) | **Primary author of Phase 3** (`src/phase3/*`, `src/cli/advise.ts`) per assignment constraint |
| OpenRouter (`google/gemini-2.5-flash`) | All LLM chat/completions and structured outputs |
| Tavily | Web search tool |
| whoiser | WHOIS lookups |

I am responsible for reviewing agent output, running evaluations, and understanding every module.

## Phase 3 coding-agent process

I directed a coding agent to compose Phase 3 on top of existing extract/tools/schemas rather than rewriting the stack. The agent produced `legitimacy.ts`, `fit.ts`, `advice.ts`, `reportHtml.ts`, `provider.ts`, and `advise.ts`. I then:

- Fixed pre-existing structured-output TypeScript typing in `src/tools/llm.ts`
- Ran live end-to-end tests (Linear, Jane Street weak fit, GlobalTek scam)
- Documented eval results and tightened README / failure notes

Manual corrections were light (typing + docs/eval); the Phase 3 application shape came from the agent.

## Costs / model choice

Default model: **`google/gemini-2.5-flash`** via OpenRouter — supports tool calling and strict JSON schema structured outputs at relatively low cost (same family used successfully in earlier course work).

Approximate development/eval usage (order of magnitude from debug token logs):

- Phase 1 (9 postings + research + market report): on the order of tens of thousands of tokens per posting including research; full market run completed successfully  
- Phase 2: ~10k–15k tokens  
- Phase 3: ~15k–30k tokens per advise (legitimacy agent + fit + advice + prior extraction/research)

Total stayed within course OpenRouter credit expectations for this assignment. Verbose mode logs prompt/completion totals per call for ongoing budgeting. Hard caps: tool-loop iterations and legitimacy `maxTurns ≤ 12`.

## What I would improve next

1. RDAP fallback for WHOIS  
2. Force at least one verified learning-resource search in gap triage  
3. Optional `--out` path for HTML so multiple advise targets can be kept side-by-side  
4. Replace sample `.txt` fixtures with personal Print-to-PDF postings for a real search  

## Honesty check

Sample job/resume inputs are synthetic fixtures shaped like real postings so the pipeline is reproducible in-repo without committing personal PDFs. The system accepts real PDFs the same way; for an actual job search I would swap in Print-to-PDF captures under `inputs/`.
