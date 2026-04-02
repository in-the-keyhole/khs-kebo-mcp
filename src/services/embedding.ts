import { getLlama, LlamaEmbeddingContext, LlamaModel } from 'node-llama-cpp';
import { config } from '../config.js';

// Singleton model + context — loaded once, reused across calls
let _embeddingContext: LlamaEmbeddingContext | null = null;
let _embeddingModel: LlamaModel | null = null;

export async function getEmbeddingContext(): Promise<LlamaEmbeddingContext> {
  if (_embeddingContext) return _embeddingContext;

  const llama = await getLlama();
  _embeddingModel = await llama.loadModel({
    modelPath: await resolveModelPath(config.EMBEDDING_HF_REPO, config.EMBEDDING_HF_FILE),
  });
  _embeddingContext = await _embeddingModel.createEmbeddingContext();
  return _embeddingContext;
}

export async function embedText(text: string): Promise<number[]> {
  const ctx = await getEmbeddingContext();
  const result = await ctx.getEmbeddingFor(text);
  return Array.from(result.vector);
}

export async function disposeEmbeddingContext(): Promise<void> {
  if (_embeddingContext) {
    await _embeddingContext.dispose();
    _embeddingContext = null;
  }
  if (_embeddingModel) {
    await _embeddingModel.dispose();
    _embeddingModel = null;
  }
}

/**
 * Resolve a HuggingFace model to a local GGUF path, downloading if needed.
 * Models are stored in <project-root>/models/.
 */
async function resolveModelPath(repo: string, filename: string): Promise<string> {
  const path = await import('path');
  const { createModelDownloader } = await import('node-llama-cpp');

  const downloader = await createModelDownloader({
    modelUri: `hf:${repo}/${filename}`,
    dirPath: path.join(process.cwd(), 'models'),
  });

  if (downloader.totalFiles > 0) {
    console.error(`Downloading embedding model ${repo}/${filename}...`);
    await downloader.download();
    console.error('Embedding model download complete.');
  }

  return downloader.entrypointFilePath;
}

// ─── Pure utility functions (tested without model ─────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  if (a.length === 0) throw new Error('Cannot compute similarity of empty vector');

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) {
    throw new Error('Cannot compute similarity: zero-magnitude vector');
  }
  return dot / (magA * magB);
}

export function validateEmbeddingDimensions(vector: number[], expected: number): void {
  if (vector.length === 0) throw new Error('Embedding vector is empty');
  if (vector.length !== expected) {
    throw new Error(
      `Embedding dimension mismatch: got ${vector.length}, expected ${expected}`,
    );
  }
}
