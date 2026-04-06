import { sql } from 'drizzle-orm';
import { embedText, validateFiniteVector } from '../services/embedding.js';
import { documentEmbeddings } from '../db/schema.js';
import type { Db } from '../db/client.js';
import type { InsightResult, StructuredSummary, BudgetTier, EngagementType } from '../types.js';

interface QueryOptions {
  threshold?: number; // cosine similarity threshold (default 0.7)
  limit?: number;     // max documents to consider (default 10)
}

/**
 * Embed a natural language query, find similar documents, and return
 * aggregated insights — industry frequency, tech stack, budget tiers, etc.
 * Never exposes individual document content or identity.
 */
export async function queryInsights(
  query: string,
  db: Db,
  options: QueryOptions = {},
): Promise<InsightResult> {
  const threshold = options.threshold ?? 0.3;
  const limit = options.limit ?? 10;

  const queryVector = await embedText(query);
  validateFiniteVector(queryVector); // guard before interpolating into raw SQL

  // pgvector cosine distance: 1 - (embedding <=> query) = cosine similarity
  // We use raw SQL for the vector operator since Drizzle doesn't expose <=>
  const rows = await db.execute<{
    structured_summary: StructuredSummary;
    similarity: number;
  }>(
    sql`
      SELECT structured_summary, 1 - (embedding <=> ${sql.raw(`'[${queryVector.join(',')}]'`)}::vector) AS similarity
      FROM document_embeddings
      WHERE 1 - (embedding <=> ${sql.raw(`'[${queryVector.join(',')}]'`)}::vector) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `,
  );

  return aggregateSummaries(rows.map((r) => r.structured_summary), threshold);
}

function aggregateSummaries(
  summaries: StructuredSummary[],
  similarityThreshold: number,
): InsightResult {
  const industries: Record<string, number> = {};
  const techStack: Record<string, number> = {};
  const budgetTiers: Record<BudgetTier, number> = { startup: 0, smb: 0, enterprise: 0 };
  const cloudProviders: Record<string, number> = {};
  const engagementTypes: Record<EngagementType, number> = {
    greenfield: 0,
    migration: 0,
    support: 0,
    augmentation: 0,
  };

  for (const s of summaries) {
    industries[s.industry] = (industries[s.industry] ?? 0) + 1;
    budgetTiers[s.budget_tier] = (budgetTiers[s.budget_tier] ?? 0) + 1;
    engagementTypes[s.engagement_type] = (engagementTypes[s.engagement_type] ?? 0) + 1;

    for (const tech of s.tech_stack) {
      techStack[tech] = (techStack[tech] ?? 0) + 1;
    }
    for (const provider of s.cloud_providers) {
      cloudProviders[provider] = (cloudProviders[provider] ?? 0) + 1;
    }
  }

  return {
    industries,
    techStack,
    budgetTiers,
    cloudProviders,
    engagementTypes,
    documentCount: summaries.length,
    similarityThreshold,
  };
}
