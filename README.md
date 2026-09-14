# AIP444 — AI for Programmers

Coursework by **Aashrawat Shrestha** for **AIP444 (AI for Programmers)**.

This repository is a collection of TypeScript/Node.js labs and assignments that build real LLM applications: prompt-engineered CLIs, structured outputs, tool calling, embeddings, RAG, multimodal vision, and multi-agent workflows. Models run through [OpenRouter](https://openrouter.ai). Search and research tools use [Tavily](https://tavily.com).

**Stack:** Node.js 20+, TypeScript, OpenAI SDK, Zod, Hono, ChromaDB, `@openai/agents`, Sharp, WHOIS.

---

## What’s in this repo

| Path | What I built |
|------|----------------|
| [`labs/lab-01`](labs/lab-01) | LLM git commit-message CLI |
| [`labs/lab-02`](labs/lab-02) | ACE flashcard generator (prompt engineering) |
| [`weeks/week-03`](weeks/week-03) | Prompt-engineering notes used by the flashcard labs |
| [`labs/lab-04`](labs/lab-04) | Flashcard HTTP API with structured JSON outputs |
| [`labs/lab-05`](labs/lab-05) | PR-advice CLI with GitHub file-fetching tools |
| [`labs/lab-06`](labs/lab-06) | Semantic product search (embeddings + rerank) |
| [`labs/lab-07`](labs/lab-07) | RAG over Node.js docs (ChromaDB) |
| [`labs/lab-08`](labs/lab-08) | Multimodal `img-debug` CLI (vision + web search) |
| [`labs/lab-09`](labs/lab-09) | Source-credibility analyzer agent |
| [`assignments/assignment-01`](assignments/assignment-01) | Parallel AI code-review CLI + HTML judge report |
| [`assignments/assignment-02`](assignments/assignment-02) | Job-search assistant (market → gaps → apply advice) |
| [`assignments/cli-vs-ide-ai-report.md`](assignments/cli-vs-ide-ai-report.md) | Group report: CLI agents vs IDE AI assistants |

---

## Setup

Each project is self-contained (`npm install` inside that folder). API keys live in a **repo-root** `.env` (gitignored):

```env
OPENROUTER_API_KEY=sk-or-...
TAVILY_API_KEY=tvly-...
# Optional
OPENROUTER_MODEL=google/gemini-2.5-flash
```

Never commit `.env`. Labs that call the network need OpenRouter; Labs 08–09 and Assignment 02 also need Tavily.

---

## Labs

### Lab 01 — `git-cm` (LLM commit messages)

[`labs/lab-01/git-cm.js`](labs/lab-01/git-cm.js) reads `git diff --staged` and asks an LLM for a Conventional Commits message. `--creative` switches to Gitmoji + pirate slang so prompt style is obviously different. Includes OpenRouter model fallback and retry/backoff on rate limits.

```bash
cd labs/lab-01 && npm install
node git-cm.js
node git-cm.js --creative
```

### Lab 02 — ACE flashcard generator (prompt engineering)

[`labs/lab-02`](labs/lab-02) turns course notes into ACE cards (Application, Challenge, Answer, Evidence, Misconception, Correction). The work is mostly in [`SYSTEM_PROMPT.md`](labs/lab-02/SYSTEM_PROMPT.md): role, exact schema, few-shot examples, chain-of-thought verification, delimiter-wrapped notes, and edge-case handling (empty/thin notes → no hallucinated cards). Reflection: [`labs/lab-02/REFLECTION.md`](labs/lab-02/REFLECTION.md).

```bash
cd labs/lab-02 && npm install
node flashcards.js path/to/notes.md --cards 3
```

### Lab 04 — Structured-output flashcard API

[`labs/lab-04`](labs/lab-04) wraps the same ACE task in a **Hono** HTTP API (`POST /api/generate`). Zod validates the request body; OpenRouter **strict JSON schema** returns typed flashcards instead of free text. CORS, logging, and timing middleware included.

```bash
cd labs/lab-04 && npm install
npm run dev
```

### Lab 05 — PR advice with tool calling

[`labs/lab-05`](labs/lab-05) is a CLI that reviews a GitHub pull request. The model can call `read_github_files` to fetch extra context from the repo, then write review advice. Demonstrates a bounded tool loop (max iterations), Zod tool schemas, and a system prompt that keeps the assistant grounded in the PR + fetched files.

```bash
cd labs/lab-05 && npm install
npm run pr-advice -- owner/repo 123
```

### Lab 06 — Semantic search (embeddings + threshold + rerank)

[`labs/lab-06`](labs/lab-06) indexes DummyJSON products with embeddings, stores vectors in TSV, applies a similarity **threshold**, then **reranks** candidates with a second LLM pass. Interactive search prints both vector score and rerank score.

```bash
cd labs/lab-06 && npm install
npm run index
npm run threshold
npm run search
```

### Lab 07 — RAG over Node.js documentation

[`labs/lab-07`](labs/lab-07) is a retrieval-augmented generation pipeline:

1. Chunk official Node.js markdown docs  
2. Embed and store in **ChromaDB**  
3. Retrieve top candidates, rerank, then answer with cited sources  

```bash
cd labs/lab-07 && npm install
npm run index
npm run ask -- "How do fs.promises.readFile error codes work?"
```

### Lab 08 — `img-debug` (vision + search)

[`labs/lab-08`](labs/lab-08) is a multimodal CLI: resize/compress a screenshot with **Sharp**, send it to a vision model, and let the model call **Tavily** (`lookup_error`) when it needs current docs. Debug logs go to stderr; the answer goes to stdout. Details: [`labs/lab-08/README.md`](labs/lab-08/README.md).

```bash
cd labs/lab-08 && npm install
npm run img-debug -- path/to/screenshot.png
```

### Lab 09 — Source credibility analyzer agent

[`labs/lab-09`](labs/lab-09) uses the **OpenAI Agents SDK** with a custom OpenRouter provider. Given a URL, the agent investigates author, outlet, claims, bias, and currency, then writes a Markdown report. Tools: `read_url` (Jina Reader), `web_search` (Tavily), `assess_credibility` (think-tool / no side effects), `save_report`. Includes ablation traces (with vs without the think tool) and sample reports under [`labs/lab-09/reports/`](labs/lab-09/reports/).

```bash
cd labs/lab-09 && npm install
npm run analyze -- "https://example.com/article"
```

---

## Assignments

### Assignment 01 — AI code review CLI

[`assignments/assignment-01`](assignments/assignment-01) runs **two reviewers in parallel**, then a **Lead Developer judge**:

| Role | Focus |
|------|--------|
| Security Auditor | secrets, injection, unsafe patterns |
| Maintainability Critic | naming, types, unused imports, readability |
| Lead Developer | de-dupe, filter noise, synthesize one HTML report |

Reviewers get `read_file` and `ripgrep` tools, then a **second-phase strict JSON schema** so tool calling and structured output are not mixed in one request. File mode (`--file`) or git mode (staged diff). Sample output: `my-report.html`.

```bash
cd assignments/assignment-01 && npm install
npm run review -- --file bad_code.ts
npm run review -- --debug
```

### Assignment 02 — Job search assistant

[`assignments/assignment-02`](assignments/assignment-02) is a three-phase pipeline:

1. **Market analysis** — extract structured job JSON from 8+ postings, research companies, write `reports/market-analysis.md`  
2. **Gap analysis** — parse a resume, compare to the market, write `reports/gap-analysis.md`  
3. **Application advisor** — legitimacy agent (Tavily + WHOIS) + fit score + resume/cover/interview HTML report  

Hybrid design: deterministic extract → schema → report for most steps; agentic loops only where the next action is open-ended (company research, legitimacy). Eval notes live in [`assignments/assignment-02/eval/`](assignments/assignment-02/eval/). Full usage: [`assignments/assignment-02/README.md`](assignments/assignment-02/README.md).

```bash
cd assignments/assignment-02 && npm install
npm run market
npm run gaps
npm run advise -- inputs/advise/linear-fullstack.txt
```

### CLI agents vs IDE-based AI (group report)

Written report and slides comparing CLI agents (Claude Code, Aider, Goose) with IDE assistants (Cursor and similar): productivity, autonomy, codebase awareness, cost, and security. Hybrid recommendation — use autonomy for scoped tasks, keep human review for consequential changes.

- Report: [`assignments/cli-vs-ide-ai-report.md`](assignments/cli-vs-ide-ai-report.md)  
- Group members: Aashrawat Shrestha, Derek, Bhim Dhatta  

---

## Themes across the course

- **Prompts as code** — system prompts in markdown files, user data in delimiters, few-shot + verification to reduce hallucination  
- **Structured outputs** — Zod schemas and OpenRouter `json_schema` so downstream code can trust the model  
- **Tools, not one-shot chat** — GitHub fetch, ripgrep, web search, WHOIS, vision, URL reading  
- **Agents with guardrails** — max turns/iterations, skip-if-exists, degrade on parse/network failure instead of crashing  
- **Eval** — spot-checks, legitimacy fixtures (real vs scam), ablation (think-tool on/off), reflections per lab  

---

## License

Coursework for AIP444. Not an official course materials repo.
