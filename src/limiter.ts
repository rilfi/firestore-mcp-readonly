export class LimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LimitExceededError';
  }
}

export class DumpLimiter {
  private totalDocs = 0;

  constructor(
    private readonly maxTotal: number,
    private readonly maxDepth: number,
  ) {}

  checkDepth(depth: number): void {
    if (depth > this.maxDepth) {
      throw new LimitExceededError(
        `Max recursion depth ${this.maxDepth} exceeded`,
      );
    }
  }

  addDocs(count: number): void {
    this.totalDocs += count;
    if (this.totalDocs > this.maxTotal) {
      throw new LimitExceededError(
        `Max total document count ${this.maxTotal} exceeded — dump truncated`,
      );
    }
  }

  get docsProcessed(): number {
    return this.totalDocs;
  }
}
