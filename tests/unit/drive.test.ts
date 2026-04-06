/**
 * Unit tests for the Drive service.
 * googleapis, fs/promises, and config are mocked — no network calls.
 */
import { jest } from '@jest/globals';

// Mutable config lets individual tests toggle GOOGLE_DRIVE_FOLDER_ID on/off
const mockConfig = {
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH: './credentials/test.json',
  GOOGLE_DRIVE_FOLDER_ID: '',
};

const mockFilesList = jest.fn();
const mockFilesExport = jest.fn();
const mockFilesGet = jest.fn();

jest.unstable_mockModule('../../src/config.js', () => ({ config: mockConfig }));

jest.unstable_mockModule('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({ type: 'service_account' })),
    },
    drive: jest.fn().mockReturnValue({
      files: {
        list: mockFilesList,
        export: mockFilesExport,
        get: mockFilesGet,
      },
    }),
  },
}));

jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(
    JSON.stringify({ type: 'service_account', client_email: 'test@test.iam.gserviceaccount.com' }),
  ),
}));

const { searchDrive, fetchFileContent } = await import('../../src/services/drive.js');

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.GOOGLE_DRIVE_FOLDER_ID = '';
  mockFilesList.mockResolvedValue({ data: { files: [] } });
});

// ─── searchDrive ─────────────────────────────────────────────────────────────

describe('searchDrive — query building', () => {
  it('includes fullText filter when query is non-empty', async () => {
    await searchDrive('react aws');

    const callArg = mockFilesList.mock.calls[0][0] as { q: string };
    expect(callArg.q).toContain("fullText contains 'react aws'");
    expect(callArg.q).toContain('trashed = false');
  });

  it('omits fullText filter when query is empty', async () => {
    await searchDrive('');

    const callArg = mockFilesList.mock.calls[0][0] as { q: string };
    expect(callArg.q).not.toContain('fullText contains');
    expect(callArg.q).toContain('trashed = false');
  });

  it('adds in parents clause when GOOGLE_DRIVE_FOLDER_ID is set', async () => {
    mockConfig.GOOGLE_DRIVE_FOLDER_ID = 'folder-abc-123';
    await searchDrive('react');

    const callArg = mockFilesList.mock.calls[0][0] as { q: string };
    expect(callArg.q).toContain("'folder-abc-123' in parents");
  });

  it('omits in parents clause when GOOGLE_DRIVE_FOLDER_ID is not set', async () => {
    mockConfig.GOOGLE_DRIVE_FOLDER_ID = '';
    await searchDrive('react');

    const callArg = mockFilesList.mock.calls[0][0] as { q: string };
    expect(callArg.q).not.toContain('in parents');
  });

  it('always includes includeItemsFromAllDrives and supportsAllDrives', async () => {
    await searchDrive('test');

    const callArg = mockFilesList.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.includeItemsFromAllDrives).toBe(true);
    expect(callArg.supportsAllDrives).toBe(true);
  });

  it('respects maxResults param', async () => {
    await searchDrive('test', 5);

    const callArg = mockFilesList.mock.calls[0][0] as { pageSize: number };
    expect(callArg.pageSize).toBe(5);
  });

  it('returns empty array when Drive returns no files', async () => {
    mockFilesList.mockResolvedValue({ data: { files: [] } });
    const result = await searchDrive('nothing');
    expect(result).toEqual([]);
  });

  it('maps Drive response to DriveFile shape', async () => {
    mockFilesList.mockResolvedValue({
      data: {
        files: [
          {
            id: 'file-1',
            name: 'Project Alpha SOW',
            mimeType: 'application/vnd.google-apps.document',
            webViewLink: 'https://docs.google.com/document/d/file-1',
          },
        ],
      },
    });

    const results = await searchDrive('alpha');
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'file-1',
      name: 'Project Alpha SOW',
      mimeType: 'application/vnd.google-apps.document',
      webViewLink: 'https://docs.google.com/document/d/file-1',
    });
  });

  it('escapes single quotes in the query string', async () => {
    await searchDrive("O'Brien consulting");

    const callArg = mockFilesList.mock.calls[0][0] as { q: string };
    expect(callArg.q).toContain("\\'");
    expect(callArg.q).not.toMatch(/contains 'O'Brien/);
  });
});

// ─── fetchFileContent ─────────────────────────────────────────────────────────

describe('fetchFileContent — MIME routing', () => {
  it('exports Google Docs as plain text', async () => {
    mockFilesExport.mockResolvedValue({ data: 'Exported document content' });

    const result = await fetchFileContent({
      id: 'doc-1',
      name: 'Test Doc',
      mimeType: 'application/vnd.google-apps.document',
    });

    expect(mockFilesExport).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'doc-1', mimeType: 'text/plain' }),
      expect.any(Object),
    );
    expect(result).toBe('Exported document content');
  });

  it('exports Google Sheets as plain text', async () => {
    mockFilesExport.mockResolvedValue({ data: 'Sheet content' });

    await fetchFileContent({
      id: 'sheet-1',
      name: 'Test Sheet',
      mimeType: 'application/vnd.google-apps.spreadsheet',
    });

    expect(mockFilesExport).toHaveBeenCalled();
    expect(mockFilesGet).not.toHaveBeenCalled();
  });

  it('downloads plain text files directly', async () => {
    mockFilesGet.mockResolvedValue({ data: 'Plain text content' });

    const result = await fetchFileContent({
      id: 'txt-1',
      name: 'notes.txt',
      mimeType: 'text/plain',
    });

    expect(mockFilesGet).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'txt-1', alt: 'media' }),
      expect.any(Object),
    );
    expect(result).toBe('Plain text content');
  });

  it('returns empty string for unsupported binary types', async () => {
    const result = await fetchFileContent({
      id: 'pdf-1',
      name: 'contract.pdf',
      mimeType: 'application/pdf',
    });

    expect(result).toBe('');
    expect(mockFilesExport).not.toHaveBeenCalled();
    expect(mockFilesGet).not.toHaveBeenCalled();
  });
});
