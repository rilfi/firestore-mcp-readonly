import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { FirestoreConfig } from '../config.js';
import { getDb } from '../db.js';
import { serializeDocument } from '../serializer.js';
import { DumpLimiter, LimitExceededError } from '../limiter.js';
import { formatFirestoreError } from '../errors.js';

interface DumpResult {
  [key: string]: unknown;
}

async function dumpCollectionRecursive(
  collectionPath: string,
  depth: number,
  limiter: DumpLimiter,
  maxDocsPerCollection: number,
): Promise<DumpResult> {
  limiter.checkDepth(depth);
  const db = getDb();
  const snapshot = await db.collection(collectionPath).limit(maxDocsPerCollection).get();
  limiter.addDocs(snapshot.docs.length);

  const result: DumpResult = {
    _type: 'collection',
    _path: collectionPath,
    _documentCount: snapshot.docs.length,
    documents: {} as Record<string, unknown>,
  };

  const documents = result.documents as Record<string, unknown>;
  for (const doc of snapshot.docs) {
    const serialized = serializeDocument(doc.id, doc.ref.path, doc.data());
    const subcollections = await doc.ref.listCollections();

    if (subcollections.length > 0) {
      const subs: Record<string, unknown> = {};
      for (const sub of subcollections) {
        subs[sub.id] = await dumpCollectionRecursive(sub.path, depth + 1, limiter, maxDocsPerCollection);
      }
      (serialized as Record<string, unknown>)._subcollections = subs;
    }

    documents[doc.id] = serialized;
  }

  return result;
}

export function registerDumpDatabase(server: McpServer, config: FirestoreConfig): void {
  server.tool(
    'firestore_dump_database',
    'Recursively dump the entire Firestore database. Lists all root-level collections and traverses each one depth-first. Returns a nested tree of all documents and subcollections. Use with caution on large databases — configure limits via env vars or parameters.',
    {
      maxDepth: z.number().int().min(1).max(15).optional()
        .describe('Override max recursion depth (default from server config)'),
      maxDocs: z.number().int().min(1).max(10000).optional()
        .describe('Override max total documents to read (default from server config)'),
      excludeCollections: z.array(z.string()).optional()
        .describe('Root collection IDs to skip, e.g. ["_metadata", "_temp"]'),
    },
    async ({ maxDepth, maxDocs, excludeCollections }) => {
      const limiter = new DumpLimiter(
        maxDocs ?? config.limits.maxTotalDumpDocs,
        maxDepth ?? config.limits.maxRecursionDepth,
      );

      try {
        const db = getDb();
        const rootCollections = await db.listCollections();
        const excludeSet = new Set(excludeCollections ?? []);

        const filtered = rootCollections.filter(col => !excludeSet.has(col.id));
        const rootNames = filtered.map(col => col.id);

        const data: Record<string, unknown> = {};
        for (const col of filtered) {
          data[col.id] = await dumpCollectionRecursive(col.path, 0, limiter, config.limits.maxDocsPerCollection);
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              rootCollections: rootNames,
              excludedCollections: excludeCollections ?? [],
              totalDocsRead: limiter.docsProcessed,
              limitReached: false,
              data,
            }, null, 2),
          }],
        };
      } catch (error) {
        if (error instanceof LimitExceededError) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                totalDocsRead: limiter.docsProcessed,
                limitReached: true,
                limitReason: error.message,
                note: 'Partial data returned. Use excludeCollections or lower maxDocs/maxDepth to narrow scope.',
              }, null, 2),
            }],
          };
        }
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(formatFirestoreError(error, 'firestore_dump_database'), null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}
