import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { searchDrive } from './services/drive.js';
import { fetchAndStoreDriveFiles } from './tools/fetch-documents.js';
import { embedDocument } from './tools/embed-document.js';
import { queryInsights } from './tools/query-insights.js';
import { getDb } from './db/client.js';

export function createServer() {
  const server = new McpServer({
    name: 'kebo-mcp',
    version: '0.1.0',
  });

  // ─── Tool 1: fetch_drive_documents ─────────────────────────────────────────
  server.tool(
    'fetch_drive_documents',
    'Search Google Drive for documents matching a query, present a selection checklist, then redact and store chosen documents. Automatically generates embeddings for each stored document.',
    {
      query: z.string().describe('Natural language search query for Google Drive'),
      maxResults: z.number().int().min(1).max(50).default(20).describe('Max Drive results to present'),
    },
    async ({ query, maxResults }) => {
      const files = await searchDrive(query, maxResults);

      if (files.length === 0) {
        return {
          content: [{ type: 'text', text: `No documents found in Drive matching: "${query}"` }],
        };
      }

      // Present checklist via MCP elicitation (server.server is the underlying Server instance)
      const elicitation = await server.server.elicitInput({
        message: `Found ${files.length} document(s) matching "${query}". Select which to import and embed:`,
        requestedSchema: {
          type: 'object' as const,
          properties: {
            selectedIds: {
              type: 'array' as const,
              items: { type: 'string' as const, enum: files.map((f) => f.id) },
              description: files.map((f) => `${f.id}: ${f.name}`).join('\n'),
            },
          },
          required: ['selectedIds'],
        },
      });

      if (elicitation.action !== 'accept' || !elicitation.content?.selectedIds) {
        return { content: [{ type: 'text', text: 'Import cancelled.' }] };
      }

      const selectedFiles = files.filter((f) =>
        (elicitation.content!.selectedIds as string[]).includes(f.id),
      );

      const db = getDb();
      const { stored, skipped } = await fetchAndStoreDriveFiles(selectedFiles, db);

      // Auto-embed each stored document
      const embeds = [];
      for (const doc of stored) {
        try {
          const result = await embedDocument(doc.id, db);
          embeds.push({ title: doc.title, embeddingId: result.embeddingId });
        } catch (err) {
          embeds.push({ title: doc.title, error: String(err) });
        }
      }

      const lines = [
        `Imported and embedded ${stored.length} document(s).`,
        ...embeds.map((e) =>
          'error' in e ? `  ✗ ${e.title}: ${e.error}` : `  ✓ ${e.title}`,
        ),
        skipped.length > 0 ? `Skipped ${skipped.length} (no extractable text): ${skipped.join(', ')}` : '',
      ].filter(Boolean);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ─── Tool 2: embed_document ─────────────────────────────────────────────────
  server.tool(
    'embed_document',
    'Generate or regenerate the semantic embedding for a document already stored in the database. Use this to backfill existing documents or re-embed with an updated model.',
    {
      documentId: z.string().uuid().describe('UUID of the document in the database'),
    },
    async ({ documentId }) => {
      const db = getDb();
      const result = await embedDocument(documentId, db);

      return {
        content: [
          {
            type: 'text',
            text: [
              `Embedded document ${documentId}`,
              `Model: ${result.modelName}`,
              `Dimensions: ${result.dimensions}`,
              `Summary: ${JSON.stringify(result.structuredSummary, null, 2)}`,
            ].join('\n'),
          },
        ],
      };
    },
  );

  // ─── Tool 3: query_insights ──────────────────────────────────────────────────
  server.tool(
    'query_insights',
    'Query the embedded document database for insights relevant to a natural language question. Returns aggregated patterns (industry mix, tech stacks, budget tiers, cloud providers) — never raw client data.',
    {
      query: z.string().describe('Natural language question, e.g. "What cloud providers do our healthcare clients use?"'),
      threshold: z.number().min(0).max(1).default(0.7).describe('Cosine similarity threshold (0–1, default 0.7)'),
      limit: z.number().int().min(1).max(50).default(10).describe('Max documents to consider'),
    },
    async ({ query, threshold, limit }) => {
      const db = getDb();
      const insights = await queryInsights(query, db, { threshold, limit });

      const lines = [
        `Insights for: "${query}"`,
        `Documents matched: ${insights.documentCount} (threshold: ${threshold})`,
        '',
        '**Industries:**',
        ...Object.entries(insights.industries)
          .sort(([, a], [, b]) => b - a)
          .map(([k, v]) => `  ${k}: ${v}`),
        '',
        '**Tech Stack (frequency):**',
        ...Object.entries(insights.techStack)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([k, v]) => `  ${k}: ${v}`),
        '',
        '**Budget Tiers:**',
        ...Object.entries(insights.budgetTiers).map(([k, v]) => `  ${k}: ${v}`),
        '',
        '**Cloud Providers:**',
        ...Object.entries(insights.cloudProviders)
          .sort(([, a], [, b]) => b - a)
          .map(([k, v]) => `  ${k}: ${v}`),
        '',
        '**Engagement Types:**',
        ...Object.entries(insights.engagementTypes).map(([k, v]) => `  ${k}: ${v}`),
      ];

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  return server;
}
