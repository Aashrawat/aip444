import fs from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
} else {
  dotenv.config({ quiet: true });
}

const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
// Between "Nice smelling scent" top (~0.41) and "quantum physics textbook" top (~0.15).
export const MIN_SIMILARITY_SCORE = 0.30;

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error('OPENROUTER_API_KEY not found in environment');
}

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
});

export interface Product {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  tags?: string[];
  brand?: string;
  embedding?: number[];
  vectorScore?: number;
  rerankScore?: number;
  [key: string]: unknown;
}

export function serializeProduct(product: Product): string {
  const tags = Array.isArray(product.tags) ? product.tags.join(', ') : '';
  const brand = product.brand ?? '';

  return [
    `Title: ${product.title}`,
    `Category: ${product.category}`,
    `Description: ${product.description}`,
    `Tags: ${tags}`,
    `Brand: ${brand}`,
  ].join(' | ');
}

export function dotProduct(vecA: number[], vecB: number[]): number {
  return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
}

export function sanitizeTsvField(value: string): string {
  return value.replace(/[\t\n\r]/g, ' ').trim();
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await embedTexts([query]);
  return embedding;
}

export async function loadDatabase(): Promise<Product[]> {
  const productsPath = path.join(__dirname, 'products.json');
  const vectorsPath = path.join(__dirname, 'vectors.tsv');

  const productsData = await readFile(productsPath, 'utf-8');
  const products = JSON.parse(productsData) as Product[];

  const vectorsData = await readFile(vectorsPath, 'utf-8');
  const lines = vectorsData.trim().split('\n');

  return products.map((product, index) => {
    const vectorString = lines[index];
    const vector = vectorString.split('\t').map(Number);
    return { ...product, embedding: vector };
  });
}

export async function rerankResults(
  query: string,
  candidates: Product[],
  topN: number = 5
): Promise<Product[]> {
  const documents = candidates.map((product) => serializeProduct(product));

  const response = await fetch('https://openrouter.ai/api/v1/rerank', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'cohere/rerank-v3.5',
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

export async function searchProducts(
  query: string,
  products: Product[],
  minScore: number = MIN_SIMILARITY_SCORE
): Promise<Product[]> {
  const queryEmbedding = await embedQuery(query);

  const scored = products
    .map((product) => ({
      ...product,
      vectorScore: dotProduct(queryEmbedding, product.embedding ?? []),
    }))
    .filter((product) => (product.vectorScore ?? 0) >= minScore)
    .sort((a, b) => (b.vectorScore ?? 0) - (a.vectorScore ?? 0));

  const candidates = scored.slice(0, 20);
  if (candidates.length === 0) {
    return [];
  }

  return rerankResults(query, candidates, 5);
}
