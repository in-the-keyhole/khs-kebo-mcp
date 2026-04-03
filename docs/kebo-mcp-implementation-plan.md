# kebo-mcp Implementation Plan

> This document reflects decisions as implemented. See AGENTS.md for developer guidance.

## Context

Keyhole Software developers want to leverage anonymized client engagement data to guide blog posts, open source projects, and portfolio building. This MCP server ingests Google Drive documents, redacts client identity, generates semantic embeddings (capturing industry/tech/budget/cloud patterns), and enables insight queries. Everything runs locally — no cloud costs, no external API calls except Google Drive (free quota). Processing can be slow (overnight batch is acceptable) but must be reliable.

---

## Architecture Decisions

| Concern | Decision | Why |
|---|---|---|
| MCP transport | stdio only | Localhost tool, no multi-tenancy needed |
| Postgres | Local Docker + pgvector | Zero cost, each dev runs their own DB |
| Embeddings | node-llama-cpp (`mxbai-embed-large` GGUF) | 1.2GB, 1024 dims, runs in-process on Apple Silicon with Metal acceleration |
| Redaction/summarization LLM | node-llama-cpp (`Phi-4-mini-instruct` GGUF) | Configurable, free, private, in-process |
| Models | Downloaded from HuggingFace via node-llama-cpp | Auto-downloaded to `./models/` on first run, gitignored |
| Google Drive auth | Service Account + JSON key | Server-to-server, no per-user OAuth flow |
| ORM | Drizzle ORM | Lightweight, TypeScript-first, native pgvector support |
| Testing | Jest + ts-jest + testcontainers | Spin up real Postgres+pgvector per test suite |
| Slack bot | Deferred — not in scope | Separate service connecting to same DB later |

---

## Three MCP Tools

### Tool 1: `fetch_drive_documents`
1. Accept `query: string` (natural language)
2. Search Google Drive full-text via `drive.files.list()` with `q: fullText contains '...'`
3. Export Google Docs as plain text via `files.export()`, download other formats
4. Present results via MCP `server.server.elicitInput()` — checklist of file titles
5. For selected files: run regex redaction (emails, phone numbers, dollar amounts) then local LLM for nuanced redaction
6. Store in `documents` table with Drive metadata
7. **Automatically call embed-document logic for each stored document** — no separate invocation needed

### Tool 2: `embed_document`
Also callable standalone for re-embedding or backfilling existing documents.

1. Accept `document_id: string`
2. Use local LLM (node-llama-cpp) to generate structured anonymized summary:
   ```json
   {
     "industry": "fintech",
     "tech_stack": ["React", "AWS Lambda", "PostgreSQL"],
     "budget_tier": "enterprise",
     "cloud_providers": ["AWS"],
     "engagement_type": "greenfield"
   }
   ```
3. Embed the summary text using `mxbai-embed-large` via node-llama-cpp
4. Store vector in `document_embeddings` table with HNSW index

### Tool 3: `query_insights`
1. Accept `query: string`
2. Embed query using same model
3. Cosine similarity search (threshold 0.7, top 10) against `document_embeddings`
4. Return aggregated insights — frequency of tech stacks, industry breakdown, budget tiers, cloud providers — NOT individual document content

---

## Directory Structure

```
kebo-mcp/
├── src/
│   ├── index.ts                    # Entry point, wires stdio transport
│   ├── server.ts                   # MCP server definition, registers tools
│   ├── config.ts                   # Env var loading + validation (zod)
│   ├── types.ts                    # Shared TypeScript types
│   ├── tools/
│   │   ├── fetch-documents.ts      # Tool 1
│   │   ├── embed-document.ts       # Tool 2
│   │   └── query-insights.ts       # Tool 3
│   ├── services/
│   │   ├── drive.ts                # Google Drive client (service account)
│   │   ├── redaction.ts            # Regex-based PII stripping
│   │   ├── embedding.ts            # node-llama-cpp embedding context + utilities
│   │   ├── llm.ts                  # node-llama-cpp chat session for text generation
│   │   └── summarizer.ts           # Prompt builder + JSON parser for structured summaries
│   └── db/
│       ├── client.ts               # Drizzle + postgres.js connection
│       ├── schema.ts               # Table definitions
│       └── migrations/             # Drizzle migration files
├── tests/
│   ├── setup.ts                    # Minimum env vars for all tests
│   ├── unit/
│   │   ├── redaction.test.ts
│   │   ├── summarizer.test.ts
│   │   └── embedding.test.ts
│   └── integration/
│       ├── db-setup.ts             # testcontainers Postgres+pgvector
│       ├── fetch-documents.test.ts
│       ├── embed-document.test.ts
│       └── query-insights.test.ts
├── docker-compose.yml
├── drizzle.config.ts
├── jest.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

---

## Database Schema (Drizzle + pgvector)

```typescript
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  driveFileId: text('drive_file_id').notNull().unique(),
  title: text('title').notNull(),
  mimeType: text('mime_type').notNull(),
  contentRedacted: text('content_redacted').notNull(),
  tags: text('tags').array(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const documentEmbeddings = pgTable('document_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  embedding: vector('embedding', { dimensions: 1024 }),  // mxbai-embed-large
  modelName: text('model_name').notNull(),
  structuredSummary: jsonb('structured_summary').$type<StructuredSummary>().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);
```

---

## Key Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "drizzle-orm": "^0.45.0",
    "googleapis": "^144.0.0",
    "node-llama-cpp": "^3.18.1",
    "postgres": "^3.4.5",
    "zod": "^4.3.0"
  }
}
```

---

## Environment Variables

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kebo_mcp

GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/service-account.json
GOOGLE_DRIVE_FOLDER_ID=          # optional: scope search to specific folder
SCOPE_OF_WORK_TEMPLATE_FILE_ID=  # optional: Drive file ID of SOW template

EMBEDDING_HF_REPO=mixedbread-ai/mxbai-embed-large-v1-GGUF
EMBEDDING_HF_FILE=mxbai-embed-large-v1-f16.gguf

LLM_HF_REPO=bartowski/Phi-4-mini-instruct-GGUF
LLM_HF_FILE=Phi-4-mini-instruct-Q4_K_M.gguf
```

---

## Testing Strategy (TDD)

**Unit tests** (no DB, no models):
- `redaction.test.ts` — verify PII is stripped, non-PII survives
- `summarizer.test.ts` — verify structured summary shape/enum values, prompt content
- `embedding.test.ts` — verify cosineSimilarity and validateEmbeddingDimensions utilities

**Integration tests** (testcontainers spins up real pgvector):
- `fetch-documents.test.ts` — mock Drive API, test full redact→store flow
- `embed-document.test.ts` — mock node-llama-cpp, test vector insert + HNSW index
- `query-insights.test.ts` — insert fixture vectors, run cosine search, verify aggregation

**Never declare victory until**: all 39 Jest tests pass AND a manual end-to-end run through `npx @modelcontextprotocol/inspector` confirms all three tools work.

---

## Verification

```bash
# Start Postgres
docker compose up -d

# Run migrations
npm run db:migrate

# Run all tests
npm test

# Inspect MCP tools manually
npx @modelcontextprotocol/inspector node dist/index.js
```

Models are downloaded automatically to `./models/` on first run (~3.7GB total).
