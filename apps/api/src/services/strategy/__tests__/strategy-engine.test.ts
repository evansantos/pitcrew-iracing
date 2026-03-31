import { describe, it, expect } from 'vitest';
import { StrategyEngine } from '../strategy-engine.js';
import type { LapData, SessionContext, GapAnalysis } from '../types.js';

function makeLap(overrides: Partial<LapData> = {}): LapData {
  return {
    lapNumber: 10,
    lapTime: 90,
    fuelUsed: 2.5,
    fuelRemaining: 50,
    isValidLap: true,
    position: 3,
    avgTireWear: 0.2,
    avgTireTemp: 85,
    timestamp: new Date(),
    ...overrides,
  };
}

function makeContext(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    sessionId: 'test',
    trackName: 'Spa',
    carName: 'GT3',
    sessionType: 'race',
    totalLaps: 30,
    currentLap: 10,
    sessionTimeRemaining: 3600,
    fuelCapacity: 120,
    tankCapacity: 120,
    ...overrides,
  };
}

function makeGap(overrides: Partial<GapAnalysis> = {}): GapAnalysis {
  return {
    carIdx: 1,
    driverName: 'Opponent',
    position: 1,
    gapToPlayer: 25,
    gapTrend: 'stable',
    gapChangeRate: 0,
    lastLapTime: 90,
    bestLapTime: 88,
    ...overrides,
  };
}

describe('StrategyEngine', () => {
  const engine = new StrategyEngine();

  describe('calculateStrategy', () => {
    it('returns complete strategy state', () => {
      const ctx = makeContext();
      const currentLap = makeLap();
      const result = engine.calculateStrategy(ctx, currentLap, [makeLap()], []);

      expect(result.sessionContext).toBe(ctx);
      expect(result.currentLap).toBe(currentLap);
      expect(result.fuelStrategy).toBeDefined();
      expect(result.tireDegradation).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('includes fuel strategy with valid data', () => {
      const recentLaps = [
        makeLap({ fuelUsed: 2.5, fuelRemaining: 50 }),
        makeLap({ fuelUsed: 2.6, fuelRemaining: 47.4 }),
      ];
      const result = engine.calculateStrategy(makeContext(), makeLap(), recentLaps, []);

      expect(result.fuelStrategy.fuelPerLap).toBeGreaterThan(0);
      expect(typeof result.fuelStrategy.refuelRequired).toBe('boolean');
    });

    it('includes tire degradation', () => {
      const recentLaps = [
        makeLap({ avgTireWear: 0.15 }),
        makeLap({ avgTireWear: 0.20 }),
      ];
      const result = engine.calculateStrategy(makeContext(), makeLap(), recentLaps, []);

      expect(result.tireDegradation.performance).toBeGreaterThanOrEqual(0);
      expect(result.tireDegradation.performance).toBeLessThanOrEqual(1);
    });

    it('returns null pit window when no pit needed', () => {
      const recentLaps = [makeLap({ fuelUsed: 1.0, fuelRemaining: 100, avgTireWear: 0.1 })];
      const ctx = makeContext({ totalLaps: 15, currentLap: 10 });
      const result = engine.calculateStrategy(ctx, makeLap(), recentLaps, []);

      expect(result.pitWindow).toBeNull();
    });

    it('returns pit window when fuel is low', () => {
      const recentLaps = [makeLap({ fuelUsed: 3.0, fuelRemaining: 10, avgTireWear: 0.1 })];
      const ctx = makeContext({ totalLaps: 50, currentLap: 5 });
      const result = engine.calculateStrategy(ctx, makeLap(), recentLaps, []);

      expect(result.pitWindow).not.toBeNull();
      expect(result.pitWindow!.type).toBe('fuel');
    });

    it('handles empty inputs gracefully', () => {
      const result = engine.calculateStrategy(makeContext(), makeLap(), [], []);

      expect(result.fuelStrategy).toBeDefined();
      expect(result.tireDegradation).toBeDefined();
      expect(result.undercut).toBeNull();
      expect(result.overcut).toBeNull();
    });

    it('analyzes undercut when viable gap exists', () => {
      const gaps = [makeGap({ gapToPlayer: 25, gapTrend: 'stable' })];
      const result = engine.calculateStrategy(
        makeContext(), makeLap(), [makeLap()], gaps, 15
      );

      expect(result.undercut).not.toBeNull();
      expect(result.undercut!.isViable).toBe(true);
    });

    it('generates recommendations sorted by severity', () => {
      const recentLaps = [makeLap({ fuelUsed: 3.0, fuelRemaining: 5, avgTireWear: 0.5 })];
      const ctx = makeContext({ totalLaps: 50, currentLap: 5 });
      const result = engine.calculateStrategy(ctx, makeLap(), recentLaps, []);

      if (result.recommendations.length > 1) {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        for (let i = 1; i < result.recommendations.length; i++) {
          expect(severityOrder[result.recommendations[i].severity])
            .toBeGreaterThanOrEqual(severityOrder[result.recommendations[i - 1].severity]);
        }
      }
    });

    it('each recommendation has required fields', () => {
      const recentLaps = [makeLap({ fuelUsed: 3.0, fuelRemaining: 5, avgTireWear: 0.8 })];
      const ctx = makeContext({ totalLaps: 50, currentLap: 5 });
      const result = engine.calculateStrategy(ctx, makeLap(), recentLaps, []);

      for (const rec of result.recommendations) {
        expect(rec.id).toBeDefined();
        expect(rec.type).toBeDefined();
        expect(rec.title).toBeDefined();
        expect(rec.severity).toBeDefined();
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('handles first lap with no history', () => {
      const ctx = makeContext({ currentLap: 1, totalLaps: 30 });
      const result = engine.calculateStrategy(ctx, makeLap({ lapNumber: 1 }), [], []);
      expect(result.fuelStrategy).toBeDefined();
    });

    it('handles last lap', () => {
      const ctx = makeContext({ currentLap: 29, totalLaps: 30 });
      const recentLaps = [makeLap({ fuelUsed: 2.5, fuelRemaining: 10 })];
      const result = engine.calculateStrategy(ctx, makeLap({ lapNumber: 29 }), recentLaps, []);
      expect(result.fuelStrategy.lapsRemaining).toBe(1);
    });
  });
});
