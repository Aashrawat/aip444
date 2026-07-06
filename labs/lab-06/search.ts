import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { loadDatabase, searchProducts } from './utils.js';

async function main(): Promise<void> {
  console.log('Semantic Product Search');
  console.log('Type your query, or press Ctrl+C to exit.\n');

  const products = await loadDatabase();
  const rl = createInterface({ input, output });

  try {
    while (true) {
      const query = (await rl.question('What are you looking for? ')).trim();
      if (!query) {
        continue;
      }

      const results = await searchProducts(query, products);

      if (results.length === 0) {
        console.log("I'm sorry, we don't have anything like that in stock.\n");
        continue;
      }

      console.log(`\nFound ${results.length} matches:`);
      results.forEach((product, index) => {
        const rerankScore = product.rerankScore?.toFixed(2) ?? 'n/a';
        const vectorScore = product.vectorScore?.toFixed(2) ?? 'n/a';
        console.log(
          `${index + 1}. [Rerank: ${rerankScore} | Vector: ${vectorScore}] ${product.title} - $${product.price}`
        );
      });
      console.log('');
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
