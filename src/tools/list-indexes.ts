import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getApps } from 'firebase-admin/app';
import type { FirestoreConfig } from '../config.js';
import { formatFirestoreError } from '../errors.js';

interface IndexField {
  fieldPath: string;
  order?: string;
  arrayConfig?: string;
}

interface FirestoreIndex {
  name: string;
  queryScope: string;
  fields: IndexField[];
  state: string;
}

export function registerListIndexes(server: McpServer, config: FirestoreConfig): void {
  server.tool(
    'firestore_list_indexes',
    'List all composite indexes defined for the Firestore database. Useful for understanding what queries are efficiently supported and diagnosing "missing index" errors.',
    {},
    async () => {
      try {
        const app = getApps()[0];
        const credential = app.options.credential;
        if (!credential) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ error: 'No credential available to list indexes' }),
            }],
            isError: true,
          };
        }

        const token = await credential.getAccessToken();
        const dbPath = config.databaseId === '(default)' ? '(default)' : config.databaseId;
        const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbPath}/collectionGroups/-/indexes`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });

        if (!response.ok) {
          const body = await response.text();
          let parsedError: Record<string, unknown> = {};
          try { parsedError = JSON.parse(body) as Record<string, unknown>; } catch { /* raw text fallback */ }

          const errorMessage = typeof parsedError.error === 'object' && parsedError.error !== null
            ? (parsedError.error as Record<string, unknown>).message as string || `HTTP ${response.status} ${response.statusText}`
            : `HTTP ${response.status} ${response.statusText}`;

          const httpStatus = response.status;
          let suggestion = 'Check the error details for more information.';
          if (httpStatus === 403) {
            suggestion = 'The service account lacks permission to list indexes. Ensure it has the Cloud Datastore Index Admin role (roles/datastore.indexAdmin) in the GCP IAM console.';
          } else if (httpStatus === 404) {
            suggestion = 'The project or database was not found. Verify FIRESTORE_PROJECT_ID and FIRESTORE_DATABASE_ID.';
          } else if (httpStatus === 401) {
            suggestion = 'Authentication failed. The service account credentials may be invalid or expired. Check FIRESTORE_SERVICE_ACCOUNT_KEY_PATH.';
          }

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: errorMessage,
                code: `HTTP_${httpStatus}`,
                tool: 'firestore_list_indexes',
                suggestion,
                details: body,
              }, null, 2),
            }],
            isError: true,
          };
        }

        const data = await response.json() as { indexes?: FirestoreIndex[] };
        const indexes = (data.indexes ?? []).map(idx => ({
          name: idx.name.split('/').pop(),
          queryScope: idx.queryScope,
          fields: idx.fields.map(f => ({
            fieldPath: f.fieldPath,
            ...(f.order ? { order: f.order } : {}),
            ...(f.arrayConfig ? { arrayConfig: f.arrayConfig } : {}),
          })),
          state: idx.state,
        }));

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              projectId: config.projectId,
              databaseId: config.databaseId,
              count: indexes.length,
              indexes,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(formatFirestoreError(error, 'firestore_list_indexes'), null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}
