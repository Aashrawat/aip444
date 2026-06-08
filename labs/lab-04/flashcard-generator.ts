import fs from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

import { FlashcardResponseSchema } from './schemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
} else {
  dotenv.config({ quiet: true });
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error('OPENROUTER_API_KEY not found in environment');
}

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
});

const defaultModel = 'openai/gpt-4o-mini';
const model =
  process.env.OPENROUTER_MODEL?.split(',').map((m) => m.trim()).filter(Boolean)[0] ??
  defaultModel;

function buildUserPrompt(notesContent: string, cardCount: number): string {
  return [
    'Generate ACE flashcards from the course notes below.',
    `Produce exactly ${cardCount} flashcard(s) in the JSON schema unless the notes are insufficient—then return fewer grounded cards or an empty flashcards array per your system prompt.`,
    '',
    'Critical reminders:',
    '- Ground every field in the notes; do not hallucinate.',
    '- Evidence must be a verbatim quote from the notes.',
    '- Expand all acronyms in challenge.',
    '- Misconception must be quoted student speech.',
    '',
    '<course_notes>',
    notesContent,
    '</course_notes>',
    '',
    `End task: return ${cardCount} grounded ACE flashcard object(s) in the flashcards array.`,
  ].join('\n');
}

async function loadSystemPrompt(): Promise<string> {
  const promptPath = path.join(__dirname, 'SYSTEM_PROMPT.md');
  return readFile(promptPath, 'utf-8');
}

/**
 * Generates flashcards from the provided notes using Structured Outputs.
 * @param notes - The raw text of the course notes
 * @param cards - The number of cards to generate
 * @returns A Promise resolving to the structured JSON data
 */
export async function generateFlashcards(notes: string, cards: number) {
  const systemPrompt = await loadSystemPrompt();
  const userPrompt = buildUserPrompt(notes, cards);

  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: zodResponseFormat(FlashcardResponseSchema, 'flashcards'),
    temperature: 0.3,
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error('The model did not return valid structured flashcard data');
  }

  if (parsed.flashcards.length === 0) {
    throw new Error(
      'No flashcards could be generated from the provided notes. Please supply richer course content.'
    );
  }

  return parsed;
}
