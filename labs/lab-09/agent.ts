import fs from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Agent, Runner } from '@openai/agents';

import { OpenRouterModelProvider, resolveModelName } from './provider.js';
import { credibilityTools } from './tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
} else {
  dotenv.config({ quiet: true });
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('Error: OPENROUTER_API_KEY not found');
  process.exit(1);
}

if (!process.env.TAVILY_API_KEY) {
  console.error('Error: TAVILY_API_KEY not found');
  console.error('Add your Tavily API key to the project .env (see https://app.tavily.com).');
  process.exit(1);
}

console.error('credibility-analyzer: Developed by: Aashrawat Shrestha-179413232');

const modelName = resolveModelName();
console.error(`Model: ${modelName}`);

const MAX_TURNS = Number(process.env.MAX_TURNS ?? 20);

function usage(): never {
  console.error(`Usage:
  npm run analyze -- <url>
  npm run analyze -- <url> "optional extra instructions"

Example:
  npm run analyze -- "https://www.reuters.com/..."
`);
  process.exit(1);
}

function printTrace(items: unknown[]): void {
  console.error('\n========== AGENT TRACE ==========');
  let step = 0;
  for (const item of items) {
    const anyItem = item as {
      type?: string;
      rawItem?: Record<string, unknown>;
      name?: string;
      output?: unknown;
      content?: unknown;
    };

    const type = anyItem.type ?? 'item';
    const raw = anyItem.rawItem ?? {};

    if (type === 'tool_call_item' || raw.type === 'function_call') {
      step += 1;
      const name = (raw.name as string) || anyItem.name || 'tool';
      const args = (raw.arguments as string) || '';
      const preview = args.length > 400 ? `${args.slice(0, 400)}…` : args;
      console.error(`\n[step ${step}] TOOL CALL → ${name}`);
      console.error(preview);
    } else if (
      type === 'tool_call_output_item' ||
      raw.type === 'function_call_result'
    ) {
      const name = (raw.name as string) || 'tool';
      const output =
        typeof anyItem.output === 'string'
          ? anyItem.output
          : JSON.stringify(anyItem.output ?? raw.output ?? '', null, 2);
      const preview =
        output.length > 600 ? `${output.slice(0, 600)}…` : output;
      console.error(`\n[step ${step}] TOOL RESULT ← ${name}`);
      console.error(preview);
    } else if (type === 'message_output_item' || raw.type === 'message') {
      step += 1;
      const content =
        typeof anyItem.content === 'string'
          ? anyItem.content
          : JSON.stringify(raw.content ?? anyItem.content ?? '', null, 2);
      const preview =
        content.length > 800 ? `${content.slice(0, 800)}…` : content;
      console.error(`\n[step ${step}] MESSAGE`);
      console.error(preview);
    } else {
      console.error(`\n[${type}] ${JSON.stringify(raw).slice(0, 300)}`);
    }
  }
  console.error('\n========== END TRACE ==========\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  if (args.length < 1) usage();

  const url = args[0];
  const extra = args.slice(1).join(' ').trim();

  try {
    new URL(url);
  } catch {
    console.error(`Error: invalid URL: ${url}`);
    process.exit(1);
  }

  const instructions = await readFile(
    path.join(__dirname, 'SYSTEM_PROMPT.md'),
    'utf-8'
  );

  const provider = new OpenRouterModelProvider(apiKey!, modelName);
  const runner = new Runner({ modelProvider: provider });

  const agent = new Agent({
    name: 'Source Credibility Analyzer',
    instructions,
    tools: credibilityTools,
    model: modelName,
  });

  const userPrompt = [
    `Evaluate the credibility of this source: ${url}`,
    extra ? `\nAdditional instructions: ${extra}` : '',
    '\nFollow your investigation workflow. Use assess_credibility before save_report.',
  ].join('');

  console.error(`URL: ${url}`);
  console.error(`maxTurns: ${MAX_TURNS}`);
  console.error('Running agent…\n');

  const result = await runner.run(agent, userPrompt, { maxTurns: MAX_TURNS });

  printTrace(result.newItems as unknown[]);

  console.log(result.finalOutput ?? '(no final output)');
}

main().catch((err) => {
  console.error('Agent failed:', err);
  process.exit(1);
});
