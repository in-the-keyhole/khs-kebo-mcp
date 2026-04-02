/**
 * Integration tests for the fetch_drive_documents flow.
 * Drive API calls are mocked — only DB operations use a real container.
 */
import { jest } from '@jest/globals';
import { eq } from 'drizzle-orm';

// ESM mocking: unstable_mockModule must be called before dynamic imports
jest.unstable_mockModule('../../src/services/drive.js', () => ({
  searchDrive: jest.fn(),
  fetchFileContent: jest.fn(),
}));

// Dynamic imports must come AFTER unstable_mockModule
const { fetchFileContent } = await import('../../src/services/drive.js');
const { startTestDb, stopTestDb } = await import('./db-setup.js');
const { documents } = await import('../../src/db/schema.js');
const { getDb } = await import('../../src/db/client.js');
const { redactAndStore } = await import('../../src/tools/fetch-documents.js');

type MockedFn<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;
const mockFetchContent = fetchFileContent as MockedFn<typeof fetchFileContent>;

let testDb: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  testDb = await startTestDb();
}, 120_000);

afterAll(async () => {
  await stopTestDb(testDb);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('redactAndStore', () => {
  it('stores a redacted document in the database', async () => {
    const mockFile = {
      id: 'drive-file-123',
      name: 'Project Alpha SOW',
      mimeType: 'application/vnd.google-apps.document',
    };

    mockFetchContent.mockResolvedValueOnce(
      'Client is Acme Corp. Contact john.doe@acmecorp.com. Budget: $250,000. Uses React and AWS.',
    );

    const db = getDb(testDb.connectionUrl);
    const doc = await redactAndStore(mockFile, db);

    expect(doc).not.toBeNull();
    expect(doc!.driveFileId).toBe('drive-file-123');
    expect(doc!.title).toBe('Project Alpha SOW');
    expect(doc!.contentRedacted).not.toContain('john.doe@acmecorp.com');
    expect(doc!.contentRedacted).not.toContain('$250,000');
    expect(doc!.contentRedacted).toContain('React');
    expect(doc!.contentRedacted).toContain('AWS');
  });

  it('skips files with no extractable content', async () => {
    const mockFile = {
      id: 'binary-file-456',
      name: 'logo.png',
      mimeType: 'image/png',
    };

    mockFetchContent.mockResolvedValueOnce('');

    const db = getDb(testDb.connectionUrl);
    const result = await redactAndStore(mockFile, db);

    expect(result).toBeNull();
  });

  it('does not create duplicate records for the same Drive file', async () => {
    const mockFile = {
      id: 'drive-file-789',
      name: 'Duplicate Test',
      mimeType: 'text/plain',
    };

    mockFetchContent.mockResolvedValue('Technology: Kubernetes on GCP. Budget range: enterprise.');

    const db = getDb(testDb.connectionUrl);
    await redactAndStore(mockFile, db);
    await redactAndStore(mockFile, db); // second call — should upsert, not error

    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.driveFileId, 'drive-file-789'));
    expect(rows).toHaveLength(1);
  });
});
