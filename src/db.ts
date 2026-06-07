import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import type { FirestoreConfig } from './config.js';

let db: Firestore | null = null;

export function initDb(config: FirestoreConfig): void {
  if (getApps().length === 0) {
    let raw: string;
    try {
      raw = readFileSync(config.serviceAccountKeyPath, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to read service account key file at "${config.serviceAccountKeyPath}": ${err instanceof Error ? err.message : String(err)}`);
    }

    let serviceAccount: Record<string, unknown>;
    try {
      serviceAccount = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`Service account key file at "${config.serviceAccountKeyPath}" is not valid JSON`);
    }

    if (!serviceAccount.client_email || typeof serviceAccount.client_email !== 'string') {
      throw new Error(`Service account key file is missing "client_email" field. Ensure you downloaded a JSON key (not a P12 key) from the GCP console.`);
    }
    if (!serviceAccount.private_key || typeof serviceAccount.private_key !== 'string') {
      throw new Error(`Service account key file is missing "private_key" field. Ensure you downloaded a JSON key (not a P12 key) from the GCP console.`);
    }

    try {
      initializeApp({
        credential: cert(serviceAccount as Parameters<typeof cert>[0]),
        projectId: config.projectId,
      });
    } catch (err) {
      throw new Error(`Failed to initialize Firebase Admin with the service account at "${config.serviceAccountKeyPath}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (config.databaseId !== '(default)') {
    db = getFirestore(config.databaseId);
  } else {
    db = getFirestore();
  }
}

export function getDb(): Firestore {
  if (!db) throw new Error('Firestore not initialized — call initDb() first');
  return db;
}
