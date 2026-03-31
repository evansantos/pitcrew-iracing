import { describe, it, expect } from 'vitest';
import { UndercutAnalyzer } from '../undercut-analyzer.js';
import type { GapAnalysis } from '../types.js';

function makeGap(overrides: Partial<GapAnalysis> = {}): GapAnalysis {
  return {
    carIdx: 1,
    driverName: 'Max Verstappen',
    position: 1,
    gapToPlayer: 25,
    gapTrend: 'stable',
    gapChangeRate: 0,
    lastLapTime: 90,
    bestLapTime: 88,
    ...overrides,
  };
}

describe('UndercutAnalyzer', () => {
  const analyzer = new UndercutAnalyzer();

  describe('analyzeUndercut', () => {
    it('returns null for empty gaps', () => {
      expect(analyzer.analyzeUndercut([], 10, 15)).toBeNull();
    });

    it('returns null when no car ahead at position 1', () => {
      const gaps = [makeGap({ position: 3 })];
      expect(analyzer.analyzeUndercut(gaps, 10, 15)).toBeNull();
    });

    it('returns analysis when undercut is viable', () => {
      const gaps = [makeGap({ gapToPlayer: 25, gapTrend: 'stable' })];
      const result = analyzer.analyzeUndercut(gaps, 10, 15);
      expect(result).not.toBeNull();
      expect(result!.isViable).toBe(true);
      expect(result!.recommendedLap).toBe(11);
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.confidence).toBeLessThanOrEqual(1);
    });

    it('returns null when gap too small', () => {
      const gaps = [makeGap({ gapToPlayer: 10 })];
      expect(analyzer.analyzeUndercut(gaps, 10, 15)).toBeNull();
    });

    it('returns null when gap too large', () => {
      const gaps = [makeGap({ gapToPlayer: 40 })];
      expect(analyzer.analyzeUndercut(gaps, 10, 15)).toBeNull();
    });

    it('returns null when tires too fresh', () => {
      const gaps = [makeGap({ gapToPlayer: 25 })];
      expect(analyzer.analyzeUndercut(gaps, 10, 5)).toBeNull();
    });

    it('returns null when gap trend is opening', () => {
      const gaps = [makeGap({ gapToPlayer: 25, gapTrend: 'opening' })];
      expect(analyzer.analyzeUndercut(gaps, 10, 15)).toBeNull();
    });

    it('works when gap trend is closing', () => {
      const gaps = [makeGap({ gapToPlayer: 25, gapTrend: 'closing' })];
      expect(analyzer.analyzeUndercut(gaps, 10, 15)).not.toBeNull();
    });

    it('higher confidence with ideal gap (22-28s)', () => {
      const idealResult = analyzer.analyzeUndercut([makeGap({ gapToPlayer: 25 })], 10, 15);
      const edgeResult = analyzer.analyzeUndercut([makeGap({ gapToPlayer: 16 })], 10, 15);
      expect(idealResult!.confidence).toBeGreaterThan(edgeResult!.confidence);
    });

    it('sorts by position to find car ahead', () => {
      const gaps = [
        makeGap({ position: 3, driverName: 'P3' }),
        makeGap({ position: 1, driverName: 'P1', gapToPlayer: 25 }),
        makeGap({ position: 2, driverName: 'P2' }),
      ];
      const result = analyzer.analyzeUndercut(gaps, 10, 15);
      expect(result!.targetDriverName).toBe('P1');
    });
  });

  describe('analyzeOvercut', () => {
    it('returns null when no opponent has pitted', () => {
      expect(analyzer.analyzeOvercut([makeGap()], 10, 12)).toBeNull();
    });

    it('returns analysis when overcut is viable', () => {
      const gaps = [makeGap({ gapToPlayer: 20 })];
      const result = analyzer.analyzeOvercut(gaps, 10, 12, 8);
      expect(result).not.toBeNull();
      expect(result!.isViable).toBe(true);
      expect(result!.additionalLapsOnCurrentTires).toBeGreaterThan(0);
    });

    it('returns null when opponent pitted too long ago', () => {
      expect(analyzer.analyzeOvercut([makeGap({ gapToPlayer: 20 })], 10, 12, 5)).toBeNull();
    });

    it('returns null when gap too large', () => {
      expect(analyzer.analyzeOvercut([makeGap({ gapToPlayer: 35 })], 10, 12, 8)).toBeNull();
    });

    it('returns null when player tires too old', () => {
      expect(analyzer.analyzeOvercut([makeGap({ gapToPlayer: 20 })], 10, 25, 8)).toBeNull();
    });
  });

  describe('analyzeGapTrend', () => {
    it('returns stable for fewer than 3 data points', () => {
      expect(analyzer.analyzeGapTrend([]).trend).toBe('stable');
      expect(analyzer.analyzeGapTrend([5, 4]).trend).toBe('stable');
    });

    it('detects closing trend', () => {
      const result = analyzer.analyzeGapTrend([10, 9, 8, 7, 6]);
      expect(result.trend).toBe('closing');
      expect(result.rate).toBeLessThan(0);
    });

    it('detects opening trend', () => {
      const result = analyzer.analyzeGapTrend([6, 7, 8, 9, 10]);
      expect(result.trend).toBe('opening');
      expect(result.rate).toBeGreaterThan(0);
    });

    it('detects stable trend', () => {
      const result = analyzer.analyzeGapTrend([5.0, 5.01, 5.0, 4.99, 5.0]);
      expect(result.trend).toBe('stable');
    });

    it('handles identical values', () => {
      const result = analyzer.analyzeGapTrend([5, 5, 5, 5]);
      expect(result.trend).toBe('stable');
      expect(result.rate).toBeCloseTo(0, 5);
    });
  });
});
