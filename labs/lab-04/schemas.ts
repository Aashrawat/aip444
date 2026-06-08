import * as z from 'zod';

/**
 * A single ACE flashcard. Field descriptions are passed to the LLM via
 * structured output so the model knows what each property should contain.
 */
export const FlashcardSchema = z.object({
  application: z
    .string()
    .describe(
      '1-2 sentence real-world workplace task where this concept is needed'
    ),
  challenge: z
    .string()
    .describe(
      'A specific problem to solve in the scenario. Expand all acronyms'
    ),
  answer: z
    .string()
    .describe('Correct solution with brief explanation'),
  evidence: z
    .string()
    .describe('Direct quote from source notes supporting this card'),
  misconception: z
    .string()
    .describe(
      'Quote of what a junior developer/student might incorrectly believe'
    ),
  correction: z
    .string()
    .describe("Why it's wrong, citing the notes"),
});

export type Flashcard = z.infer<typeof FlashcardSchema>;

/**
 * Top-level response shape returned by the /api/generate endpoint.
 */
export const FlashcardResponseSchema = z.object({
  flashcards: z
    .array(FlashcardSchema)
    .describe('List of ACE flashcards generated from the course notes'),
});

export type FlashcardResponse = z.infer<typeof FlashcardResponseSchema>;
