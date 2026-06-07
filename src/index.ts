#!/usr/bin/env node
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };
import { loadConfig } from './config.js';
import { initDb } from './db.js';
import { registerGetDocument } from './tools/get-document.js';
import { registerGetCollection } from './tools/get-collection.js';
import { registerQueryCollection } from './tools/query-collection.js';
import { registerCollectionGroupQuery } from './tools/collection-group-query.js';
import { registerListSubcollections } from './tools/list-subcollections.js';
import { registerCountDocuments } from './tools/count-documents.js';
import { registerListIndexes } from './tools/list-indexes.js';
import { registerDumpNode } from './tools/dump-node.js';
import { registerDumpDatabase } from './tools/dump-database.js';
import { registerGetServerInfo } from './tools/get-server-info.js';
import { registerReadCollectionOrdered } from './tools/read-collection-ordered.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(JSON.stringify({
    error: `Configuration error: ${message}`,
    suggestion: 'Check that FIRESTORE_SERVICE_ACCOUNT_KEY_PATH and FIRESTORE_PROJECT_ID environment variables are set correctly in your MCP config.',
  }, null, 2) + '\n');
  process.exit(1);
}

try {
  initDb(config);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(JSON.stringify({
    error: `Database initialization error: ${message}`,
    suggestion: 'Verify the service account key file is valid and the project ID matches your GCP project.',
  }, null, 2) + '\n');
  process.exit(1);
}

const server = new McpServer({
  name: 'firestore-mcp-readonly',
  version,
});

registerGetDocument(server);
registerGetCollection(server, config);
registerQueryCollection(server);
registerCollectionGroupQuery(server);
registerListSubcollections(server);
registerCountDocuments(server);
registerListIndexes(server, config);
registerDumpNode(server, config);
registerDumpDatabase(server, config);
registerGetServerInfo(server, config);
registerReadCollectionOrdered(server, config);

const transport = new StdioServerTransport();
await server.connect(transport);
