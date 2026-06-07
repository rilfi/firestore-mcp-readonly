import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../db.js';
import { formatFirestoreError } from '../errors.js';

export function registerListSubcollections(server: McpServer): void {
  server.tool(
    'firestore_list_subcollections',
    'List all subcollection names directly under a document. This is an Admin SDK exclusive feature — client SDKs cannot enumerate subcollections.',
    {
      documentPath: z.string().describe('Full document path, e.g. "users/alice" or "tenants/t1/projects/p1"'),
    },
    async ({ documentPath }) => {
      try {
        const segments = documentPath.split('/').filter(Boolean);
        if (segments.length === 0 || segments.length % 2 !== 0) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: `Invalid document path "${documentPath}": must have an even number of segments.`,
              }),
            }],
            isError: true,
          };
        }

        const db = getDb();
        const collections = await db.doc(documentPath).listCollections();
        const subcollections = collections.map(col => col.id);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              documentPath,
              count: subcollections.length,
              subcollections,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(formatFirestoreError(error, 'firestore_list_subcollections'), null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}
