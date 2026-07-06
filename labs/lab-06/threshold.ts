import {
  dotProduct,
  embedQuery,
  loadDatabase,
  MIN_SIMILARITY_SCORE,
} from './utils.js';

async function printTopMatches(label: string, query: string): Promise<void> {
  const products = await loadDatabase();
  const queryEmbedding = await embedQuery(query);

  const scored = products
    .map((product) => ({
      title: product.title,
      score: dotProduct(queryEmbedding, product.embedding ?? []),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  console.log(`\n${label}: "${query}"`);
  scored.forEach((match, index) => {
    console.log(`  ${index + 1}. [${match.score.toFixed(4)}] ${match.title}`);
  });
}

async function main(): Promise<void> {
  console.log(`Current MIN_SIMILARITY_SCORE: ${MIN_SIMILARITY_SCORE}`);

  await printTopMatches('Good match query', 'Nice smelling scent');
  await printTopMatches('Bad match query', 'A textbook on quantum physics');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
