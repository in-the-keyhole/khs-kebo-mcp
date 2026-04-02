import { google } from 'googleapis';
import { readFile } from 'fs/promises';
import type { DriveFile } from '../types.js';
import { config } from '../config.js';

const GOOGLE_DOCS_MIME = 'application/vnd.google-apps.document';
const GOOGLE_SHEETS_MIME = 'application/vnd.google-apps.spreadsheet';
const GOOGLE_SLIDES_MIME = 'application/vnd.google-apps.presentation';

async function getAuthClient() {
  const keyFile = await readFile(config.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf-8');
  const key = JSON.parse(keyFile);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
}

function getDriveClient() {
  return google.drive({ version: 'v3' });
}

/**
 * Search Google Drive for files matching a full-text query.
 */
export async function searchDrive(query: string, maxResults = 20): Promise<DriveFile[]> {
  const auth = await getAuthClient();
  const drive = getDriveClient();

  // Build query: full-text search, optionally scoped to a folder
  let q = `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`;
  if (config.GOOGLE_DRIVE_FOLDER_ID) {
    q += ` and '${config.GOOGLE_DRIVE_FOLDER_ID}' in parents`;
  }

  const response = await drive.files.list({
    auth,
    q,
    pageSize: maxResults,
    fields: 'files(id, name, mimeType, webViewLink)',
    orderBy: 'modifiedTime desc',
  });

  return (response.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    webViewLink: f.webViewLink ?? undefined,
  }));
}

/**
 * Fetch the plain-text content of a Drive file.
 * Google Workspace formats are exported as plain text.
 * Binary formats return an empty string (not supported for embedding).
 */
export async function fetchFileContent(file: DriveFile): Promise<string> {
  const auth = await getAuthClient();
  const drive = getDriveClient();

  const nativeTypes = [GOOGLE_DOCS_MIME, GOOGLE_SHEETS_MIME, GOOGLE_SLIDES_MIME];

  if (nativeTypes.includes(file.mimeType)) {
    const res = await drive.files.export(
      { auth, fileId: file.id, mimeType: 'text/plain' },
      { responseType: 'text' },
    );
    return String(res.data);
  }

  if (file.mimeType === 'text/plain') {
    const res = await drive.files.get(
      { auth, fileId: file.id, alt: 'media' },
      { responseType: 'text' },
    );
    return String(res.data);
  }

  // PDFs and other binary formats — skip content, return empty
  console.error(`Unsupported MIME type for text extraction: ${file.mimeType} (${file.name})`);
  return '';
}
