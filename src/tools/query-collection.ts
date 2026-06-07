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
  ]).describe('Value to compare against. Use array for "in", "not-in", "array-contains-any" operators.'),
});

const orderByClause = z.object({
  field: z.string().describe('Field name to order by'),
  direction: z.enum(['asc', 'desc']).default('asc').describe('Sort direction'),
});

export function registerQueryCollection(server: McpServer): void {
  server.tool(
    'firestore_query_collection',
    'Query a Firestore collection with filters, ordering, and pagination. Supports all Firestore query operators. Note: complex queries may require composite indexes.',
    {
      collectionPath: z.string().describe('Collection path, e.g. "users" or "tenants/t1/orders"'),
      where: z.array(whereClause).optional()
        .describe('Array of where filter clauses — all are ANDed together'),
      orderBy: z.array(orderByClause).optional()
        .describe('Array of orderBy clauses applied in order'),
      limit: z.number().int().min(1).max(1000).optional().default(50)
        .describe('Max documents to return (default: 50, max: 1000)'),
      offset: z.number().int().min(0).optional().default(0)
        .describe('Number of documents to skip (for offset-based pagination)'),
      startAt: z.string().optional()
        .describe('Document ID to start at (cursor-based pagination, inclusive)'),
      startAfter: z.string().optional()
        .describe('Document ID to start after (cursor-based pagination, exclusive)'),
      endAt: z.string().optional()
        .describe('Document ID to end at (inclusive)'),
      endBefore: z.string().optional()
        .describe('Document ID to end before (exclusive)'),
    },
    async ({ collectionPath, where: whereClauses, orderBy: orderByClauses, limit, offset, startAt, startAfter, endAt, endBefore }) => {
      try {
        const db = getDb();
        let query: Query<DocumentData> = db.collection(collectionPath);

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

        if (startAt) {
          const snap = await db.doc(`${collectionPath}/${startAt}`).get();
          if (snap.exists) query = query.startAt(snap);
        }
        if (startAfter) {
          const snap = await db.doc(`${collectionPath}/${startAfter}`).get();
          if (snap.exists) query = query.startAfter(snap);
        }
        if (endAt) {
          const snap = await db.doc(`${collectionPath}/${endAt}`).get();
          if (snap.exists) query = query.endAt(snap);
        }
        if (endBefore) {
          const snap = await db.doc(`${collectionPath}/${endBefore}`).get();
          if (snap.exists) query = query.endBefore(snap);
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
              collectionPath,
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
            text: JSON.stringify(formatFirestoreError(error, 'firestore_query_collection'), null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}
