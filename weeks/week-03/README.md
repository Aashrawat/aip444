# Week 3: Prompt Engineering

This week covers techniques for making Large Language Model (LLM) outputs more reliable, consistent, and safe when building applications.

## Why Prompt Engineering Matters

LLMs are probabilistic. The same prompt can produce different results. Prompt engineering reduces variance by giving the model clear roles, constraints, examples, and verification steps—especially for custom formats the model has not seen in training data.

## Separation of Code and Prompts

Keep **system prompts** static in files (e.g., `SYSTEM_PROMPT.md`) so you can iterate without changing application code. Keep **user prompts** dynamic: they wrap each request's data (notes, diffs, user input) with delimiters.

## Delimiters for Untrusted Input

Wrap user-provided content in explicit delimiters such as XML tags (`<course_notes>...</course_notes>`) or fenced code blocks. This helps the model distinguish **instructions** from **data** and mitigates prompt injection when users paste hostile text into notes.

## Zero-Shot vs Few-Shot Prompting

**Zero-shot** means you describe the task without examples. It is fast to write but often drifts on strict formats.

**Few-shot prompting** supplies the model with example inputs and outputs so it learns the pattern you want. Place high-quality examples in the system prompt. Develop examples by generating drafts, keeping what works, and editing edge cases (empty input, minimal content, acronym expansion).

## Chain-of-Thought Reasoning

Instruct the model to reason **step-by-step** before the final answer. For flashcards, steps might include: analyze note depth, list candidate concepts, verify each quote exists in the source, draft misconceptions, then self-check format.

Chain-of-thought improves grounding because the model explicitly checks claims before emitting cards.

## Structured Reasoning Workflow

Define an ordered workflow—like an employee checklist:

1. Analyze input quality and scope.
2. Plan outputs that the source can support.
3. Verify each fact and quote against the source.
4. Self-check format and constraints.
5. Produce final output or a helpful error.

## Hallucination Prevention and Grounding

**Grounding** means every claim in the output must trace to the source document. Require **verbatim EVIDENCE quotes** so the model cannot paraphrase imaginary sources. Reject cards when a quote cannot be found in the notes.

Do not invent APIs, statistics, assignment requirements, or examples not present in the notes.

## Edge Case Handling

Real inputs are messy. Instruct the model to respond with actionable guidance when:

- Notes are empty or only headings.
- Content is too thin for the requested number of flashcards.
- Terminology is ambiguous.

The model should prefer **no cards** over low-quality or hallucinated cards.

## Cost and Model Selection

When using OpenRouter, cheaper instruction-tuned models (e.g., Meta's Llama 3.3 70B Instruct) can work well with strong prompts. Monitor token usage and pricing. Retry with backoff on HTTP 429 rate limits, or fall back from free to paid model tiers.

## Temperature

Lower temperature (around 0.2–0.4) tends to improve format adherence for structured outputs like ACE flashcards. Higher temperature is better for creative tasks, not strict templates.

## ACE Flashcard Format (Lab Context)

ACE cards combine workplace **Application**, a **Challenge** question, an **Answer**, verbatim **Evidence** from notes, a student-voice **Misconception**, and a **Correction** tied back to the notes. This format forces understanding, not flash recall.

When writing CHALLENGE text, expand acronyms on first use—for example, write "Large Language Model (LLM)" instead of "LLM" alone.

## React.memo (Sample Technical Note)

React.memo is a higher order component that memoizes your component. It will only re-render if the props have changed. This is different from useMemo(), which memoizes a **computed value** inside a component rather than skipping re-renders of the whole component.

## Summary

Effective prompts combine: a clear role, task definition, output schema, few-shot examples, chain-of-thought verification, delimiter-wrapped user data, edge-case policies, and explicit anti-hallucination rules.
