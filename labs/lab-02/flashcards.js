const fs = require('fs');
const path = require('path');
const { readFile } = require('node:fs/promises');
const { parseArgs } = require('node:util');
const dotenv = require('dotenv');
const OpenAI = require('openai');

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
} else {
  dotenv.config({ quiet: true });
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('❌ Error: OPENROUTER_API_KEY not found');
  process.exit(1);
}

console.log('flashcards:Developed by: Aashrawat Shrestha-179413232');

const pad = (value) => String(value).padStart(2, '0');
const now = new Date();
const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
console.log(`Run Date:${formatted}`);

function parseArguments() {
  const options = {
    cards: {
      type: 'string',
      short: 'c',
      default: '3',
    },
  };

  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({ options, allowPositionals: true }));
  } catch (err) {
    console.error('❌ Error parsing arguments:', err.message);
    process.exit(1);
  }

  if (positionals.length === 0) {
    console.error('❌ Error: Please provide a path to notes file');
    console.error('Usage: node flashcards.js <notes-path> [--cards N]');
    process.exit(1);
  }

  const notesPath = positionals[0];
  const cards = parseInt(values.cards, 10);

  if (Number.isNaN(cards) || cards < 1 || cards > 5) {
    console.error('❌ Error: --cards must be between 1 and 5');
    process.exit(1);
  }

  return { notesPath, cards };
}

async function getFileContents(filePath, description) {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`❌ Error: ${description} not found: ${filePath}`);
    } else {
      console.error(`❌ Error reading ${description}: ${filePath}`);
      console.error(`   ${err.message}`);
    }
    process.exit(1);
  }
}

function buildUserPrompt(notesContent, cardCount) {
  return [
    'Generate ACE flashcards from the course notes below.',
    `Produce exactly ${cardCount} flashcard(s) unless the notes are insufficient—then follow the edge-case instructions in your system prompt.`,
    '',
    'Critical reminders:',
    '- Ground every field in the notes; do not hallucinate.',
    '- EVIDENCE must be a verbatim quote from the notes.',
    '- Expand all acronyms in CHALLENGE.',
    '- MISCONCEPTION must be quoted student speech.',
    '',
    '<course_notes>',
    notesContent,
    '</course_notes>',
    '',
    `End task: output ${cardCount} grounded ACE card(s) in the required format, or a clear error message if the notes cannot support that request.`,
  ].join('\n');
}

function extractCards(output) {
  const cardRegex = /=== CARD \d+ ===[\s\S]*?===/g;
  return output.match(cardRegex) || [];
}

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
});

const defaultModels = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct',
  'openrouter/free',
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

async function generateFlashcards(systemPrompt, userPrompt) {
  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        });

        const output = completion.choices[0]?.message?.content?.trim();
        if (!output) {
          const emptyResponseError = new Error('The model returned an empty response');
          emptyResponseError.code = 'EMPTY_RESPONSE';
          throw emptyResponseError;
        }

        return output;
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

async function main() {
  const { notesPath, cards } = parseArguments();

  const resolvedNotesPath = path.isAbsolute(notesPath)
    ? notesPath
    : path.resolve(process.cwd(), notesPath);

  const systemPromptPath = path.join(__dirname, 'SYSTEM_PROMPT.md');
  const [systemPrompt, notesContent] = await Promise.all([
    getFileContents(systemPromptPath, 'System prompt file'),
    getFileContents(resolvedNotesPath, 'Notes file'),
  ]);

  const userPrompt = buildUserPrompt(notesContent, cards);
  const output = await generateFlashcards(systemPrompt, userPrompt);
  const extractedCards = extractCards(output);

  if (extractedCards.length === 0) {
    console.log('\n⚠️  No ACE cards found in model output. Response:\n');
    console.log(output);
    process.exit(0);
  }

  console.log(`\n✅ Generated ${extractedCards.length} flashcard(s):\n`);
  extractedCards.forEach((card) => {
    console.log(card);
    console.log();
  });
}

main().catch((error) => {
  console.error('❌ Error: failed to generate flashcards');
  if (error.status) {
    console.error(`Status: ${error.status}`);
  }
  if (error.message) {
    console.error(error.message);
  }
  process.exit(1);
});
