import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';
import type { StructuredSummary } from '../types.js';

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  driveFileId: text('drive_file_id').notNull().unique(),
  title: text('title').notNull(),
  mimeType: text('mime_type').notNull(),
  contentRedacted: text('content_redacted').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const documentEmbeddings = pgTable(
  'document_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    // mxbai-embed-large produces 1024-dimensional vectors
    embedding: vector('embedding', { dimensions: 1024 }),
    modelName: text('model_name').notNull(),
    structuredSummary: jsonb('structured_summary')
      .$type<StructuredSummary>()
      .notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;
export type NewDocumentEmbedding = typeof documentEmbeddings.$inferInsert;
