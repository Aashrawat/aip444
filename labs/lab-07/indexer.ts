import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chunkMarkdown } from './chunker.js';
import { getCollection } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const collection = await getCollection();
  const docsDir = path.join(__dirname, 'docs');
  const files = await fs.readdir(docsDir);

  for (const file of files) {
    if (!file.endsWith('.md')) {
      continue;
    }

    console.log(`Processing ${file}...`);
    const text = await fs.readFile(path.join(docsDir, file), 'utf-8');
    const chunks = chunkMarkdown(text, file);

    if (chunks.length === 0) {
      continue;
    }

    const ids = chunks.map((chunk) => chunk.id);
    const documents = chunks.map((chunk) => chunk.content);
    const metadatas = chunks.map((chunk) => chunk.metadata);

    await collection.upsert({
      ids,
      documents,
      metadatas,
    });
  }

  console.log('Indexing complete!');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
