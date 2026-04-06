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
const { redactAndStore, fetchAndStoreDriveFiles } = await import('../../src/tools/fetch-documents.js');

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

// ─── redactAndStore ───────────────────────────────────────────────────────────

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

  it('redacts phone numbers from document content', async () => {
    const mockFile = {
      id: 'drive-phone-test',
      name: 'Phone Test Doc',
      mimeType: 'text/plain',
    };

    mockFetchContent.mockResolvedValueOnce(
      'Contact: (816) 555-0142. Email: test@example.com. Tech: Node.js, PostgreSQL.',
    );

    const db = getDb(testDb.connectionUrl);
    const doc = await redactAndStore(mockFile, db);

    expect(doc!.contentRedacted).toContain('[PHONE]');
    expect(doc!.contentRedacted).toContain('[EMAIL]');
    expect(doc!.contentRedacted).toContain('Node.js');
    expect(doc!.contentRedacted).toContain('PostgreSQL');
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

  it('updates title and content when the same Drive file is re-imported', async () => {
    const mockFile = { id: 'upsert-update-test', name: 'Original Title', mimeType: 'text/plain' };
    const db = getDb(testDb.connectionUrl);

    mockFetchContent.mockResolvedValueOnce('First version: React on AWS.');
    await redactAndStore(mockFile, db);

    mockFetchContent.mockResolvedValueOnce('Second version: Vue.js on Azure.');
    const updated = await redactAndStore({ ...mockFile, name: 'Updated Title' }, db);

    expect(updated!.title).toBe('Updated Title');
    expect(updated!.contentRedacted).toContain('Vue.js');
    expect(updated!.contentRedacted).not.toContain('First version');

    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.driveFileId, 'upsert-update-test'));
    expect(rows).toHaveLength(1);
  });
});

// ─── fetchAndStoreDriveFiles ──────────────────────────────────────────────────

describe('fetchAndStoreDriveFiles', () => {
  it('stores all files with content and skips those without', async () => {
    const files = [
      { id: 'batch-1', name: 'SOW Healthcare', mimeType: 'application/vnd.google-apps.document' },
      { id: 'batch-2', name: 'empty-binary.pdf', mimeType: 'application/pdf' },
      { id: 'batch-3', name: 'SOW Fintech', mimeType: 'application/vnd.google-apps.document' },
    ];

    mockFetchContent
      .mockResolvedValueOnce('Healthcare project using Python and Azure.')
      .mockResolvedValueOnce('') // PDF — no content
      .mockResolvedValueOnce('Fintech project using React and AWS.');

    const db = getDb(testDb.connectionUrl);
    const { stored, skipped } = await fetchAndStoreDriveFiles(files, db);

    expect(stored).toHaveLength(2);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toBe('empty-binary.pdf');
    expect(stored.map((d) => d.driveFileId)).toContain('batch-1');
    expect(stored.map((d) => d.driveFileId)).toContain('batch-3');
  });

  it('returns empty arrays when all files have no content', async () => {
    const files = [
      { id: 'empty-1', name: 'img.png', mimeType: 'image/png' },
      { id: 'empty-2', name: 'doc.pdf', mimeType: 'application/pdf' },
    ];

    mockFetchContent.mockResolvedValue('');

    const db = getDb(testDb.connectionUrl);
    const { stored, skipped } = await fetchAndStoreDriveFiles(files, db);

    expect(stored).toHaveLength(0);
    expect(skipped).toHaveLength(2);
  });
});
