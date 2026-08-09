/**
 * Convert a Zod-like plain object description into OpenAI json_schema format helpers.
 * We hand-author JSON Schemas alongside Zod for strict structured outputs.
 */

export function slugify(parts: string[]): string {
  const raw = parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return raw || 'untitled-job';
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
