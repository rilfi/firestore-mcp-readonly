import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { FirestoreConfig } from '../config.js';
import { getDb } from '../db.js';
import { serializeDocument } from '../serializer.js';
import { formatFirestoreError } from '../errors.js';

export function registerGetCollection(server: McpServer, config: FirestoreConfig): void {
  server.tool(
    'firestore_get_collection',
    'Get all documents from a Firestore collection by its full path. Returns documents with optional limit.',
    {
      path: z.string().describe('Full collection path, e.g. "users" or "tenants/t1/projects"'),
      limit: z.number().int().min(1).max(1000).optional()
        .describe('Max documents to return. Defaults to server max (configurable, default 500). Hard cap: 1000.'),
    },
    async ({ path, limit }) => {
      try {
        const segments = path.split('/').filter(Boolean);
        if (segments.length === 0 || segments.length % 2 !== 1) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: `Invalid collection path "${path}": must have an odd number of segments. Got ${segments.length} segment(s).`,
              }),
            }],
            isError: true,
          };
        }

        const db = getDb();
        const effectiveLimit = Math.min(limit ?? config.limits.maxDocsPerCollection, 1000);
        const snapshot = await db.collection(path).limit(effectiveLimit + 1).get();

        const truncated = snapshot.docs.length > effectiveLimit;
        const docs = snapshot.docs.slice(0, effectiveLimit);

        const documents = docs.map(doc =>
          serializeDocument(doc.id, doc.ref.path, doc.data()),
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              collectionPath: path,
              count: documents.length,
              truncated,
              documents,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(formatFirestoreError(error, 'firestore_get_collection'), null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}
