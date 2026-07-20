# Lab 08 — img-debug

CLI visual debugger: optimize a screenshot, send it to a vision LLM via OpenRouter, and look up current docs with Tavily when needed.

## Prerequisites

- Node.js 20+
- OpenRouter API key
- Tavily API key ([app.tavily.com](https://app.tavily.com))

## Install dependencies

This project uses **TypeScript / Node.js**. From this folder:

```powershell
cd labs/lab-08
npm install
```

That installs:

| Package | Purpose |
|---------|---------|
| `openai` | OpenAI SDK (OpenRouter-compatible chat + vision + tools) |
| `@tavily/core` | Tavily Search API for the `lookup_error` tool |
| `sharp` | Image resize / JPEG compression before sending to the model |
| `zod` | Tool argument validation |
| `dotenv` | Load keys from the project `.env` |
| `tsx` / `typescript` | Run and typecheck TypeScript |

### Equivalent Python stack (reference)

If you implement the lab in Python instead, install:

```bash
pip install openai tavily-python Pillow
```

| Package | Purpose |
|---------|---------|
| `openai` | OpenAI SDK |
| `tavily-python` | Tavily Search API |
| `Pillow` | Image resize / JPEG compression (same role as `sharp`) |

## Environment

Add keys to the repo root `.env` (one level above `labs/`):

```env
OPENROUTER_API_KEY=sk-or-...
TAVILY_API_KEY=tvly-...
```

Optional: set `OPENROUTER_MODEL` to a vision + tool-calling model.  
`img-debug` defaults to `google/gemini-3-flash-preview` (and skips flaky `openrouter/free`).

## Run

```powershell
npm run img-debug -- path\to\screenshot.png
npm run img-debug -- path\to\screenshot.png "Why is this failing?"
```

Quote paths that contain spaces or parentheses (PowerShell):

```powershell
npm run img-debug -- "..\Screenshot (854).png"
```

Debug logs go to **stderr**; the final answer goes to **stdout**.

## How it works

1. **Image pipeline** (`image.ts`) — resize longest side ≤ 1024px, JPEG quality 85%, base64 encode  
2. **Tool** (`schemas.ts` / `search.ts`) — `lookup_error` via Tavily  
3. **Loop** (`img-debug.ts`) — multimodal chat; if the model calls the tool, search and continue until a final answer  

## Typecheck

```powershell
npm run typecheck
```
