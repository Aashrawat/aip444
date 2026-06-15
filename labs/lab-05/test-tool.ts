import { readGitHubFiles } from './tools.js';

async function test() {
  console.log('Testing read_github_files...\n');

  const content = await readGitHubFiles([
    {
      owner: 'microsoft',
      repo: 'vscode',
      path: 'package.json',
      ref: 'main',
    },
  ]);

  console.log(content);
  console.log('\n--- Edge case: missing file ---\n');

  const missing = await readGitHubFiles([
    {
      owner: 'microsoft',
      repo: 'vscode',
      path: 'this-file-does-not-exist.txt',
      ref: 'main',
    },
  ]);

  console.log(missing);
  console.log('\n--- Multi-file request ---\n');

  const multi = await readGitHubFiles([
    {
      owner: 'microsoft',
      repo: 'vscode',
      path: 'README.md',
      ref: 'main',
    },
    {
      owner: 'microsoft',
      repo: 'vscode',
      path: 'package.json',
      ref: 'main',
    },
  ]);

  console.log(multi.slice(0, 500));
  console.log('\n... (truncated output for readability)');
}

test().catch((error) => {
  console.error(error);
  process.exit(1);
});
