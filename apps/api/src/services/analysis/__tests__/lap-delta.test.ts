import { describe, it, expect } from 'vitest';
import { calculateLapDelta, interpolateToGrid } from '../lap-delta.js';

describe('lap-delta', () => {
  describe('interpolateToGrid', () => {
    it('interpolates data points to a uniform grid', () => {
      const points = [
        { dist: 0.0, time: 0.0 },
        { dist: 0.5, time: 45.0 },
        { dist: 1.0, time: 90.0 },
      ];

      const grid = interpolateToGrid(points, 5);
      expect(grid).toHaveLength(5);
      expect(grid[0].time).toBeCloseTo(0.0);
      expect(grid[2].time).toBeCloseTo(45.0);
      expect(grid[4].time).toBeCloseTo(90.0);
    });

    it('handles single data point', () => {
      const points = [{ dist: 0.5, time: 45.0 }];
      const grid = interpolateToGrid(points, 3);
      expect(grid).toHaveLength(3);
    });
  });

  describe('calculateLapDelta', () => {
    it('returns zero delta for identical laps', () => {
      const lap = [
        { dist: 0.0, time: 0.0 },
        { dist: 0.5, time: 45.0 },
        { dist: 1.0, time: 90.0 },
      ];

      const delta = calculateLapDelta(lap, lap);
      for (const point of delta) {
        expect(Math.abs(point.delta)).toBeLessThan(0.01);
      }
    });

    it('returns positive delta when lap1 is slower', () => {
      const lap1 = [
        { dist: 0.0, time: 0.0 },
        { dist: 0.5, time: 50.0 },
        { dist: 1.0, time: 95.0 },
      ];
      const lap2 = [
        { dist: 0.0, time: 0.0 },
        { dist: 0.5, time: 45.0 },
        { dist: 1.0, time: 90.0 },
      ];

      const delta = calculateLapDelta(lap1, lap2);
      // At the end, lap1 is 5s slower
      const lastPoint = delta[delta.length - 1];
      expect(lastPoint.delta).toBeGreaterThan(0);
      expect(lastPoint.delta).toBeCloseTo(5.0, 0);
    });

    it('returns negative delta when lap1 is faster', () => {
      const lap1 = [
        { dist: 0.0, time: 0.0 },
        { dist: 0.5, time: 40.0 },
        { dist: 1.0, time: 85.0 },
      ];
      const lap2 = [
        { dist: 0.0, time: 0.0 },
        { dist: 0.5, time: 45.0 },
        { dist: 1.0, time: 90.0 },
      ];

      const delta = calculateLapDelta(lap1, lap2);
      const lastPoint = delta[delta.length - 1];
      expect(lastPoint.delta).toBeLessThan(0);
    });

    it('returns consistent grid length', () => {
      const lap1 = [
        { dist: 0.0, time: 0.0 },
        { dist: 0.25, time: 22.0 },
        { dist: 0.75, time: 68.0 },
        { dist: 1.0, time: 90.0 },
      ];
      const lap2 = [
        { dist: 0.0, time: 0.0 },
        { dist: 0.5, time: 44.0 },
        { dist: 1.0, time: 88.0 },
      ];

      const delta = calculateLapDelta(lap1, lap2, 100);
      expect(delta).toHaveLength(100);
    });
  });
});
