import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import { getDb } from '../db.js';
import { formatFirestoreError } from '../errors.js';

const whereClause = z.object({
  field: z.string().describe('Field name to filter on'),
  op: z.enum(['==', '!=', '<', '<=', '>', '>=', 'array-contains', 'array-contains-any', 'in', 'not-in'])
    .describe('Firestore comparison operator'),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  ]).describe('Value to compare against'),
});

export function registerCountDocuments(server: McpServer): void {
  server.tool(
    'firestore_count_documents',
    'Count documents in a collection or matching a query without fetching the actual document data. Efficient aggregate operation.',
    {
      collectionPath: z.string().describe('Collection path, e.g. "users" or "tenants/t1/projects"'),
      where: z.array(whereClause).optional()
        .describe('Optional where filter clauses — all are ANDed together'),
    },
    async ({ collectionPath, where: whereClauses }) => {
      try {
        const db = getDb();
        let query: Query<DocumentData> = db.collection(collectionPath);

        if (whereClauses) {
          for (const clause of whereClauses) {
            query = query.where(clause.field, clause.op, clause.value);
          }
        }

        const snapshot = await query.count().get();
        const count = snapshot.data().count;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              collectionPath,
              count,
              filters: whereClauses?.length ?? 0,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(formatFirestoreError(error, 'firestore_count_documents'), null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}
