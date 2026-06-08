/**
 * ACE Flashcard HTTP API Server (Hono + Node)
 *
 * This file boots a small REST API that accepts course notes over HTTP and
 * returns structured ACE flashcards as JSON. It is the "backend" layer: clients
 * (browser apps, CLI scripts, mobile) POST to /api/generate instead of calling
 * the LLM directly.
 *
 * Request flow:
 *   1. Client POSTs JSON { notes, cards? } to /api/generate
 *   2. Global middleware logs the request and adds timing headers
 *   3. CORS middleware allows browser clients on /api/* routes
 *   4. zValidator checks the body against generateSchema (Zod)
 *   5. generateFlashcards() calls OpenRouter with structured outputs
 *   6. Parsed flashcards are returned as JSON, or a 500 on failure
 *
 * Hono is similar to Express: `app.use()` registers middleware, `app.post()`
 * registers routes, and the handler receives a context object `c` with helpers
 * like `c.req`, `c.json()`, and `c.req.valid('json')` for validated input.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timing } from 'hono/timing';
import { logger } from 'hono/logger';
import { zValidator } from '@hono/zod-validator';
import * as z from 'zod';

import { generateFlashcards } from './flashcard-generator.js';

// Create the Hono application instance (like `const app = express()`).
const app = new Hono();

// Global middleware runs on every request, in registration order.
// logger(): prints method, path, status, and response time to the console.
// timing(): adds Server-Timing headers so clients can measure server duration.
app.use(logger(), timing());

// CORS only on /api/* so browser frontends on another origin can call the API.
// Without CORS, browsers block cross-origin fetch/XHR even if the server responds.
app.use('/api/*', cors());

// Zod schema for the POST body. Optional `cards` defaults to 3 when omitted.
const generateSchema = z.object({
  notes: z.string().min(1, "Field 'notes' is required."),
  cards: z.number().optional().default(3),
});

// POST /api/generate — main flashcard generation endpoint.
// zValidator('json', generateSchema) parses JSON and validates before the handler runs.
// Invalid bodies get a 400 response automatically; valid data is on c.req.valid('json').
app.post('/api/generate', zValidator('json', generateSchema), async (c) => {
  try {
    const { notes, cards } = c.req.valid('json');

    const result = await generateFlashcards(notes, cards);

    return c.json(result);
  } catch (error: unknown) {
    console.error('Server Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return c.json(
      {
        error: 'Failed to generate flashcards.',
        details: message,
      },
      500
    );
  }
});

const port = 3000;
console.log(`🚀 Server running on http://localhost:${port}`);

// @hono/node-server adapts Hono's fetch-style app to a Node HTTP listener.
serve({
  fetch: app.fetch,
  port,
});
