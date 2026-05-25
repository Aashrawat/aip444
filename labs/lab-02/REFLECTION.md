### What didn't work in your initial prompt?

My initial zero-shot prompt was only a few sentences telling the model to act as a study assistant, create ACE flashcards, and use the notes only. That was not enough for a custom format the model rarely sees in training. Early runs showed format drift with missing `=== CARD` delimiters or inconsistent field labels, weak grounding where EVIDENCE was paraphrased or invented, MISCONCEPTION lines that read like textbook warnings instead of quoted student speech, acronyms left unexpanded in CHALLENGE, and no graceful failure when notes were empty or only one sentence. Saying “use the notes only” without a verification workflow made that rule easy for the model to ignore.

### What specific techniques did you add (few-shot examples, chain-of-thought, verification steps, etc.)?

I added a clear instructional-designer role, an exact ACE schema with delimiter lines, chain-of-thought steps to analyze notes, plan candidates, verify each card, self-check, and then output, structured verification per card, three few-shot examples, an edge-case policy table, and delimiter-wrapped notes in code so user content is treated as data only. The user prompt also repeats critical grounding rules at the start and end so the model does not forget them.

### How did you develop your few-shot examples?

I ran the zero-shot prompt on Week 3 notes, kept outputs that had strong APPLICATION scenarios and accurate content, and edited them into canonical examples. Example A models a complete technical card, Example B teaches acronym expansion in CHALLENGE, and Example C was added after testing `test-minimal.md` when the model tried to invent cards from a single sentence. The examples came from real model output and were tightened for consistency.

### How did you prevent hallucination and ensure grounding in the source notes?

The final prompt requires verbatim EVIDENCE in double quotes and forces the model to confirm a quote exists before writing each card. Step-by-step verification checks that APPLICATION, ANSWER, and CORRECTION are supported by the notes, and edge-case rules forbid padding with general knowledge when the notes cannot support the requested number of cards. The user prompt wraps notes in `<course_notes>` and repeats grounding rules, and `flashcards.js` extracts only `=== CARD` blocks so extra reasoning does not appear as final output.

### How did you handle the REFERENCE and COMMON MISTAKE requirements?

The ACE format uses EVIDENCE and MISCONCEPTION instead of REFERENCE and COMMON MISTAKE. EVIDENCE must be a direct, verbatim quote from the notes in double quotes, and CORRECTION must explain the misconception by citing the notes. MISCONCEPTION must be first-person quoted student speech such as “I'll just use zero-shot…”, not third-person statements like “Students often confuse…”. I enforced this in formatting rules and demonstrated it in every few-shot example.

### What edge cases did you discover and how did you handle them?

I found that empty or heading-only notes, one-line notes such as “React is a JavaScript library,” prompt injection inside pasted notes, and OpenRouter rate limits all caused problems. For thin or empty input, the model now returns a `⚠️` message with actionable guidance and no `=== CARD` blocks, taught by Example C in the system prompt. Notes inside delimiters are treated as data only, not instructions. Rate limits are handled with retries and model fallback in `flashcards.js`.

### What surprised you about the iteration process?

Most of the reliability came from prompt engineering rather than code. Few-shot examples taught policy as much as format, especially the insufficient-notes example. Repeating rules in the user prompt mattered because models forget long system prompts. Letting the model reason step-by-step before writing cards improved quote accuracy, and a cheaper model on OpenRouter worked well once the system prompt was strong.
