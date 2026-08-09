# Failure Analysis & Overall Observations

## Failure 1 — WHOIS often missing registration dates

**What happened:** `whois_lookup` frequently returned `registration date unknown` / redacted org for domains like `linear.app` and `janestreet.com`, even though the companies are established.

**Why:** Many TLDs and privacy services limit classic WHOIS; the `whoiser` parsing path does not always fall back to RDAP.

**Fix:** Add an RDAP fallback (`https://rdap.org/domain/{domain}`), normalize date fields across registrars, and teach the legitimacy agent that redacted WHOIS + strong web presence is usually neutral—not a red flag.

## Failure 2 — Gap analysis sometimes skips web_search

**What happened:** Phase 2 produced solid triage advice but the tool loop finished with **zero** `web_search` calls on the sample run, so certification/course recommendations were not freshly verified.

**Why:** The model judged the market JSON sufficient; the system prompt encourages search “when needed” but does not require at least one lookup for external resources.

**Fix:** Require at least one `web_search` for short/medium-term gap recommendations (or a dedicated “lookup learning resource” step), and fail soft if search is down.

## Failure 3 — Legitimacy agent can over-weight unrelated news

**What happened:** Jane Street (clearly real) scored **yellow** partly due to market-manipulation news unrelated to whether the careers posting is a phishing scam.

**Why:** Broad “scam reports” queries surface regulatory controversies; the agent rubric does not sharply separate “fraudulent job posting” from “company controversy.”

**Fix:** Narrow investigation queries (“job scam”, “fake careers”, “phishing”) and score corporate controversy as neutral unless it implies the posting itself is fake.

## Overall

**Works well:** Structured extraction with Zod + OpenRouter `json_schema`; skip-if-exists re-runs; Tavily company research; fit bands that encourage applying on good matches (Linear 75) and correctly mark impossible stretches (Jane Street 5); scam posting correctly **red** with HTML warning; debug logs are actionable.

**Falls short:** WHOIS reliability; occasional missing `posting_date_note`; Phase 2 under-using search; single HTML path overwritten on each advise run (fine for CLI, awkward for comparing multiple targets side-by-side without copying the file).
