# firestore-mcp-readonly

[![npm version](https://img.shields.io/npm/v/firestore-mcp-readonly)](https://www.npmjs.com/package/firestore-mcp-readonly)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

A read-only [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for Google Cloud Firestore. Gives AI agents full read access to any Firestore database — query documents, explore subcollections, dump entire hierarchies — without any write capabilities.

## Features

| Tool | Description |
|------|-------------|
| `firestore_get_document` | Get a single document by full path |
| `firestore_get_collection` | Get all documents from a collection |
| `firestore_query_collection` | Query with filters, ordering, pagination, cursors |
| `firestore_collection_group_query` | Query across all collections with the same ID |
| `firestore_list_subcollections` | List subcollection names under a document |
| `firestore_count_documents` | Count documents matching a query (aggregate) |
| `firestore_list_indexes` | List composite indexes in the database |
| `firestore_dump_node` | Recursively dump a subtree (documents + subcollections) |
| `firestore_dump_database` | Recursively dump the entire database |
| `firestore_read_collection_ordered` | Recursively read all documents from a collection and subcollections, returned as a flat sorted list |
| `firestore_get_server_info` | Get project ID, database ID, limits, root collections |

### Query Operators

All Firestore query operators are supported:

`==`, `!=`, `<`, `<=`, `>`, `>=`, `array-contains`, `array-contains-any`, `in`, `not-in`

### Pagination

- Offset-based: `limit` + `offset`
- Cursor-based: `startAt`, `startAfter`, `endAt`, `endBefore` (by document ID)

### Type Serialization

Firestore-specific types are converted to JSON-safe objects:

| Firestore Type | JSON Output |
|---------------|-------------|
| Timestamp | `{ "_type": "timestamp", "value": "2024-01-01T00:00:00.000Z" }` |
| GeoPoint | `{ "_type": "geopoint", "lat": 37.7749, "lng": -122.4194 }` |
| DocumentReference | `{ "_type": "reference", "path": "users/alice" }` |
| Bytes | `{ "_type": "bytes", "base64": "..." }` |

## Setup

### Prerequisites

- Node.js >= 18
- A GCP service account key (see below)

### Service Account Setup

1. **Open the GCP Console**
   Go to [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) and select your project.

2. **Create a service account**
   Click **Create Service Account**. Use a descriptive name like `firestore-mcp-reader`. You can skip the optional description.

3. **Assign roles**
   On the "Grant this service account access to project" step, add:

   | Role | Role ID | Purpose |
   |------|---------|---------|
   | Cloud Datastore Viewer | `roles/datastore.viewer` | **Required.** Read documents, query collections, list subcollections, count, and dump. |
   | Cloud Datastore Index Admin | `roles/datastore.indexAdmin` | **Optional.** Only needed for the `firestore_list_indexes` tool. |

   Click **Done** to finish creating the service account.

4. **Create a JSON key**
   Click on the newly created service account, go to the **Keys** tab, click **Add Key > Create new key**, select **JSON**, and click **Create**. A `.json` file will download automatically.

5. **Store the key securely**
   Move the downloaded file to a secure location (e.g. `~/.config/gcloud/firestore-mcp-reader.json`). This path goes into the `FIRESTORE_SERVICE_ACCOUNT_KEY_PATH` environment variable.

   > **Do not commit the key file to version control.** Add it to your `.gitignore`.

### Install globally (recommended)

```bash
npm install -g firestore-mcp-readonly
```

Then add to your MCP config (e.g. `claude_desktop_config.json`, `.mcp.json`):

```json
{
  "mcpServers": {
    "firestore": {
      "command": "firestore-mcp-readonly",
      "env": {
        "FIRESTORE_SERVICE_ACCOUNT_KEY_PATH": "/path/to/service-account.json",
        "FIRESTORE_PROJECT_ID": "my-gcp-project",
        "FIRESTORE_DATABASE_ID": "(default)",
        "FIRESTORE_MAX_DOCS_PER_COLLECTION": "500",
        "FIRESTORE_MAX_RECURSION_DEPTH": "10",
        "FIRESTORE_MAX_TOTAL_DUMP_DOCS": "5000"
      }
    }
  }
}
```


## Configuration

All configuration is via environment variables (set in the `env` block of `.mcp.json`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FIRESTORE_SERVICE_ACCOUNT_KEY_PATH` | Yes | — | Absolute path to service account JSON key file |
| `FIRESTORE_PROJECT_ID` | Yes | — | GCP project ID |
| `FIRESTORE_DATABASE_ID` | No | `(default)` | Named database ID |
| `FIRESTORE_MAX_DOCS_PER_COLLECTION` | No | `500` | Max docs per single collection fetch |
| `FIRESTORE_MAX_RECURSION_DEPTH` | No | `10` | Max depth for recursive dumps |
| `FIRESTORE_MAX_TOTAL_DUMP_DOCS` | No | `5000` | Max total docs across a dump operation |

## Safety

- **Read-only**: No create, update, or delete operations are exposed
- **Depth limits**: Recursive dumps stop at configurable depth
- **Document caps**: Total documents per dump are capped
- **Partial results**: When limits are hit, partial data is returned with `limitReached: true` instead of erroring
- **No secrets exposed**: `firestore_get_server_info` never returns the service account key

## License

MIT
