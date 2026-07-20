import * as z from 'zod';

export const LookupErrorArgsSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'The search query to use based on the screenshot. Include error messages, library names, version numbers, and key symptoms.'
    ),
});

export type LookupErrorArgs = z.infer<typeof LookupErrorArgsSchema>;

export const lookupErrorTool = {
  type: 'function' as const,
  function: {
    name: 'lookup_error',
    description:
      'Searches the web for technical documentation, coding errors, and other details to help with debugging the error.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to use based on the screenshot',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

export const imgDebugTools = [lookupErrorTool];
