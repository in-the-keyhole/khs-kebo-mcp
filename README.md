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
- A Google Cloud service account with Drive read access (see [Google Drive setup](#google-drive-setup))

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment config
cp .env.example .env
# Required fields: DATABASE_URL, GOOGLE_SERVICE_ACCOUNT_KEY_PATH
# See .env.example for all options and documentation
```

**Google service account key:** Place your JSON key file anywhere inside `credentials/` (gitignored). Set `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` to point to it, e.g. `./credentials/my-key.json`.

```bash
# 3. Start PostgreSQL
docker compose up -d

# 4. Run database migrations
npm run db:migrate

# 5. Build
npm run build
```

On first run, node-llama-cpp will download the embedding model (~1.2 GB) and LLM (~2.5 GB) into `./models/` (gitignored). This takes a few minutes but only happens once.

> **Note on `db:migrate`:** If the command hangs, you can apply migrations directly:
> ```bash
> psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
> psql $DATABASE_URL -f src/db/migrations/0000_soft_wendigo.sql
> ```

## Running

```bash
# Start the MCP server (stdio transport)
npm start

# Inspect tools interactively in a browser UI
npm run inspect
```

### Claude Desktop / Claude Code integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kebo-mcp": {
      "command": "node",
      "args": ["/path/to/kebo-mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/kebo_mcp",
        "GOOGLE_SERVICE_ACCOUNT_KEY_PATH": "/path/to/kebo-mcp/credentials/your-key.json",
        "GOOGLE_DRIVE_FOLDER_ID": "your_folder_id"
      }
    }
  }
}
```

> Claude Desktop does not inherit your shell environment, so all required env vars must be set explicitly in the config.

## Google Drive setup

1. Create a Google Cloud service account and download its JSON key into `credentials/` (gitignored)
2. Share the Drive folder containing your documents with the service account email (Viewer access is enough)
3. Set `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` in `.env` to the path of the key file
4. Optionally set `GOOGLE_DRIVE_FOLDER_ID` to restrict searches to a specific folder

To use SOW template-aware summarization, set `SCOPE_OF_WORK_TEMPLATE_FILE_ID` to the Google Docs file ID of your SOW template (also share it with the service account).

## Testing

```bash
# Unit tests only (no Docker, no models needed)
npm run test:unit

# Integration tests (requires Docker for testcontainers)
npm run test:integration

# All tests
npm test
```

Integration tests spin up a real pgvector container via testcontainers. LLM and Drive API calls are mocked.

## Project status

- [x] Core MCP server scaffolding
- [x] Google Drive search + document export
- [x] Regex + LLM-based PII redaction
- [x] Structured anonymized summary generation (local LLM)
- [x] pgvector embeddings (local model)
- [x] Cosine similarity insight queries
- [x] Document selection via elicitation checklist
- [x] Security review — input validation, error sanitization, vector finite guard, LLM input truncation
- [x] 67 tests passing (unit + integration)
- [ ] SOW template-aware extraction prompts (implemented, needs end-to-end verification)
- [ ] Claude Desktop end-to-end verification

## License

TBD — will be confirmed before first stable release.
