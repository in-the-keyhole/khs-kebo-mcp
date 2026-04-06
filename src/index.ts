import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { closeDb } from './db/client.js';
import { disposeEmbeddingContext } from './services/embedding.js';


const server = createServer();
const transport = new StdioServerTransport();

await server.connect(transport);
console.error('kebo-mcp running on stdio');

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.error(`Received ${signal}, shutting down...`);
    await disposeEmbeddingContext();
    await closeDb();
    process.exit(0);
  });
}
