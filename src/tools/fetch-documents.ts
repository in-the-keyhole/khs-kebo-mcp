import { eq, sql } from 'drizzle-orm';
import { fetchFileContent } from '../services/drive.js';
import { redactRegex } from '../services/redaction.js';
import { documents, type Document } from '../db/schema.js';
import type { Db } from '../db/client.js';
import type { DriveFile } from '../types.js';

/**
 * Fetch content for a Drive file, apply regex redaction, and upsert into the DB.
 * Returns the stored document, or null if the file yielded no extractable text.
 */
export async function redactAndStore(
  file: DriveFile,
  db: Db,
): Promise<Document | null> {
  const raw = await fetchFileContent(file);
  if (!raw.trim()) return null;

  const contentRedacted = redactRegex(raw);

  // Upsert by driveFileId — idempotent on re-run
  const [doc] = await db
    .insert(documents)
    .values({
      driveFileId: file.id,
      title: file.name,
      mimeType: file.mimeType,
      contentRedacted,
    })
    .onConflictDoUpdate({
      target: documents.driveFileId,
      set: {
        title: sql`excluded.title`,
        contentRedacted: sql`excluded.content_redacted`,
      },
    })
    .returning();

  return doc;
}

/**
 * Full Tool 1 flow:
 * 1. Fetch + redact + store each selected file
 * 2. Return stored document IDs for downstream embedding
 */
export async function fetchAndStoreDriveFiles(
  selectedFiles: DriveFile[],
  db: Db,
): Promise<{ stored: Document[]; skipped: string[] }> {
  const stored: Document[] = [];
  const skipped: string[] = [];

  for (const file of selectedFiles) {
    const doc = await redactAndStore(file, db);
    if (doc) {
      stored.push(doc);
    } else {
      skipped.push(file.name);
    }
  }

  return { stored, skipped };
}
