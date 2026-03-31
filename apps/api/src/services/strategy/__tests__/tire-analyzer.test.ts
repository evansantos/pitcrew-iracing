import { describe, it, expect } from 'vitest';
import { TireAnalyzer } from '../tire-analyzer.js';
import type { LapData } from '../types.js';

function makeLap(overrides: Partial<LapData> = {}): LapData {
  return {
    lapNumber: 5,
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

describe('TireAnalyzer', () => {
  const analyzer = new TireAnalyzer();

  describe('analyzeTireDegradation', () => {
    it('returns default degradation for empty laps', () => {
      const result = analyzer.analyzeTireDegradation([]);
      expect(result.currentWear).toBe(0);
      expect(result.performance).toBe(1.0);
      expect(result.degradationRate).toBe(0.01);
      expect(result.estimatedLapsRemaining).toBe(100);
    });

    it('handles single lap', () => {
      const result = analyzer.analyzeTireDegradation([makeLap({ avgTireWear: 0.1 })]);
      expect(result.currentWear).toBe(0.1);
      expect(result.degradationRate).toBe(0.01);
    });

    it('calculates degradation from multiple laps', () => {
      const laps = [
        makeLap({ avgTireWear: 0.10 }),
        makeLap({ avgTireWear: 0.15 }),
        makeLap({ avgTireWear: 0.20 }),
      ];
      const result = analyzer.analyzeTireDegradation(laps);
      expect(result.currentWear).toBe(0.2);
      expect(result.degradationRate).toBeGreaterThan(0);
    });

    it('clamps wear to [0, 1]', () => {
      const result = analyzer.analyzeTireDegradation([makeLap({ avgTireWear: 1.5 })]);
      expect(result.currentWear).toBe(1);

      const result2 = analyzer.analyzeTireDegradation([makeLap({ avgTireWear: -0.5 })]);
      expect(result2.currentWear).toBe(0);
    });

    it('handles undefined avgTireWear', () => {
      const result = analyzer.analyzeTireDegradation([makeLap({ avgTireWear: undefined })]);
      expect(result.currentWear).toBe(0);
    });

    it('uses default temp when avgTireTemp is missing', () => {
      const result = analyzer.analyzeTireDegradation([makeLap({ avgTireTemp: undefined })]);
      expect(result.currentTemp).toBe(80);
    });
  });

  describe('shouldChangeTires', () => {
    it('returns true for critical wear (>= 0.75)', () => {
      expect(analyzer.shouldChangeTires(0.75, 0.8)).toBe(true);
      expect(analyzer.shouldChangeTires(0.9, 0.8)).toBe(true);
    });

    it('returns true for low performance (< 0.7)', () => {
      expect(analyzer.shouldChangeTires(0.3, 0.5)).toBe(true);
    });

    it('returns false for good tires', () => {
      expect(analyzer.shouldChangeTires(0.3, 0.9)).toBe(false);
      expect(analyzer.shouldChangeTires(0.5, 0.75)).toBe(false);
    });

    it('boundary: exactly 0.7 performance does not trigger', () => {
      expect(analyzer.shouldChangeTires(0.3, 0.7)).toBe(false);
    });
  });

  describe('calculateLapTimeDelta', () => {
    it('returns 0 for 0% wear', () => {
      expect(analyzer.calculateLapTimeDelta(0, 90)).toBe(0);
    });

    it('returns positive delta for worn tires', () => {
      expect(analyzer.calculateLapTimeDelta(0.5, 90)).toBeGreaterThan(0);
    });

    it('increases linearly with wear', () => {
      const delta30 = analyzer.calculateLapTimeDelta(0.3, 90);
      const delta60 = analyzer.calculateLapTimeDelta(0.6, 90);
      expect(delta60).toBeCloseTo(delta30 * 2, 5);
    });
  });

  describe('analyzeTemperature', () => {
    it('returns cold for temp below 75', () => {
      expect(analyzer.analyzeTemperature(60).status).toBe('cold');
    });

    it('returns optimal for temp in range 75-95', () => {
      expect(analyzer.analyzeTemperature(80).status).toBe('optimal');
      expect(analyzer.analyzeTemperature(75).status).toBe('optimal');
      expect(analyzer.analyzeTemperature(95).status).toBe('optimal');
    });

    it('returns hot for temp above 95', () => {
      expect(analyzer.analyzeTemperature(100).status).toBe('hot');
    });
  });

  describe('calculateStintStrategy', () => {
    it('can finish with low wear and low degradation', () => {
      const result = analyzer.calculateStintStrategy(0.1, 0.01, 20);
      expect(result.canFinishOnCurrentTires).toBe(true);
      expect(result.recommendedPitLap).toBe(0);
    });

    it('cannot finish with high degradation', () => {
      const result = analyzer.calculateStintStrategy(0.5, 0.05, 20);
      expect(result.canFinishOnCurrentTires).toBe(false);
      expect(result.recommendedPitLap).toBeGreaterThan(0);
    });

    it('handles 0 degradation rate', () => {
      const result = analyzer.calculateStintStrategy(0.3, 0, 20);
      expect(result.canFinishOnCurrentTires).toBe(true);
    });

    it('handles wear already past 80%', () => {
      const result = analyzer.calculateStintStrategy(0.85, 0.05, 10);
      expect(result.canFinishOnCurrentTires).toBe(false);
      expect(result.recommendedPitLap).toBe(0);
    });

    it('caps expectedWearAtFinish at 1.0', () => {
      const result = analyzer.calculateStintStrategy(0.5, 0.1, 20);
      expect(result.expectedWearAtFinish).toBeLessThanOrEqual(1.0);
    });
  });
});
