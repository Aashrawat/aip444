import fs from 'node:fs';
import sharp from 'sharp';

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 85;

/**
 * Resize (longest side <= 1024px), convert to JPEG @ 85% quality, return base64.
 * Logs original vs processed size to stderr.
 */
export async function processImage(path: string): Promise<string> {
  if (!fs.existsSync(path)) {
    throw new Error(`Image not found: ${path}`);
  }

  const originalBytes = fs.statSync(path).size;
  const originalMeta = await sharp(path).metadata();

  const buffer = await sharp(path)
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const processedMeta = await sharp(buffer).metadata();

  console.error(
    `[img-debug] image: ${path}` +
      `\n  before: ${originalBytes.toLocaleString()} bytes` +
      ` (${originalMeta.width ?? '?'}x${originalMeta.height ?? '?'}, ${originalMeta.format ?? 'unknown'})` +
      `\n  after:  ${buffer.length.toLocaleString()} bytes` +
      ` (${processedMeta.width ?? '?'}x${processedMeta.height ?? '?'}, jpeg q=${JPEG_QUALITY})`
  );

  return buffer.toString('base64');
}
