import { Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';

export type SerializedValue =
  | { _type: 'timestamp'; value: string }
  | { _type: 'geopoint'; lat: number; lng: number }
  | { _type: 'reference'; path: string }
  | { _type: 'bytes'; base64: string }
  | null
  | boolean
  | number
  | string
  | SerializedValue[]
  | { [key: string]: SerializedValue };

export function serializeValue(value: unknown): SerializedValue {
  if (value === null || value === undefined) return null;

  if (value instanceof Timestamp) {
    return { _type: 'timestamp', value: value.toDate().toISOString() };
  }
  if (value instanceof GeoPoint) {
    return { _type: 'geopoint', lat: value.latitude, lng: value.longitude };
  }
  if (value instanceof DocumentReference) {
    return { _type: 'reference', path: value.path };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { _type: 'bytes', base64: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (typeof value === 'object') {
    const out: Record<string, SerializedValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeValue(v);
    }
    return out;
  }

  return value as string | number | boolean;
}

export function serializeDocument(
  id: string,
  path: string,
  data: Record<string, unknown>,
): Record<string, SerializedValue> {
  const out: Record<string, SerializedValue> = {
    _id: id,
    _path: path,
  };
  for (const [k, v] of Object.entries(data)) {
    out[k] = serializeValue(v);
  }
  return out;
}
