import { serializeValue, serializeDocument } from './serializer.js';

const mockTimestamp = {
  toDate: () => new Date('2024-01-15T10:30:00Z'),
};
Object.setPrototypeOf(mockTimestamp, Object.create({ constructor: { name: 'Timestamp' } }));

const mockGeoPoint = {
  latitude: 37.7749,
  longitude: -122.4194,
};

const mockDocRef = {
  path: 'users/alice',
};

describe('serializeValue', () => {
  it('returns null for null', () => {
    expect(serializeValue(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(serializeValue(undefined)).toBeNull();
  });

  it('passes through strings', () => {
    expect(serializeValue('hello')).toBe('hello');
  });

  it('passes through numbers', () => {
    expect(serializeValue(42)).toBe(42);
    expect(serializeValue(3.14)).toBe(3.14);
  });

  it('passes through booleans', () => {
    expect(serializeValue(true)).toBe(true);
    expect(serializeValue(false)).toBe(false);
  });

  it('serializes arrays recursively', () => {
    expect(serializeValue([1, 'two', null, true])).toEqual([1, 'two', null, true]);
  });

  it('serializes nested objects', () => {
    const input = { name: 'Alice', age: 30, address: { city: 'SF' } };
    expect(serializeValue(input)).toEqual({ name: 'Alice', age: 30, address: { city: 'SF' } });
  });

  it('serializes Buffer as bytes', () => {
    const buf = Buffer.from('hello world');
    const result = serializeValue(buf) as { _type: string; base64: string };
    expect(result._type).toBe('bytes');
    expect(Buffer.from(result.base64, 'base64').toString()).toBe('hello world');
  });

  it('serializes Uint8Array as bytes', () => {
    const arr = new Uint8Array([72, 101, 108, 108, 111]);
    const result = serializeValue(arr) as { _type: string; base64: string };
    expect(result._type).toBe('bytes');
    expect(Buffer.from(result.base64, 'base64').toString()).toBe('Hello');
  });
});

describe('serializeDocument', () => {
  it('adds _id and _path to document data', () => {
    const result = serializeDocument('alice', 'users/alice', { name: 'Alice', age: 30 });
    expect(result._id).toBe('alice');
    expect(result._path).toBe('users/alice');
    expect(result.name).toBe('Alice');
    expect(result.age).toBe(30);
  });

  it('handles empty document data', () => {
    const result = serializeDocument('empty', 'things/empty', {});
    expect(result).toEqual({ _id: 'empty', _path: 'things/empty' });
  });

  it('handles nested data', () => {
    const result = serializeDocument('doc1', 'col/doc1', {
      tags: ['a', 'b'],
      meta: { created: 'today' },
    });
    expect(result.tags).toEqual(['a', 'b']);
    expect(result.meta).toEqual({ created: 'today' });
  });
});
