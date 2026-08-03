# Lab 09 Reflection — Source Credibility Analyzer

## Typical steps / investigative process

Successful runs usually took **~8–13 tool calls** (about **10–12 printed steps** including the final message), well under `maxTurns=20`.

Typical path:

1. `read_url` on the target  
2. `web_search` for author credentials  
3. `web_search` / `read_url` for publication reputation or About pages  
4. `web_search` for claim corroboration / fact-checks  
5. `assess_credibility`  
6. `save_report`

This was generally a **logical investigative process**. Occasional **detours** included duplicate/overlapping searches or reading low-value index pages. Those rarely changed the verdict but burned turns.

## assess_credibility ablation (think-tool pattern)

I re-ran the same BBC URL with `SKIP_ASSESS=1` (no think tool).

| | With `assess_credibility` | Without |
|--|---------------------------|---------|
| Verdict | high | high |
| Structure | Full Zod rubric enums/booleans/scores | Softer prose ratings |
| Completeness | Harder to skip dimensions | Easier to blur unverified vs corroborated |

Both reached a sensible high rating for BBC, but **with** the think tool the structured evaluation was more complete and consistent. That supports Anthropic’s idea: a no-side-effect tool whose **schema** forces careful intermediate reasoning before the final report.

## Missing author / publication

- NIST / Anthropic docs / Natural News 404: agent recorded **Unknown** or institutional authorship, checked About pages, and did **not** invent bylines.  
- Broken NIST July URL: found the live January page and documented the 404 instead of fabricating content.  
- Prompt revisions were needed so Medium “publications” were not overrated as editor-reviewed news.  
- Residual issue: arXiv preprint once labeled `peer_reviewed_journal` while `editorial_process=self_published` — classification inconsistency, not author hallucination.

## Hardest source

Natural News (broken article URL + low-reputation outlet) and vendor docs (authoritative for product claims, biased for evaluation). Would improve with stricter cross-field schema rules and a known-outlet reputation helper.

## Agent vs human evaluation

**Good at:** triage speed, checklist coverage, finding About pages, documenting broken URLs, producing reusable Markdown.  
**Bad at:** deep methodology critique, blocked major-news fetches, occasional overconfidence on vendor sources.  
**Trust for research:** first-pass triage only — I still verify DOIs and decide citability myself.

## Research-project sources (CLI vs IDE)

| Source | URL | Agent verdict | My take |
|--------|-----|---------------|---------|
| Peng et al. (2023) Copilot productivity | https://arxiv.org/abs/2302.06590 | high | Credible primary preprint for the 55.8% claim; note arXiv + GitHub/Microsoft author ties |
| Anthropic Claude Code docs | https://code.claude.com/docs/en/overview | high | Credible official docs for product description; treat comparative claims as medium / vendor-biased |

Current research mix (Peng, Perry, Klemmer, Ziegler, official Anthropic/Cursor/Aider docs) is **strong**. Core claims rest on academic sources and clearly labeled vendor docs—not low-credibility blogs. Agent tests (BBC high, Natural News very_low) match how I already filter sources.
