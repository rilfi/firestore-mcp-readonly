import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../db.js';
import { serializeDocument } from '../serializer.js';
import { formatFirestoreError } from '../errors.js';

export function registerGetDocument(server: McpServer): void {
  server.tool(
    'firestore_get_document',
    'Get a single Firestore document by its full path. Path must have an even number of segments (collection/doc pairs), e.g. "users/alice" or "tenants/t1/projects/p1".',
    {
      path: z.string().describe('Full document path, e.g. "users/alice" or "tenants/t1/projects/p1/docs/d1"'),
    },
    async ({ path }) => {
      try {
        const segments = path.split('/').filter(Boolean);
        if (segments.length === 0 || segments.length % 2 !== 0) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: `Invalid document path "${path}": must have an even number of segments (collection/doc pairs). Got ${segments.length} segment(s).`,
              }),
            }],
            isError: true,
          };
        }

        const db = getDb();
        const docRef = db.doc(path);
        const snapshot = await docRef.get();

        if (!snapshot.exists) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ exists: false, path }),
            }],
          };
        }

        const result = serializeDocument(snapshot.id, snapshot.ref.path, snapshot.data()!);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(formatFirestoreError(error, 'firestore_get_document'), null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}
