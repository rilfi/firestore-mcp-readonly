import { loadConfig } from './config.js';
import { fileURLToPath } from 'url';

const thisFile = fileURLToPath(import.meta.url);

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws if FIRESTORE_SERVICE_ACCOUNT_KEY_PATH is missing', () => {
    process.env.FIRESTORE_PROJECT_ID = 'test-project';
    delete process.env.FIRESTORE_SERVICE_ACCOUNT_KEY_PATH;
    expect(() => loadConfig()).toThrow('FIRESTORE_SERVICE_ACCOUNT_KEY_PATH');
  });

  it('throws if FIRESTORE_PROJECT_ID is missing', () => {
    process.env.FIRESTORE_SERVICE_ACCOUNT_KEY_PATH = '/path/to/key.json';
    delete process.env.FIRESTORE_PROJECT_ID;
    expect(() => loadConfig()).toThrow('FIRESTORE_PROJECT_ID');
  });

  it('throws if key file does not exist', () => {
    process.env.FIRESTORE_SERVICE_ACCOUNT_KEY_PATH = '/definitely/nonexistent/path/key.json';
    process.env.FIRESTORE_PROJECT_ID = 'test-project';
    expect(() => loadConfig()).toThrow('Service account key file not found');
  });

  it('returns config with defaults when key file exists', () => {
    process.env.FIRESTORE_SERVICE_ACCOUNT_KEY_PATH = thisFile;
    process.env.FIRESTORE_PROJECT_ID = 'test-project';

    const config = loadConfig();
    expect(config.serviceAccountKeyPath).toBe(thisFile);
    expect(config.projectId).toBe('test-project');
    expect(config.databaseId).toBe('(default)');
    expect(config.limits.maxDocsPerCollection).toBe(500);
    expect(config.limits.maxRecursionDepth).toBe(10);
    expect(config.limits.maxTotalDumpDocs).toBe(5000);
  });

  it('respects custom env values', () => {
    process.env.FIRESTORE_SERVICE_ACCOUNT_KEY_PATH = thisFile;
    process.env.FIRESTORE_PROJECT_ID = 'my-project';
    process.env.FIRESTORE_DATABASE_ID = 'my-db';
    process.env.FIRESTORE_MAX_DOCS_PER_COLLECTION = '100';
    process.env.FIRESTORE_MAX_RECURSION_DEPTH = '5';
    process.env.FIRESTORE_MAX_TOTAL_DUMP_DOCS = '2000';

    const config = loadConfig();
    expect(config.databaseId).toBe('my-db');
    expect(config.limits.maxDocsPerCollection).toBe(100);
    expect(config.limits.maxRecursionDepth).toBe(5);
    expect(config.limits.maxTotalDumpDocs).toBe(2000);
  });
});
