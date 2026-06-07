import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FirestoreConfig } from '../config.js';
import { getDb } from '../db.js';
import { formatFirestoreError } from '../errors.js';

export function registerGetServerInfo(server: McpServer, config: FirestoreConfig): void {
  server.tool(
    'firestore_get_server_info',
    'Get the MCP server configuration summary: project ID, database ID, and active safety limits. Useful for verifying you are connected to the correct Firestore database.',
    {},
    async () => {
      try {
        const db = getDb();
        const rootCollections = await db.listCollections();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              projectId: config.projectId,
              databaseId: config.databaseId,
              limits: config.limits,
              rootCollections: rootCollections.map(col => col.id),
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(formatFirestoreError(error, 'firestore_get_server_info'), null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}
