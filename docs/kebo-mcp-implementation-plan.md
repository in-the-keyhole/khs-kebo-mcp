# kebo-mcp Implementation Plan

## Context

Keyhole Software developers want to leverage anonymized client engagement data to guide blog posts, open source projects, and portfolio building. This MCP server ingests Google Drive documents, redacts client identity, generates semantic embeddings (capturing industry/tech/budget/cloud patterns), and enables insight queries. Everything runs locally — no cloud costs, no external API calls except Google Drive (free quota). Processing can be slow (overnight batch is acceptable) but must be reliable.

---

## Architecture Decisions

| Concern | Decision | Why |
|---|---|---|
| MCP transport | stdio only | Localhost tool, no multi-tenancy needed |
| Postgres | Local Docker + pgvector | Zero cost, each dev runs their own DB |
| Embeddings | Ollama (`mxbai-embed-large`) | 1.2GB, 1024 dims, beats OpenAI text-embedding-3-large, free, private |
| Redaction/summarization LLM | Ollama (`llama3.2` default) | Configurable, free, private |
| Embedding abstraction | Vercel AI SDK (`ai` + `@ai-sdk/ollama`) | Unified API, provider-swappable via env var |
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
4. Present results via MCP `server.elicitation.create()` — checklist of file titles
5. For selected files: run `redact-pii` (regex) then Ollama LLM for nuanced redaction (client names, exact dollar amounts, person names)
6. Store in `documents` table with Drive metadata
7. **Automatically call embed-document logic for each stored document** — no separate invocation needed. Returns a summary of stored + embedded document IDs.

### Tool 2: `embed_document`
Also callable standalone for re-embedding or backfilling existing documents.

1. Accept `document_id: string`
2. Use Ollama LLM to generate structured anonymized summary:
   ```json
   {
     "industry": "fintech",
     "tech_stack": ["React", "AWS Lambda", "PostgreSQL"],
     "budget_tier": "enterprise",  // enum: startup | smb | enterprise
     "cloud_providers": ["AWS"],
     "engagement_type": "greenfield"  // enum: greenfield | migration | support
   }
   ```
3. Embed the summary text using `mxbai-embed-large` via Vercel AI SDK + Ollama
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
│   ├── tools/
│   │   ├── fetch-documents.ts      # Tool 1
│   │   ├── embed-document.ts       # Tool 2
│   │   └── query-insights.ts       # Tool 3
│   ├── services/
│   │   ├── drive.ts                # Google Drive client (service account)
│   │   ├── redaction.ts            # redact-pii + Ollama LLM redaction
│   │   ├── embedding.ts            # Vercel AI SDK embed() wrapper
│   │   └── summarizer.ts           # Ollama LLM structured summary generation
│   ├── db/
│   │   ├── client.ts               # Drizzle + postgres.js connection
│   │   ├── schema.ts               # Table definitions
│   │   └── migrations/             # Drizzle migration files
│   └── types.ts                    # Shared TypeScript types
├── tests/
│   ├── unit/
│   │   ├── redaction.test.ts
│   │   ├── summarizer.test.ts
│   │   └── query-insights.test.ts
│   └── integration/
│       ├── setup.ts                # testcontainers Postgres+pgvector
│       ├── fetch-documents.test.ts
│       ├── embed-document.test.ts
│       └── query-insights.test.ts
├── docker-compose.yml              # postgres + pgvector for local dev
├── drizzle.config.ts
├── jest.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

---

## Database Schema (Drizzle + pgvector)

```typescript
// src/db/schema.ts
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core'; // pgvector column type

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
  documentId: uuid('document_id').notNull().references(() => documents.id),
  embedding: vector('embedding', { dimensions: 1024 }),  // mxbai-embed-large
  modelName: text('model_name').notNull(),
  structuredSummary: jsonb('structured_summary').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  embeddingHnswIndex: index('embedding_hnsw_idx')
    .using('hnsw', table.embedding.op('vector_cosine_ops')),
}));
```

---

## Key Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "ai": "latest",
    "@ai-sdk/ollama": "latest",
    "fastify": "^5",
    "drizzle-orm": "latest",
    "postgres": "^3",
    "googleapis": "^144",
    "redact-pii": "latest",
    "zod": "^3"
  },
  "devDependencies": {
    "@types/node": "latest",
    "typescript": "^5",
    "ts-jest": "latest",
    "jest": "latest",
    "@types/jest": "latest",
    "testcontainers": "latest",
    "drizzle-kit": "latest"
  }
}
```

---

## Environment Variables (`.env.example`)

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kebo_mcp

# Google Drive
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/service-account.json
GOOGLE_DRIVE_FOLDER_ID=   # optional: scope search to specific folder

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=mxbai-embed-large
LLM_MODEL=llama3.2
```

---

## MCP Elicitation Pattern (Tool 1)

```typescript
const result = await server.elicitation.create({
  message: `Found ${files.length} documents matching "${query}". Select which to import:`,
  requestedSchema: {
    type: 'object',
    properties: {
      selectedIds: {
        type: 'array',
        items: { type: 'string', enum: files.map(f => f.id) },
        description: 'Drive file IDs to import',
      },
    },
    required: ['selectedIds'],
  },
});
if (result.action !== 'accept') return { cancelled: true };
```

---

## Docker Compose (local dev + tests)

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: kebo_mcp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## Testing Strategy (TDD)

**Unit tests** (no DB, mock Ollama):
- `redaction.test.ts` — verify PII is stripped, non-PII survives
- `summarizer.test.ts` — verify structured summary shape/enum values
- `query-insights.test.ts` — verify aggregation logic from mock similarity results

**Integration tests** (testcontainers spins up real pgvector):
- `fetch-documents.test.ts` — mock Drive API, test full redact→store flow
- `embed-document.test.ts` — mock Ollama embed call, test vector insert + HNSW index
- `query-insights.test.ts` — insert fixture vectors, run cosine search, verify results

**Test fixtures**: Sample documents with known PII, expected redacted output, pre-computed embedding vectors for deterministic similarity tests.

**Never declare victory until**: all Jest suites pass AND a manual end-to-end run through Claude Desktop (or `npx @modelcontextprotocol/inspector`) confirms all three tools work.

---

## Implementation Order (TDD-first)

1. `docker-compose.yml` + DB schema + migrations (foundation)
2. Unit tests for redaction → implement `redaction.ts`
3. Unit tests for summarizer → implement `summarizer.ts` (Ollama LLM)
4. Unit tests for embedding wrapper → implement `embedding.ts` (Vercel AI SDK + Ollama)
5. Integration tests for `fetch_drive_documents` → implement Tool 1
6. Integration tests for `embed_document` → implement Tool 2
7. Integration tests for `query_insights` → implement Tool 3
8. Wire MCP server (`server.ts`, `index.ts`) — stdio transport
9. Manual E2E verification with MCP Inspector

---

## Verification

```bash
# Start Postgres
docker compose up -d

# Run migrations
npx drizzle-kit migrate

# Run all tests
npm test

# Inspect MCP tools manually
npx @modelcontextprotocol/inspector node dist/index.js
```

Ollama prerequisites (developer must have installed):
```bash
ollama pull mxbai-embed-large
ollama pull llama3.2
```
