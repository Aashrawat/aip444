import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  embedTexts,
  sanitizeTsvField,
  serializeProduct,
  type Product,
} from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PRODUCTS_URL = 'https://dummyjson.com/products?limit=200';

async function main(): Promise<void> {
  console.log('Fetching products from DummyJSON...');
  const response = await fetch(PRODUCTS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch products (${response.status})`);
  }

  const data = (await response.json()) as { products: Product[] };
  const products = data.products;

  const productsPath = path.join(__dirname, 'products.json');
  await writeFile(productsPath, JSON.stringify(products, null, 2), 'utf-8');
  console.log(`Saved ${products.length} products to products.json`);

  const serialized = products.map((product) => serializeProduct(product));

  console.log('Generating embeddings...');
  const embeddings = await embedTexts(serialized);

  const vectorsContent = embeddings
    .map((vector) => vector.join('\t'))
    .join('\n');
  const vectorsPath = path.join(__dirname, 'vectors.tsv');
  await writeFile(vectorsPath, vectorsContent, 'utf-8');
  console.log(`Saved ${embeddings.length} vectors to vectors.tsv`);

  const metadataLines = [
    'Title\tCategory',
    ...products.map(
      (product) =>
        `${sanitizeTsvField(product.title)}\t${sanitizeTsvField(product.category)}`
    ),
  ];
  const metadataPath = path.join(__dirname, 'metadata.tsv');
  await writeFile(metadataPath, metadataLines.join('\n'), 'utf-8');
  console.log(`Saved metadata for ${products.length} products to metadata.tsv`);

  console.log('Indexing complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
