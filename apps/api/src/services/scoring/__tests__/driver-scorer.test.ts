import { describe, it, expect } from 'vitest';
import {
  calculateConsistency,
  calculateRacecraft,
  calculateImprovement,
  calculateComposite,
} from '../driver-scorer.js';

describe('driver-scorer', () => {
  describe('calculateConsistency', () => {
    it('returns score 0 for fewer than 3 laps', () => {
      expect(calculateConsistency([90, 91]).score).toBe(0);
    });

    it('returns high score for very consistent lap times', () => {
      const times = [90.1, 90.2, 90.0, 90.15, 90.1, 90.05, 90.2, 90.1];
      const result = calculateConsistency(times);
      expect(result.score).toBeGreaterThan(80);
      expect(result.breakdown.stdDev).toBeLessThan(0.5);
    });

    it('returns low score for inconsistent lap times', () => {
      const times = [90, 95, 88, 97, 85, 92, 99, 86];
      const result = calculateConsistency(times);
      expect(result.score).toBeLessThan(40);
    });

    it('excludes outlier laps (pit/incidents)', () => {
      const times = [90, 90.1, 90.2, 90.0, 150, 90.15]; // 150s is pit lap
      const result = calculateConsistency(times);
      expect(result.breakdown.validLaps).toBe(5); // excludes the 150s lap
      expect(result.score).toBeGreaterThan(70);
    });

    it('calculates pctWithin1Percent correctly', () => {
      const times = [90.0, 90.5, 90.8, 91.5]; // best=90, 1%=90.9
      const result = calculateConsistency(times);
      // 90.0, 90.5, 90.8 are within 1% of 90; 91.5 is not
      expect(result.breakdown.pctWithin1Percent).toBe(75);
    });
  });

  describe('calculateRacecraft', () => {
    it('returns score 0 for fewer than 2 position entries', () => {
      expect(calculateRacecraft([5]).score).toBe(0);
    });

    it('rewards positions gained', () => {
      const positions = [10, 8, 6, 5, 4]; // gained 6 positions
      const result = calculateRacecraft(positions);
      expect(result.score).toBeGreaterThan(50);
      expect(result.breakdown.positionsGained).toBe(6);
    });

    it('counts overtakes correctly', () => {
      const positions = [5, 4, 4, 3, 4, 3]; // overtakes on lap 2, 4, 6
      const result = calculateRacecraft(positions);
      expect(result.breakdown.overtakes).toBe(3);
    });

    it('penalizes positions lost', () => {
      const positions = [3, 5, 7, 10]; // lost 7 positions
      const result = calculateRacecraft(positions);
      expect(result.breakdown.positionsGained).toBe(-7);
    });
  });

  describe('calculateImprovement', () => {
    it('returns score 0 for invalid times', () => {
      expect(calculateImprovement(0, 0).score).toBe(0);
    });

    it('returns neutral score with no historical data', () => {
      const result = calculateImprovement(90, 91);
      expect(result.score).toBeGreaterThan(40);
      expect(result.score).toBeLessThan(80);
    });

    it('rewards beating historical bests', () => {
      const result = calculateImprovement(89, 90, [91, 90.5, 90]);
      expect(result.score).toBeGreaterThan(70);
      expect(result.breakdown.bestVsHistorical).toBeGreaterThan(50);
    });

    it('penalizes being slower than historical', () => {
      const result = calculateImprovement(92, 93, [90, 89, 90]);
      expect(result.breakdown.bestVsHistorical).toBeLessThan(50);
    });

    it('rewards tight session spread', () => {
      const result = calculateImprovement(90, 90.3); // 0.3s spread
      expect(result.breakdown.bestVsAverage).toBe(100);
    });
  });

  describe('calculateComposite', () => {
    it('computes weighted average: 40% consistency, 30% racecraft, 30% improvement', () => {
      const c = { score: 100, breakdown: { stdDev: 0.1, pctWithin1Percent: 100, validLaps: 10 } };
      const r = { score: 50, breakdown: { positionsGained: 2, overtakes: 1, gapConsistency: 50, cleanLaps: 8 } };
      const i = { score: 80, breakdown: { bestVsHistorical: 80, bestVsAverage: 80, lapsToTarget: 3 } };

      const result = calculateComposite(c, r, i);
      // 100*0.4 + 50*0.3 + 80*0.3 = 40 + 15 + 24 = 79
      expect(result.overall).toBe(79);
    });

    it('clamps score to 0-100', () => {
      const zero = { score: 0, breakdown: { stdDev: 5, pctWithin1Percent: 0, validLaps: 3 } };
      const r = { score: 0, breakdown: { positionsGained: -10, overtakes: 0, gapConsistency: 0, cleanLaps: 0 } };
      const i = { score: 0, breakdown: { bestVsHistorical: 0, bestVsAverage: 0, lapsToTarget: 0 } };
      expect(calculateComposite(zero, r, i).overall).toBe(0);
    });
  });
});
