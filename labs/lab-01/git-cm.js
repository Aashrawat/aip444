const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { execSync } = require('child_process');


const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
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

async function generateCommitMessage() {
  try {
    const systemPrompt = `You are an LLM running in a CLI tool which writes semantic commit messages for the user. You will be given a git diff. You must output ONLY the commit message using the Conventional Commits standard format (e.g., 'feat: add logging').

Respond in plain text suitable for pasting into git commit -m '...your commit message...'; just the plain text commit message with no Markdown, no rationale about why you chose it, etc.`;

    const userPrompt = `Generate a semantic commit message for the following git diff:\n\n${diff}`;

    const response = await fetch('https://openrouter.io/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it:free',
        max_tokens: 100,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorData = {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: errorText,
      };
      if (response.status === 429) {
        console.error('Rate limited (429). Please try again later or use a different model.');
      } else {
        console.error('API Error Response:', JSON.stringify(errorData, null, 2));
      }
      process.exit(1);
    }

    const data = await response.json();
    const commitMessage = data.choices[0].message.content.trim();
    console.log('\nGenerated commit message:');
    console.log(commitMessage);
    return commitMessage;
  } catch (error) {
    console.error('Error generating commit message:', error.message);
    process.exit(1);
  }
}

generateCommitMessage();