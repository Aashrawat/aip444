import {
  setTracingDisabled,
  type Model,
  type ModelProvider,
  OpenAIChatCompletionsModel,
} from '@openai/agents';
import OpenAI from 'openai';

/**
 * OpenRouter-backed ModelProvider for the OpenAI Agents SDK.
 * Adapted from the SDK's custom-example-provider.ts pattern.
 */
export class OpenRouterModelProvider implements ModelProvider {
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(apiKey: string, defaultModel: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/Aashrawat/AIP444',
        'X-OpenRouter-Title': 'Lab 09 Source Credibility Analyzer',
      },
    });
    this.defaultModel = defaultModel;
    // Tracing expects an OpenAI platform key; disable when using OpenRouter only.
    setTracingDisabled(true);
  }

  async getModel(modelName?: string | undefined): Promise<Model> {
    // Cast avoids TS dual-package private-field mismatch between root openai and
    // the openai instance type expected by @openai/agents-openai.
    return new OpenAIChatCompletionsModel(
      this.client as unknown as ConstructorParameters<
        typeof OpenAIChatCompletionsModel
      >[0],
      modelName || this.defaultModel
    );
  }
}

export function resolveModelName(): string {
  const configured = process.env.OPENROUTER_MODEL?.split(',')
    .map((m) => m.trim())
    .filter(Boolean)[0];

  // openrouter/free is flaky for multi-step tool calling (see Lab 08).
  const fallback = 'openai/gpt-5.4-mini';
  if (!configured || configured === 'openrouter/free') {
    return fallback;
  }
  return configured;
}
