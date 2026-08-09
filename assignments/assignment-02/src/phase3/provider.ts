import {
  setTracingDisabled,
  type Model,
  type ModelProvider,
  OpenAIChatCompletionsModel,
} from '@openai/agents';
import OpenAI from 'openai';

import { getOpenRouterApiKey, resolveModelName } from '../lib/env.js';

/**
 * OpenRouter-backed ModelProvider for the OpenAI Agents SDK.
 * Adapted from labs/lab-09/provider.ts.
 */
export class OpenRouterModelProvider implements ModelProvider {
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? getOpenRouterApiKey(),
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/Aashrawat/AIP444',
        'X-OpenRouter-Title': 'AIP444 Assignment 02 Job Search Advisor',
      },
    });
    this.defaultModel = defaultModel ?? resolveModelName();
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

export { resolveModelName };
