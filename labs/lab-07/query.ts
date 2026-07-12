import { retrieveChunks, rerankChunks } from './utils.js';

async function main(): Promise<void> {
  const query = process.argv.slice(2).join(' ').trim();

  if (!query) {
    console.error('Usage: npm run query -- "your question here"');
    process.exit(1);
  }

  console.log(`Query: "${query}"\n`);

  const candidates = await retrieveChunks(query, 25);
  const results = await rerankChunks(query, candidates, 5);

  if (results.length === 0) {
    console.log('No results found.');
    return;
  }

  for (const [index, chunk] of results.entries()) {
    const rerankScore = chunk.rerankScore?.toFixed(4) ?? 'n/a';
    const similarity = chunk.similarity?.toFixed(4) ?? 'n/a';
    const distance = chunk.distance?.toFixed(4) ?? 'n/a';
    const chromaRank = chunk.chromaRank ?? 'n/a';

    console.log(
      `${index + 1}. [Rerank: ${rerankScore} | Similarity: ${similarity} | Chroma Rank: ${chromaRank}]`
    );
    console.log(`   Source: ${chunk.metadata.source}`);
    console.log(`   Breadcrumb: ${chunk.metadata.breadcrumb}`);
    console.log(`   Distance: ${distance}`);
    console.log(`   Preview: ${chunk.content.slice(0, 120).replace(/\n/g, ' ')}...`);
    console.log();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
