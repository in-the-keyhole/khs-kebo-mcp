import { eq } from 'drizzle-orm';
import { generateSummary } from '../services/summarizer.js';
import { embedText } from '../services/embedding.js';
import { documents, documentEmbeddings } from '../db/schema.js';
import { config } from '../config.js';
import type { Db } from '../db/client.js';
import type { EmbedResult } from '../types.js';

const MODEL_NAME = `${config.EMBEDDING_HF_REPO}/${config.EMBEDDING_HF_FILE}`;
const EMBEDDING_DIMENSIONS = 1024; // mxbai-embed-large-v1

/**
 * Generate a structured anonymized summary, embed it, and store the vector.
 * Callable standalone for re-embedding or backfilling existing documents.
 */
export async function embedDocument(documentId: string, db: Db): Promise<EmbedResult> {
  // Fetch the stored (already redacted) document
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // Generate anonymized structured summary via local LLM
  // We pass a thin generateFn wrapper so the summarizer stays LLM-agnostic
  const summary = await generateSummary(doc.contentRedacted, async (prompt) => {
    // getLlamaModel is loaded lazily — only initialises when first called
    const { getLlamaModel } = await import('../services/llm.js');
    const model = await getLlamaModel();
    return model.generate(prompt);
  });

  // Build a flat text representation of the summary for embedding
  const summaryText = [
    `Industry: ${summary.industry}`,
    `Technologies: ${summary.tech_stack.join(', ')}`,
    `Budget tier: ${summary.budget_tier}`,
    `Cloud providers: ${summary.cloud_providers.join(', ')}`,
    `Engagement type: ${summary.engagement_type}`,
  ].join('. ');

  // Generate embedding from the anonymized summary text
  const vector = await embedText(summaryText);

  // Upsert embedding (allow re-embedding the same doc with a newer model)
  const [embedding] = await db
    .insert(documentEmbeddings)
    .values({
      documentId,
      embedding: vector,
      modelName: MODEL_NAME,
      structuredSummary: summary,
    })
    .onConflictDoNothing()
    .returning();

  return {
    documentId,
    embeddingId: embedding.id,
    modelName: MODEL_NAME,
    dimensions: EMBEDDING_DIMENSIONS,
    structuredSummary: summary,
  };
}
