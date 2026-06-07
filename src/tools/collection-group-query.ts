import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import { getDb } from '../db.js';
import { serializeDocument } from '../serializer.js';
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

const orderByClause = z.object({
  field: z.string().describe('Field name to order by'),
  direction: z.enum(['asc', 'desc']).default('asc').describe('Sort direction'),
});

export function registerCollectionGroupQuery(server: McpServer): void {
  server.tool(
    'firestore_collection_group_query',
    'Query across ALL collections with the same ID, regardless of their location in the document hierarchy. For example, querying collectionId "comments" will match /posts/p1/comments, /users/u1/comments, etc. Requires a collection group index.',
    {
      collectionId: z.string().describe('Collection ID (not a full path) — e.g. "comments" matches all /*/comments/* documents'),
      where: z.array(whereClause).optional()
        .describe('Array of where filter clauses — all are ANDed together'),
      orderBy: z.array(orderByClause).optional()
        .describe('Array of orderBy clauses applied in order'),
      limit: z.number().int().min(1).max(1000).optional().default(50)
        .describe('Max documents to return (default: 50, max: 1000)'),
      offset: z.number().int().min(0).optional().default(0)
        .describe('Number of documents to skip'),
    },
    async ({ collectionId, where: whereClauses, orderBy: orderByClauses, limit, offset }) => {
      try {
        const db = getDb();
        let query: Query<DocumentData> = db.collectionGroup(collectionId);

        if (whereClauses) {
          for (const clause of whereClauses) {
            query = query.where(clause.field, clause.op, clause.value);
          }
        }

        if (orderByClauses) {
          for (const clause of orderByClauses) {
            query = query.orderBy(clause.field, clause.direction);
          }
        }

        if (offset) {
          query = query.offset(offset);
        }

        query = query.limit(limit);

        const snapshot = await query.get();
        const documents = snapshot.docs.map(doc =>
          serializeDocument(doc.id, doc.ref.path, doc.data()),
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              collectionId,
              count: documents.length,
              query: {
                filters: whereClauses?.length ?? 0,
                orderBy: orderByClauses?.map(o => `${o.field} ${o.direction}`) ?? [],
                limit,
                offset,
              },
              documents,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(formatFirestoreError(error, 'firestore_collection_group_query'), null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}
