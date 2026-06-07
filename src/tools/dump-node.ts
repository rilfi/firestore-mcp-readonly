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

async function dumpCollection(
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
        subs[sub.id] = await dumpCollection(sub.path, depth + 1, limiter, maxDocsPerCollection);
      }
      (serialized as Record<string, unknown>)._subcollections = subs;
    }

    documents[doc.id] = serialized;
  }

  return result;
}

async function dumpDocument(
  documentPath: string,
  depth: number,
  limiter: DumpLimiter,
  maxDocsPerCollection: number,
): Promise<DumpResult> {
  const db = getDb();
  const docRef = db.doc(documentPath);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return { _type: 'document', _path: documentPath, exists: false };
  }

  limiter.addDocs(1);
  const serialized = serializeDocument(snapshot.id, snapshot.ref.path, snapshot.data()!) as DumpResult;
  const subcollections = await docRef.listCollections();

  if (subcollections.length > 0) {
    const subs: Record<string, unknown> = {};
    for (const sub of subcollections) {
      subs[sub.id] = await dumpCollection(sub.path, depth + 1, limiter, maxDocsPerCollection);
    }
    serialized._subcollections = subs;
  }

  return serialized;
}

export function registerDumpNode(server: McpServer, config: FirestoreConfig): void {
  server.tool(
    'firestore_dump_node',
    'Recursively dump all documents and subcollections under a given Firestore path. Works with both document paths (even segments) and collection paths (odd segments). Returns a nested tree structure. Respects configurable depth and document count limits to prevent excessive reads.',
    {
      path: z.string().describe('Starting path — document (e.g. "users/alice") or collection (e.g. "users")'),
      maxDepth: z.number().int().min(1).max(20).optional()
        .describe('Override max recursion depth (default from server config)'),
      maxDocs: z.number().int().min(1).max(10000).optional()
        .describe('Override max total documents to read (default from server config)'),
    },
    async ({ path, maxDepth, maxDocs }) => {
      const limiter = new DumpLimiter(
        maxDocs ?? config.limits.maxTotalDumpDocs,
        maxDepth ?? config.limits.maxRecursionDepth,
      );

      try {
        const segments = path.split('/').filter(Boolean);
        const isDocument = segments.length % 2 === 0;

        let data: DumpResult;
        if (isDocument) {
          data = await dumpDocument(path, 0, limiter, config.limits.maxDocsPerCollection);
        } else {
          data = await dumpCollection(path, 0, limiter, config.limits.maxDocsPerCollection);
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              rootPath: path,
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
                rootPath: path,
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
            text: JSON.stringify(formatFirestoreError(error, 'firestore_dump_node'), null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}
