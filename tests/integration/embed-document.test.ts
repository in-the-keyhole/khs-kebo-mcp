/**
 * Integration tests for the embed_document flow.
 * LLM summarizer and embedding model are mocked — DB uses a real pgvector container.
 */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/services/summarizer.js', () => ({
  generateSummary: jest.fn(),
  buildSummaryPrompt: jest.fn(),
  parseSummaryJson: jest.fn(),
}));

jest.unstable_mockModule('../../src/services/embedding.js', () => ({
  embedText: jest.fn(),
  cosineSimilarity: jest.fn(),
  validateEmbeddingDimensions: jest.fn(),
  getEmbeddingContext: jest.fn(),
  disposeEmbeddingContext: jest.fn(),
}));

const { generateSummary } = await import('../../src/services/summarizer.js');
const { embedText } = await import('../../src/services/embedding.js');
const { startTestDb, stopTestDb } = await import('./db-setup.js');
const { documents, documentEmbeddings } = await import('../../src/db/schema.js');
const { getDb } = await import('../../src/db/client.js');
const { embedDocument } = await import('../../src/tools/embed-document.js');

type MockedFn<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;
const mockGenerateSummary = generateSummary as MockedFn<typeof generateSummary>;
const mockEmbedText = embedText as MockedFn<typeof embedText>;

// Pre-computed 1024-dim fixture vector
const FIXTURE_VECTOR = Array.from({ length: 1024 }, (_, i) => Math.sin(i) * 0.1);

let testDb: Awaited<ReturnType<typeof startTestDb>>;
let storedDocId: string;

beforeAll(async () => {
  testDb = await startTestDb();

  // Seed a document to embed
  const db = getDb(testDb.connectionUrl);
  const [doc] = await db
    .insert(documents)
    .values({
      driveFileId: 'embed-test-file-001',
      title: 'Fintech Migration Project',
      mimeType: 'application/vnd.google-apps.document',
      contentRedacted: 'Client uses React, AWS Lambda, and PostgreSQL. Mid-market fintech company.',
      tags: [],
    })
    .returning();
  storedDocId = doc.id;
}, 120_000);

afterAll(async () => {
  await stopTestDb(testDb);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerateSummary.mockResolvedValue({
    industry: 'fintech',
    tech_stack: ['React', 'AWS Lambda', 'PostgreSQL'],
    budget_tier: 'smb',
    cloud_providers: ['AWS'],
    engagement_type: 'migration',
  });
  mockEmbedText.mockResolvedValue(FIXTURE_VECTOR);
});

describe('embedDocument', () => {
  it('generates and stores an embedding for an existing document', async () => {
    const db = getDb(testDb.connectionUrl);
    const result = await embedDocument(storedDocId, db);

    expect(result.documentId).toBe(storedDocId);
    expect(result.dimensions).toBe(1024);
    expect(result.structuredSummary.industry).toBe('fintech');
    expect(result.structuredSummary.tech_stack).toContain('React');
  });

  it('stores the vector in document_embeddings with correct model name', async () => {
    const { eq } = await import('drizzle-orm');
    const db = getDb(testDb.connectionUrl);

    await embedDocument(storedDocId, db);

    const rows = await db
      .select()
      .from(documentEmbeddings)
      .where(eq(documentEmbeddings.documentId, storedDocId));

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].modelName).toBe('mixedbread-ai/mxbai-embed-large-v1-GGUF/mxbai-embed-large-v1-f16.gguf');
    expect(rows[0].structuredSummary).toMatchObject({ industry: 'fintech' });
  });

  it('throws when document does not exist', async () => {
    const db = getDb(testDb.connectionUrl);
    await expect(embedDocument('00000000-0000-0000-0000-000000000000', db)).rejects.toThrow(
      /not found/i,
    );
  });

  it('calls generateSummary with the document text', async () => {
    const db = getDb(testDb.connectionUrl);
    await embedDocument(storedDocId, db);

    expect(mockGenerateSummary).toHaveBeenCalledWith(
      expect.stringContaining('React'),
      expect.any(Function),
    );
  });
});
