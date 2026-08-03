# Lab 09 — Source Credibility Analyzer Agent

An OpenAI Agents SDK agent that investigates a URL (author, publication, claims, bias, currency) and writes a structured Markdown credibility report.

## Prerequisites

- Node.js 20+
- OpenRouter API key
- Tavily API key ([app.tavily.com](https://app.tavily.com))

## Install

```powershell
cd labs/lab-09
npm install
```

| Package | Purpose |
|---------|---------|
| `@openai/agents` | Agent loop, tools, Runner |
| `openai` | OpenAI-compatible client pointed at OpenRouter |
| `@tavily/core` | `web_search` tool |
| `zod` | Tool / credibility-rubric schemas |
| `dotenv` | Load keys from repo-root `.env` |

## Environment

Repo root `.env`:

```env
OPENROUTER_API_KEY=sk-or-...
TAVILY_API_KEY=tvly-...
# Optional — defaults to openai/gpt-5.4-mini (skips flaky openrouter/free)
OPENROUTER_MODEL=openai/gpt-5.4-mini
# Optional turn guardrail (default 20)
MAX_TURNS=20
```

## Run

```powershell
npm run analyze -- "https://example.com/article"
```

Debug/tool logs and the agent **trace** go to **stderr**. The agent's final message goes to **stdout**. Reports are written under `reports/`.

## Architecture

1. **`provider.ts`** — `OpenRouterModelProvider` (`CustomModelProvider` pattern) using `OpenAIChatCompletionsModel` + OpenRouter base URL  
2. **`tools.ts`** — `read_url` (Jina Reader), `web_search` (Tavily), `assess_credibility` (think-tool / no side effects), `save_report`  
3. **`schemas.ts`** — Zod credibility rubric for `assess_credibility`  
4. **`SYSTEM_PROMPT.md`** — investigative workflow + missing-info handling  
5. **`agent.ts`** — wires agent, runs with `maxTurns`, prints trace  

## Suggested test categories

See [`TEST_URLS.md`](./TEST_URLS.md) and sample outputs in [`reports/`](./reports/). Summary:

| Category | Example | Typical verdict |
|----------|---------|-----------------|
| High — government | NIST adversarial AI article | high |
| High — major news | BBC on ChatGPT for coders | high |
| Medium — vendor blog | GitHub Copilot research post | medium |
| Low — personal opinion | Medium essay ditching Copilot | low |
| Tricky | Natural News ChatGPT piece | very_low |

## Typecheck

```powershell
npm run typecheck
```
