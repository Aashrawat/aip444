import {
  LLM_MODEL,
  buildRagPrompt,
  openaiClient,
  retrieveChunks,
  rerankChunks,
} from './utils.js';

async function main(): Promise<void> {
  const question = process.argv.slice(2).join(' ').trim();

  if (!question) {
    console.error('Usage: npm run ask -- "your question here"');
    process.exit(1);
  }

  const candidates = await retrieveChunks(question, 25);
  const contextChunks = await rerankChunks(question, candidates, 5);

  console.error('Retrieved sources:');
  for (const chunk of contextChunks) {
    console.error(
      `  - ${chunk.metadata.source} (${chunk.metadata.breadcrumb}) [rerank: ${chunk.rerankScore?.toFixed(4) ?? 'n/a'}]`
    );
  }
  console.error();

  const prompt = buildRagPrompt(question, contextChunks);

  const response = await openaiClient.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const answer = response.choices[0]?.message?.content?.trim();

  if (!answer) {
    console.error('No response from model.');
    process.exit(1);
  }

  console.log(answer);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
