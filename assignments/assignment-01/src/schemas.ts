import * as z from 'zod';

export const ReviewFindingSchema = z.object({
  path: z.string().describe('File path relative to the project root'),
  line: z.number().int().positive().describe('1-based line number of the issue'),
  severity: z
    .enum(['info', 'warn', 'critical'])
    .describe('Issue severity: info, warn, or critical'),
  category: z
    .string()
    .describe('Issue category such as security, style, maintainability, performance'),
  description: z.string().describe('Clear, actionable description of the issue'),
});

export const ReviewOutputSchema = z.object({
  findings: z.array(ReviewFindingSchema),
});

export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

export const ReadFileArgsSchema = z.object({
  file_path: z.string().describe('Path to the file to read, relative to project root'),
  start_line: z.number().int().positive().optional().describe('Optional 1-based start line'),
  end_line: z.number().int().positive().optional().describe('Optional 1-based end line'),
});

export const RipgrepArgsSchema = z.object({
  search_pattern: z.string().describe('Regex or literal pattern to search for recursively'),
});

export const readFileTool = {
  type: 'function' as const,
  function: {
    name: 'read_file',
    description: [
      'Read file contents from disk to understand context beyond the diff.',
      'Use when you need imports, surrounding functions, configuration, or full file structure.',
      'Optionally pass start_line and end_line to read a slice of a large file.',
      'Large files are truncated automatically.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file, relative to the project root',
        },
        start_line: {
          type: 'integer',
          description: 'Optional 1-based start line (inclusive)',
        },
        end_line: {
          type: 'integer',
          description: 'Optional 1-based end line (inclusive)',
        },
      },
      required: ['file_path'],
      additionalProperties: false,
    },
  },
};

export const ripgrepTool = {
  type: 'function' as const,
  function: {
    name: 'ripgrep',
    description: [
      'Search the codebase recursively for a pattern using ripgrep.',
      'Use to find function definitions, callers, hardcoded secrets, or usage patterns.',
      'Returns file paths, line numbers, and matching lines.',
      'Results are capped to avoid excessive token usage.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        search_pattern: {
          type: 'string',
          description: 'Pattern to search for (regex supported)',
        },
      },
      required: ['search_pattern'],
      additionalProperties: false,
    },
  },
};

export const reviewerTools = [readFileTool, ripgrepTool];

export const reviewOutputJsonSchema = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['info', 'warn', 'critical'] },
          category: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['path', 'line', 'severity', 'category', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['findings'],
  additionalProperties: false,
} as const;
