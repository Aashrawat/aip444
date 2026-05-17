const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const { execSync } = require('child_process');

const isCreative = process.argv.includes('--creative');

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

console.log("git-cm:Developed by: Aashrawat Shrestha-179413232");

const pad = (value) => String(value).padStart(2, '0');
const now = new Date();
const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
console.log(`Run Date:${formatted}`);

let diff = '';
try {
  diff = execSync('git diff --staged', { encoding: 'utf8' });
} catch (error) {
  console.error('Error: git diff --staged failed');
  process.exit(1);
}

if (!diff) {
  console.log('No staged changes found');
  process.exit(0);
}

console.log(`Diff found: ${diff.length} characters`);

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
});

const defaultSystemPrompt = [
  'You are an LLM running in a CLI tool that writes semantic commit messages for the user.',
  'You will be given the output from git diff --staged.',
  'Format the message according to Conventional Commits standards, such as "feat: add git diff support".',
  'Use a concise lowercase type like feat, fix, docs, style, refactor, test, chore, or build.',
  'Output only the commit message as plain text, with no Markdown, quotes, explanation, or extra lines.',
].join(' ');
const creativeSystemPrompt = [
  'You are an LLM running in a CLI tool that writes commit messages for the user.',
  'You will be given the output from git diff --staged.',
  'Use Gitmoji and write one commit message in dramatic 17th Century pirate slang.',
  'Make it playful and clearly different from a normal Conventional Commits message.',
  'Output only the commit message as plain text, with no Markdown, quotes, explanation, or extra lines.',
].join(' ');
const systemPrompt = isCreative ? creativeSystemPrompt : defaultSystemPrompt;
const temperature = isCreative ? 1.2 : 0.1;

const defaultModels = [
  'openrouter/free',
  'google/gemma-4-31b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];
const configuredModels = (process.env.OPENROUTER_MODEL || '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const models = [...new Set([...configuredModels, ...defaultModels])];
const maxRetries = Number(process.env.OPENROUTER_MAX_RETRIES || 3);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getRetryDelay(error, retryNumber) {
  const retryAfter = error.headers?.['retry-after'] || error.headers?.get?.('retry-after');
  const retryAfterSeconds = Number(retryAfter);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return 1000 * 2 ** (retryNumber - 1);
}

async function createCommitMessage() {
  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: diff },
        ],
        temperature,
        max_tokens: 60,
      });

        const message = completion.choices[0]?.message?.content?.trim();
        if (!message) {
          const emptyResponseError = new Error('The model returned an empty commit message');
          emptyResponseError.code = 'EMPTY_RESPONSE';
          throw emptyResponseError;
        }

        return message.split(/\r?\n/)[0].replace(/^["'`]|["'`]$/g, '');
      } catch (error) {
        lastError = error;
        const status = error.status || error.code;
        const shouldRetry = status === 429 || status === 'EMPTY_RESPONSE';

        if (!shouldRetry) {
          break;
        }

        if (attempt < maxRetries) {
          const delay = getRetryDelay(error, attempt);
          const reason = status === 429 ? 'rate-limited' : 'empty';
          console.error(`Model ${model} returned ${reason}. Retrying in ${delay / 1000}s...`);
          await sleep(delay);
        } else {
          const reason = status === 429 ? 'still rate-limited' : 'still empty';
          console.error(`Model ${model} is ${reason}. Trying the next model...`);
        }
      }
    }
  }

  throw lastError;
}

createCommitMessage()
  .then((commitMessage) => {
    console.log(commitMessage);
  })
  .catch((error) => {
    console.error('Error: failed to generate commit message');
    if (error.status) {
      console.error(`Status: ${error.status}`);
    }
    if (error.message) {
      console.error(error.message);
    }
    process.exit(1);
  });

