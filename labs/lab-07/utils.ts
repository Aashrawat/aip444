import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { ChromaClient, type EmbeddingFunction } from 'chromadb';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
} else {
  dotenv.config({ quiet: true });
}

export const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
export const LLM_MODEL = 'google/gemini-3.1-flash-lite-preview';
export const RERANK_MODEL = 'cohere/rerank-v3.5';
export const COLLECTION_NAME = 'node-docs';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error('OPENROUTER_API_KEY not found in environment');
}

export const openaiClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
});

export class OpenRouterEmbeddingFunction implements EmbeddingFunction {
  private model: string;

  constructor(model: string = EMBEDDING_MODEL) {
    this.model = model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    const response = await openaiClient.embeddings.create({
      model: this.model,
      input: texts,
    });

    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}

export const chromaClient = new ChromaClient({
  host: 'localhost',
  port: 8000,
});

const embeddingFunction = new OpenRouterEmbeddingFunction();

export interface DocChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    heading: string;
    breadcrumb: string;
  };
  distance?: number;
  similarity?: number;
  chromaRank?: number;
  rerankScore?: number;
}

export async function getCollection() {
  return chromaClient.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction,
    configuration: {
      hnsw: {
        space: 'cosine',
      },
    },
  });
}

export async function embedQuery(query: string): Promise<number[]> {
  const response = await openaiClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: [query],
  });

  return response.data[0].embedding;
}

export async function retrieveChunks(query: string, topK: number = 25): Promise<DocChunk[]> {
  const collection = await getCollection();
  const results = await collection.query({
    queryTexts: [query],
    nResults: topK,
    include: ['documents', 'metadatas', 'distances'],
  });

  const ids = results.ids[0] ?? [];
  const documents = results.documents[0] ?? [];
  const metadatas = results.metadatas[0] ?? [];
  const distances = results.distances[0] ?? [];

  return ids.map((id, index) => {
    const distance = distances[index] ?? 0;
    const metadata = metadatas[index] as DocChunk['metadata'];

    return {
      id,
      content: documents[index] ?? '',
      metadata,
      distance,
      similarity: 1 - distance,
      chromaRank: index + 1,
    };
  });
}

export async function rerankChunks(
  query: string,
  candidates: DocChunk[],
  topN: number = 5
): Promise<DocChunk[]> {
  if (candidates.length === 0) {
    return [];
  }

  const documents = candidates.map((chunk) => chunk.content);

  const response = await fetch('https://openrouter.ai/api/v1/rerank', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query,
      documents,
      top_n: topN,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Rerank API failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    results: Array<{ index: number; relevance_score: number }>;
  };

  return data.results.map((result) => ({
    ...candidates[result.index],
    rerankScore: result.relevance_score,
  }));
}

export function buildRagPrompt(question: string, chunks: DocChunk[]): string {
  const contextDocs = chunks
    .map(
      (chunk) =>
        `<doc source="${chunk.metadata.source}" breadcrumb="${chunk.metadata.breadcrumb}">\n${chunk.content}\n</doc>`
    )
    .join('\n');

  return [
    'You are ask-node, an expert node.js assistant that answers questions about Node.js.',
    '',
    'Here is some context from the official documentation:',
    '',
    '<context>',
    contextDocs,
    '</context>',
    '',
    'Instructions:',
    "1. Answer the user's question based ONLY on the provided context.",
    '2. If the answer is not in the context, say "I don\'t have enough information to answer that."',
    '3. Cite the source file(s) (e.g., fs.md) for your information.',
    '',
    `User question: ${question}`,
  ].join('\n');
}
