# Lab 09 Reflection — Source Credibility Analyzer

## What I built

A TypeScript agent using the **OpenAI Agents SDK** with a custom **OpenRouter** `ModelProvider`, four tools (`read_url`, `web_search`, `assess_credibility`, `save_report`), and a system prompt that drives multi-step investigation before writing a Markdown report under `reports/`.

## How the agent loop behaved

On successful runs the typical path was:

1. `read_url` on the target  
2. Several `web_search` calls (author, outlet, claims)  
3. Extra `read_url` for About pages or corroborating articles  
4. `assess_credibility` (structured “think” tool)  
5. `save_report`

The **trace** (`result.newItems`) was the best debugging signal. Early failures were schema-related (`z.string().url()` → JSON Schema `format: uri`, rejected by the provider). After switching to plain strings, tool calling worked.

## Test results (research topic: AI coding / CLI vs IDE)

| Category | Source | Verdict |
|----------|--------|---------|
| High — gov | NIST adversarial AI news (Jan 2024) | **high** |
| High — news | BBC: Can coders trust ChatGPT? | **high** |
| Medium — vendor | GitHub Blog Copilot productivity research | **medium** |
| Low — personal | Medium: ditching GitHub Copilot | **low** |
| Tricky | Natural News ChatGPT article | **very_low** |

The tricky case mattered most: the page can look like a news article, but investigation of the outlet reputation correctly pulled the rating down to `very_low`.

## Missing information / failures

- A mistyped NIST July URL returned **404**; the agent searched, found the live January page, and documented the broken link instead of inventing content.  
- Some major outlets (e.g. Reuters) block automated fetches; BBC/CBC-style URLs worked better via Jina.  
- `openrouter/free` is unsuitable for multi-tool runs; default model is `openai/gpt-5.4-mini`.  
- Polished Medium essays on “publications” (e.g. CodeX) sometimes scored `medium` until the prompt/schema made self-published opinion defaults clearer.

## What the “think” tool changed

Without `assess_credibility`, the model tended to jump to a soft summary. Forcing the full Zod rubric made author/publication/corroboration fields explicit and improved report consistency.
