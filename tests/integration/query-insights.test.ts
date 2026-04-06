/**
 * Integration tests for the query_insights flow.
 * Embedding model is mocked with pre-computed fixture vectors.
 * DB uses a real pgvector container with seeded embeddings.
 */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/services/embedding.js', () => ({
  embedText: jest.fn(),
  cosineSimilarity: jest.fn(),
  validateEmbeddingDimensions: jest.fn(),
  validateFiniteVector: jest.fn(),
  getEmbeddingContext: jest.fn(),
  disposeEmbeddingContext: jest.fn(),
}));

const { embedText } = await import('../../src/services/embedding.js');
const { startTestDb, stopTestDb } = await import('./db-setup.js');
const { documents, documentEmbeddings } = await import('../../src/db/schema.js');
const { getDb } = await import('../../src/db/client.js');
const { queryInsights } = await import('../../src/tools/query-insights.js');

type MockedFn<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;
const mockEmbedText = embedText as MockedFn<typeof embedText>;

// Fixture vectors: two similar "fintech/AWS" docs, one dissimilar "healthcare/Azure" doc
function makeVector(seed: number, dims = 1024): number[] {
  return Array.from({ length: dims }, (_, i) => Math.sin(i * seed) * 0.1);
}
const FINTECH_VECTOR = makeVector(1.0);
const HEALTHCARE_VECTOR = makeVector(50.0); // very different direction

let testDb: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  testDb = await startTestDb();
  const db = getDb(testDb.connectionUrl);

  // Seed documents
  const [doc1] = await db
    .insert(documents)
    .values({ driveFileId: 'q-doc-1', title: 'Fintech Project A', mimeType: 'text/plain', contentRedacted: 'react aws fintech' })
    .returning();
  const [doc2] = await db
    .insert(documents)
    .values({ driveFileId: 'q-doc-2', title: 'Fintech Project B', mimeType: 'text/plain', contentRedacted: 'node aws fintech' })
    .returning();
  const [doc3] = await db
    .insert(documents)
    .values({ driveFileId: 'q-doc-3', title: 'Healthcare Project', mimeType: 'text/plain', contentRedacted: 'python azure healthcare' })
    .returning();

  // Seed embeddings with fixture vectors
  await db.insert(documentEmbeddings).values([
    {
      documentId: doc1.id,
      embedding: FINTECH_VECTOR,
      modelName: 'test-model',
      structuredSummary: { industry: 'fintech', tech_stack: ['React'], budget_tier: 'enterprise', cloud_providers: ['AWS'], engagement_type: 'greenfield' },
    },
    {
      documentId: doc2.id,
      embedding: FINTECH_VECTOR,
      modelName: 'test-model',
      structuredSummary: { industry: 'fintech', tech_stack: ['Node.js'], budget_tier: 'smb', cloud_providers: ['AWS'], engagement_type: 'migration' },
    },
    {
      documentId: doc3.id,
      embedding: HEALTHCARE_VECTOR,
      modelName: 'test-model',
      structuredSummary: { industry: 'healthcare', tech_stack: ['Python'], budget_tier: 'startup', cloud_providers: ['Azure'], engagement_type: 'support' },
    },
  ]);
}, 120_000);

afterAll(async () => {
  await stopTestDb(testDb);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('queryInsights', () => {
  it('returns aggregated insights from similar documents', async () => {
    mockEmbedText.mockResolvedValue(FINTECH_VECTOR);

    const db = getDb(testDb.connectionUrl);
    const result = await queryInsights('fintech cloud architecture', db, { threshold: 0.5, limit: 10 });

    expect(result.documentCount).toBeGreaterThanOrEqual(1);
    expect(result.industries['fintech']).toBeGreaterThanOrEqual(1);
    expect(result.cloudProviders['AWS']).toBeGreaterThanOrEqual(1);
  });

  it('aggregates tech stack frequencies across matched documents', async () => {
    mockEmbedText.mockResolvedValue(FINTECH_VECTOR);
    const db = getDb(testDb.connectionUrl);

    const result = await queryInsights('fintech projects', db, { threshold: 0.5, limit: 10 });

    // Both fintech docs have different stacks — both should appear
    // Note: toHaveProperty(['Node.js']) uses array form to avoid '.' being treated as path separator
    expect(result.techStack).toHaveProperty(['React']);
    expect(result.techStack).toHaveProperty(['Node.js']);
  });

  it('does not reveal individual client data — returns aggregates only', async () => {
    mockEmbedText.mockResolvedValue(FINTECH_VECTOR);
    const db = getDb(testDb.connectionUrl);
    const result = await queryInsights('cloud projects', db, { threshold: 0.5, limit: 10 });

    // Result should not contain raw document content
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain('contentRedacted');
    expect(serialised).not.toContain('driveFileId');
    expect(result).toHaveProperty('industries');
    expect(result).toHaveProperty('techStack');
    expect(result).toHaveProperty('budgetTiers');
    expect(result).toHaveProperty('cloudProviders');
    expect(result).toHaveProperty('engagementTypes');
  });

  it('dissimilar query vector matches healthcare doc, not fintech docs', async () => {
    mockEmbedText.mockResolvedValue(HEALTHCARE_VECTOR);
    const db = getDb(testDb.connectionUrl);

    const result = await queryInsights('healthcare analytics', db, { threshold: 0.5, limit: 10 });

    expect(result.industries['healthcare']).toBeGreaterThanOrEqual(1);
    // fintech docs should not appear at high threshold
    expect(result.industries['fintech'] ?? 0).toBe(0);
    expect(result.cloudProviders['Azure']).toBeGreaterThanOrEqual(1);
  });

  it('returns empty insights when no documents meet the threshold', async () => {
    mockEmbedText.mockResolvedValue(FINTECH_VECTOR);
    const db = getDb(testDb.connectionUrl);
    // Threshold > 1.0 is mathematically impossible (cosine similarity max is 1.0)
    const result = await queryInsights('fintech', db, { threshold: 1.01, limit: 10 });

    expect(result.documentCount).toBe(0);
    expect(Object.keys(result.industries)).toHaveLength(0);
    expect(Object.keys(result.techStack)).toHaveLength(0);
  });

  it('respects the result limit', async () => {
    mockEmbedText.mockResolvedValue(FINTECH_VECTOR);
    const db = getDb(testDb.connectionUrl);
    const result = await queryInsights('fintech', db, { threshold: 0.1, limit: 1 });

    expect(result.documentCount).toBeLessThanOrEqual(1);
  });
});
