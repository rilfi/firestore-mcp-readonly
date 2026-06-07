import { DumpLimiter, LimitExceededError } from './limiter.js';

describe('DumpLimiter', () => {
  it('tracks document count', () => {
    const limiter = new DumpLimiter(100, 5);
    expect(limiter.docsProcessed).toBe(0);
    limiter.addDocs(10);
    expect(limiter.docsProcessed).toBe(10);
    limiter.addDocs(5);
    expect(limiter.docsProcessed).toBe(15);
  });

  it('throws LimitExceededError when doc count exceeds max', () => {
    const limiter = new DumpLimiter(10, 5);
    limiter.addDocs(8);
    expect(() => limiter.addDocs(5)).toThrow(LimitExceededError);
    expect(() => limiter.addDocs(5)).toThrow('Max total document count 10 exceeded');
  });

  it('throws LimitExceededError when depth exceeds max', () => {
    const limiter = new DumpLimiter(1000, 3);
    limiter.checkDepth(1);
    limiter.checkDepth(2);
    limiter.checkDepth(3);
    expect(() => limiter.checkDepth(4)).toThrow(LimitExceededError);
    expect(() => limiter.checkDepth(4)).toThrow('Max recursion depth 3 exceeded');
  });

  it('allows exactly at the depth limit', () => {
    const limiter = new DumpLimiter(1000, 5);
    expect(() => limiter.checkDepth(5)).not.toThrow();
  });

  it('allows exactly at the doc limit', () => {
    const limiter = new DumpLimiter(10, 5);
    expect(() => limiter.addDocs(10)).not.toThrow();
  });
});

describe('LimitExceededError', () => {
  it('is an instance of Error', () => {
    const err = new LimitExceededError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('LimitExceededError');
    expect(err.message).toBe('test');
  });
});
