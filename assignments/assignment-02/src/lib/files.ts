import fs from 'node:fs/promises';
import path from 'node:path';

import mammoth from 'mammoth';
import pdf from 'pdf-parse';

import { debugLog, warn } from './logger.js';

export async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  debugLog(`Reading document: ${filePath}`);

  try {
    if (ext === '.pdf') {
      const buffer = await fs.readFile(filePath);
      const data = await pdf(buffer);
      const text = (data.text || '').trim();
      if (!text) {
        throw new Error('PDF produced empty text (may be image-only or encrypted)');
      }
      debugLog(`PDF text length: ${text.length} chars, pages=${data.numpages}`);
      return text;
    }

    if (ext === '.docx' || ext === '.doc') {
      const result = await mammoth.extractRawText({ path: filePath });
      const text = (result.value || '').trim();
      if (!text) {
        throw new Error('Word document produced empty text');
      }
      debugLog(`Word text length: ${text.length} chars`);
      return text;
    }

    if (ext === '.txt' || ext === '.md') {
      const text = (await fs.readFile(filePath, 'utf8')).trim();
      if (!text) throw new Error('Text file is empty');
      return text;
    }

    throw new Error(`Unsupported file type: ${ext}. Use PDF, DOCX, or TXT.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warn(`Failed to parse ${filePath}: ${message}`);
    throw err;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(dir: string, extensions: string[]): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => path.join(dir, e.name))
      .filter((p) => extensions.includes(path.extname(p).toLowerCase()))
      .sort();
  } catch {
    return [];
  }
}
