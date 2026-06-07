import { existsSync } from 'fs';

export interface FirestoreConfig {
  serviceAccountKeyPath: string;
  projectId: string;
  databaseId: string;
  limits: {
    maxDocsPerCollection: number;
    maxRecursionDepth: number;
    maxTotalDumpDocs: number;
  };
}

export function loadConfig(): FirestoreConfig {
  const serviceAccountKeyPath = process.env.FIRESTORE_SERVICE_ACCOUNT_KEY_PATH;
  const projectId = process.env.FIRESTORE_PROJECT_ID;

  if (!serviceAccountKeyPath) {
    throw new Error('FIRESTORE_SERVICE_ACCOUNT_KEY_PATH environment variable is required');
  }
  if (!projectId) {
    throw new Error('FIRESTORE_PROJECT_ID environment variable is required');
  }
  if (!existsSync(serviceAccountKeyPath)) {
    throw new Error(`Service account key file not found: ${serviceAccountKeyPath}`);
  }

  const maxDocsPerCollection = parseInt(process.env.FIRESTORE_MAX_DOCS_PER_COLLECTION || '500', 10);
  const maxRecursionDepth = parseInt(process.env.FIRESTORE_MAX_RECURSION_DEPTH || '10', 10);
  const maxTotalDumpDocs = parseInt(process.env.FIRESTORE_MAX_TOTAL_DUMP_DOCS || '5000', 10);

  if (isNaN(maxDocsPerCollection)) {
    throw new Error(`FIRESTORE_MAX_DOCS_PER_COLLECTION must be a number, got "${process.env.FIRESTORE_MAX_DOCS_PER_COLLECTION}"`);
  }
  if (isNaN(maxRecursionDepth)) {
    throw new Error(`FIRESTORE_MAX_RECURSION_DEPTH must be a number, got "${process.env.FIRESTORE_MAX_RECURSION_DEPTH}"`);
  }
  if (isNaN(maxTotalDumpDocs)) {
    throw new Error(`FIRESTORE_MAX_TOTAL_DUMP_DOCS must be a number, got "${process.env.FIRESTORE_MAX_TOTAL_DUMP_DOCS}"`);
  }

  return {
    serviceAccountKeyPath,
    projectId,
    databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
    limits: {
      maxDocsPerCollection,
      maxRecursionDepth,
      maxTotalDumpDocs,
    },
  };
}
