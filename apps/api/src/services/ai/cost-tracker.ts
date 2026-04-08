/**
 * Cost tracker for AI token usage.
 * Enforces configurable per-session token caps.
 */

export interface CostTrackerOptions {
  /** Max tokens per session (default 100000) */
  maxTokensPerSession?: number;
  /** Warning threshold as percentage (default 0.8 = 80%) */
  warnThreshold?: number;
}

export interface CostSnapshot {
  tokensUsed: number;
  tokenLimit: number;
  percentUsed: number;
  isOverLimit: boolean;
  isWarning: boolean;
}

export class CostTracker {
  private tokensUsed = 0;
  private readonly maxTokens: number;
  private readonly warnThreshold: number;

  constructor(options: CostTrackerOptions = {}) {
    this.maxTokens = options.maxTokensPerSession ?? 100_000;
    this.warnThreshold = options.warnThreshold ?? 0.8;
  }

  record(tokens: number): void {
    this.tokensUsed += tokens;
  }

  canProceed(): boolean {
    return this.tokensUsed < this.maxTokens;
  }

  getSnapshot(): CostSnapshot {
    const percentUsed = this.maxTokens > 0 ? this.tokensUsed / this.maxTokens : 0;
    return {
      tokensUsed: this.tokensUsed,
      tokenLimit: this.maxTokens,
      percentUsed,
      isOverLimit: this.tokensUsed >= this.maxTokens,
      isWarning: percentUsed >= this.warnThreshold,
    };
  }

  reset(): void {
    this.tokensUsed = 0;
  }
}
