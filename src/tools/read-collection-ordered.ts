import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { FirestoreConfig } from '../config.js';
import { getDb } from '../db.js';
import { serializeDocument, type SerializedValue } from '../serializer.js';
import { DumpLimiter, LimitExceededError } from '../limiter.js';
import { formatFirestoreError } from '../errors.js';

const orderByClause = z.object({
  field: z.string().describe('Field name to sort by'),
  direction: z.enum(['asc', 'desc']).default('asc').describe('Sort direction'),
});

type SerializedDoc = Record<string, SerializedValue>;

async function collectDocuments(
  collectionPath: string,
  depth: number,
  limiter: DumpLimiter,
  maxDocsPerCollection: number,
  docs: SerializedDoc[],
): Promise<void> {
  limiter.checkDepth(depth);
  const db = getDb();
  const snapshot = await db.collection(collectionPath).limit(maxDocsPerCollection).get();
  limiter.addDocs(snapshot.docs.length);

  for (const doc of snapshot.docs) {
    docs.push(serializeDocument(doc.id, doc.ref.path, doc.data()));

    const subcollections = await doc.ref.listCollections();
    for (const sub of subcollections) {
      await collectDocuments(sub.path, depth + 1, limiter, maxDocsPerCollection, docs);
    }
  }
}

function getSortValue(doc: SerializedDoc, field: string): unknown {
  const val = doc[field];
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'object' && val !== null && '_type' in val) {
    const typed = val as Record<string, unknown>;
    if (typed._type === 'timestamp') return typed.value;
    if (typed._type === 'geopoint') return typed.lat;
    if (typed._type === 'reference') return typed.path;
  }
  return val;
}

function compareValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  const aUndef = a === undefined || a === null;
  const bUndef = b === undefined || b === null;
  if (aUndef && bUndef) return 0;
  if (aUndef) return 1;
  if (bUndef) return -1;

  let result = 0;
  if (typeof a === 'number' && typeof b === 'number') {
    result = a - b;
  } else {
    result = String(a).localeCompare(String(b));
  }

  return direction === 'desc' ? -result : result;
}

export function registerReadCollectionOrdered(server: McpServer, config: FirestoreConfig): void {
  server.tool(
    'firestore_read_collection_ordered',
    'Recursively read all documents from a collection and its subcollections, returning a flat list sorted by one or more fields. Useful for getting an ordered view across an entire document hierarchy.',
    {
      collectionPath: z.string().describe('Collection path, e.g. "users" or "tenants/t1/projects"'),
      orderBy: z.array(orderByClause).min(1)
        .describe('Fields to sort by, applied in order. First entry is primary sort, rest are tiebreakers.'),
      limit: z.number().int().min(1).max(1000).optional().default(100)
        .describe('Max documents to return after sorting (default: 100, max: 1000)'),
      maxDepth: z.number().int().min(1).max(20).optional()
        .describe('Override max recursion depth (default from server config)'),
      maxDocs: z.number().int().min(1).max(10000).optional()
        .describe('Override max total documents to read (default from server config)'),
    },
    async ({ collectionPath, orderBy: orderByClauses, limit, maxDepth, maxDocs }) => {
      const limiter = new DumpLimiter(
        maxDocs ?? config.limits.maxTotalDumpDocs,
        maxDepth ?? config.limits.maxRecursionDepth,
      );

      try {
        const segments = collectionPath.split('/').filter(Boolean);
        if (segments.length === 0 || segments.length % 2 !== 1) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: `Invalid collection path "${collectionPath}": must have an odd number of segments. Got ${segments.length} segment(s).`,
              }),
            }],
            isError: true,
          };
        }

        const docs: SerializedDoc[] = [];
        await collectDocuments(collectionPath, 0, limiter, config.limits.maxDocsPerCollection, docs);

        docs.sort((a, b) => {
          for (const clause of orderByClauses) {
            const aVal = getSortValue(a, clause.field);
            const bVal = getSortValue(b, clause.field);
            const cmp = compareValues(aVal, bVal, clause.direction);
            if (cmp !== 0) return cmp;
          }
          return 0;
        });

        const limited = docs.slice(0, limit);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              collectionPath,
              orderBy: orderByClauses.map(o => `${o.field} ${o.direction}`),
              totalDocsRead: limiter.docsProcessed,
              count: limited.length,
              truncatedByLimit: docs.length > limit,
              limitReached: false,
              documents: limited,
            }, null, 2),
          }],
        };
      } catch (error) {
        if (error instanceof LimitExceededError) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                collectionPath,
                totalDocsRead: limiter.docsProcessed,
                limitReached: true,
                limitReason: error.message,
                note: 'Partial data returned. Use a narrower path or increase limits.',
              }, null, 2),
            }],
          };
        }
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(formatFirestoreError(error, 'firestore_read_collection_ordered'), null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}
