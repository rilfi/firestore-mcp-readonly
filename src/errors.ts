interface FirestoreErrorInfo {
  error: string;
  code: string | null;
  tool: string;
  suggestion: string;
  details: string | null;
}

const GRPC_CODE_MAP: Record<number, { name: string; suggestion: string }> = {
  1: { name: 'CANCELLED', suggestion: 'The operation was cancelled. Retry the request.' },
  2: { name: 'UNKNOWN', suggestion: 'An unknown error occurred. Check the details for more information.' },
  3: { name: 'INVALID_ARGUMENT', suggestion: 'The request contains an invalid argument. Check the path, field names, and filter values.' },
  4: { name: 'DEADLINE_EXCEEDED', suggestion: 'The request timed out. Try reducing the scope (fewer documents, shallower depth).' },
  5: { name: 'NOT_FOUND', suggestion: 'The database or project was not found. Verify FIRESTORE_PROJECT_ID and FIRESTORE_DATABASE_ID are correct.' },
  6: { name: 'ALREADY_EXISTS', suggestion: 'The resource already exists.' },
  7: { name: 'PERMISSION_DENIED', suggestion: 'The service account lacks read access. Ensure it has the Cloud Datastore Viewer role (roles/datastore.viewer) in the GCP IAM console.' },
  8: { name: 'RESOURCE_EXHAUSTED', suggestion: 'Quota or rate limit exceeded. Reduce the request scope or wait before retrying.' },
  9: { name: 'FAILED_PRECONDITION', suggestion: 'This query requires a composite index. The error message above contains a direct link to create it in the Firebase console.' },
  10: { name: 'ABORTED', suggestion: 'The operation was aborted due to a conflict. Retry the request.' },
  13: { name: 'INTERNAL', suggestion: 'An internal Firestore error occurred. This is usually transient — retry the request.' },
  14: { name: 'UNAVAILABLE', suggestion: 'Firestore is temporarily unavailable. Retry the request after a short delay.' },
  16: { name: 'UNAUTHENTICATED', suggestion: 'The service account credentials are invalid or expired. Check that FIRESTORE_SERVICE_ACCOUNT_KEY_PATH points to a valid JSON key file.' },
};

function extractGrpcCode(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === 'number') return code;
  }
  return null;
}

function extractGrpcCodeName(error: unknown): string | null {
  const code = extractGrpcCode(error);
  if (code !== null && GRPC_CODE_MAP[code]) {
    return GRPC_CODE_MAP[code].name;
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === 'string') return code;
  }

  return null;
}

export function formatFirestoreError(error: unknown, toolName: string): FirestoreErrorInfo {
  const message = error instanceof Error ? error.message : String(error);
  const grpcCode = extractGrpcCode(error);
  const codeName = extractGrpcCodeName(error);

  let suggestion = 'Check the error message for details. If this persists, verify your service account permissions and Firestore configuration.';

  if (grpcCode !== null && GRPC_CODE_MAP[grpcCode]) {
    suggestion = GRPC_CODE_MAP[grpcCode].suggestion;
  }

  let details: string | null = null;
  if (error instanceof Error && error.stack) {
    details = error.stack;
  }
  if (typeof error === 'object' && error !== null && 'details' in error) {
    const d = (error as Record<string, unknown>).details;
    if (typeof d === 'string') {
      details = d;
    }
  }

  return {
    error: message,
    code: codeName,
    tool: toolName,
    suggestion,
    details,
  };
}
