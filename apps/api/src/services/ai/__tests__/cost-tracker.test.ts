import { describe, it, expect } from 'vitest';
import { CostTracker } from '../cost-tracker.js';

describe('CostTracker', () => {
  it('starts with zero tokens used', () => {
    const tracker = new CostTracker();
    const snapshot = tracker.getSnapshot();
    expect(snapshot.tokensUsed).toBe(0);
    expect(snapshot.percentUsed).toBe(0);
    expect(snapshot.isOverLimit).toBe(false);
    expect(snapshot.isWarning).toBe(false);
  });

  it('tracks token usage', () => {
    const tracker = new CostTracker({ maxTokensPerSession: 1000 });
    tracker.record(300);
    tracker.record(200);

    const snapshot = tracker.getSnapshot();
    expect(snapshot.tokensUsed).toBe(500);
    expect(snapshot.percentUsed).toBeCloseTo(0.5);
  });

  it('warns at threshold', () => {
    const tracker = new CostTracker({ maxTokensPerSession: 1000, warnThreshold: 0.8 });
    tracker.record(800);

    const snapshot = tracker.getSnapshot();
    expect(snapshot.isWarning).toBe(true);
    expect(snapshot.isOverLimit).toBe(false);
  });

  it('blocks when over limit', () => {
    const tracker = new CostTracker({ maxTokensPerSession: 1000 });
    tracker.record(1001);

    expect(tracker.canProceed()).toBe(false);
    expect(tracker.getSnapshot().isOverLimit).toBe(true);
  });

  it('allows proceed under limit', () => {
    const tracker = new CostTracker({ maxTokensPerSession: 1000 });
    tracker.record(500);

    expect(tracker.canProceed()).toBe(true);
  });

  it('resets usage', () => {
    const tracker = new CostTracker({ maxTokensPerSession: 1000 });
    tracker.record(500);
    tracker.reset();

    expect(tracker.getSnapshot().tokensUsed).toBe(0);
    expect(tracker.canProceed()).toBe(true);
  });
});
