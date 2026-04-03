# kebo-mcp

> **⚠️ Work in Progress** — This project is under active development and is not yet ready for production use. APIs, tool signatures, and database schema may change without notice.

An MCP (Model Context Protocol) server that helps [Keyhole Software](https://keyholesoftware.com) developers surface patterns from past client engagements — without exposing any client identity. Use it to guide blog posts, open source projects, and portfolio decisions.

## What it does

Three MCP tools, all running locally with no cloud costs:

| Tool | Description |
|---|---|
| `fetch_drive_documents` | Search Google Drive, select documents via checklist, redact PII, store and auto-embed |
| `embed_document` | (Re)generate a semantic embedding for a stored document using a local LLM |
| `query_insights` | Ask natural language questions; get back aggregated patterns — industry mix, tech stack frequency, budget tiers, cloud providers |

Embeddings capture *what kind of work* was done (industry, technologies, budget tier, cloud providers, engagement type) without revealing *who the client is*.

## Architecture

- **Runtime**: Node.js 22+, TypeScript
- **MCP transport**: stdio (runs as a subprocess in Claude Desktop / Claude Code)
- **Database**: PostgreSQL 17 + pgvector (Docker)
- **Embeddings**: [`mxbai-embed-large`](https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1-GGUF) via [node-llama-cpp](https://github.com/withcatai/node-llama-cpp) — 1024 dims, runs locally
- **LLM (redaction + summarization)**: [`Phi-4-mini-instruct`](https://huggingface.co/bartowski/Phi-4-mini-instruct-GGUF) via node-llama-cpp — runs locally
- **ORM**: Drizzle ORM with pgvector support
- **Google Drive**: Service account auth (read-only)

All model inference happens on-device. No OpenAI, no external embedding API, no per-query costs.

## Prerequisites

- Node.js 22+
- Docker (for PostgreSQL + pgvector)
- ~3.7 GB disk for models (downloaded automatically on first run)
- A Google Cloud service account with Drive read access (see [Setup](#setup))

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment config
cp .env.example .env

# 3. Place your Google service account key at:
#    credentials/service-account.json
#    (this directory is gitignored)

# 4. Start PostgreSQL
docker compose up -d

# 5. Run database migrations
npm run db:migrate

# 6. Build
npm run build
```

On first run, node-llama-cpp will download the embedding model and LLM into `./models/` (gitignored). This takes a few minutes but only happens once.

## Running

```bash
# Start the MCP server (stdio transport)
npm start

# Or inspect tools interactively
npx @modelcontextprotocol/inspector node dist/index.js
```

### Claude Desktop / Claude Code integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kebo-mcp": {
      "command": "node",
      "args": ["/path/to/kebo-mcp/dist/index.js"]
    }
  }
}
```

## Google Drive setup

The service account needs **Viewer** access to the Drive folder(s) containing your documents. Share the target folder with the service account email from your JSON key file.

To scope searches to a specific folder, set `GOOGLE_DRIVE_FOLDER_ID` in `.env`.

## Testing

```bash
# All tests (unit + integration)
npm test

# Unit tests only (no Docker needed)
npm run test:unit

# Integration tests (requires Docker for testcontainers)
npm run test:integration
```

Integration tests spin up a real pgvector container via testcontainers. LLM and Drive API calls are mocked.

## Project status

- [x] Core MCP server scaffolding
- [x] Google Drive search + document export
- [x] Regex + LLM-based PII redaction
- [x] Structured anonymized summary generation (local LLM)
- [x] pgvector embeddings (local model)
- [x] Cosine similarity insight queries
- [x] 56 tests passing (unit)
- [x] Security review — input validation, error sanitization, vector finite guard, LLM input truncation
- [ ] SOW template-aware extraction prompts
- [ ] Claude Desktop end-to-end verification

## License

TBD — will be confirmed before first stable release.
