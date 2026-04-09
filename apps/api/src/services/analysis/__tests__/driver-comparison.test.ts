import { describe, it, expect } from 'vitest';
import { summarizeLap, compareLaps, compareDriverSessions } from '../driver-comparison.js';
import type { StoredFrame, ProcessedTelemetry } from '@iracing-race-engineer/shared';

function makeFrame(
  dist: number,
  speed: number,
  throttle: number,
  brake: number,
  fuelLevel: number,
  sessionTime: number,
  lap: number,
): StoredFrame {
  return {
    seq: 0,
    lap,
    lapDistPct: dist,
    telemetry: {
      sessionTime,
      player: {
        speed,
        throttle,
        brake,
        rpm: 6000,
        gear: 4,
        lap,
        lapDistPct: dist,
        currentLapTime: sessionTime,
        lastLapTime: 90,
        bestLapTime: 89,
        position: 1,
        classPosition: 1,
      },
      fuel: { level: fuelLevel, levelPct: fuelLevel / 80, usePerHour: 3, lapsRemaining: 20, tankCapacity: 80 },
      tires: {
        lf: { tempL: 80, tempM: 85, tempR: 80, wearL: 0.9, wearM: 0.9, wearR: 0.9, avgTemp: 82, avgWear: 0.9 },
        rf: { tempL: 80, tempM: 85, tempR: 80, wearL: 0.9, wearM: 0.9, wearR: 0.9, avgTemp: 82, avgWear: 0.9 },
        lr: { tempL: 80, tempM: 85, tempR: 80, wearL: 0.9, wearM: 0.9, wearR: 0.9, avgTemp: 82, avgWear: 0.9 },
        rr: { tempL: 80, tempM: 85, tempR: 80, wearL: 0.9, wearM: 0.9, wearR: 0.9, avgTemp: 82, avgWear: 0.9 },
      },
      track: { name: 'Monza', temperature: 30, airTemp: 25, windSpeed: 2, windDirection: 1, humidity: 50 },
      session: { state: 4, flags: 0, timeRemaining: 3600, lapsRemaining: 30 },
    } as ProcessedTelemetry,
  };
}

describe('driver-comparison', () => {
  describe('summarizeLap', () => {
    it('calculates correct lap time', () => {
      const frames = [
        makeFrame(0, 150, 0.8, 0, 40, 100, 1),
        makeFrame(0.5, 160, 0.9, 0, 39, 145, 1),
        makeFrame(1, 155, 0.85, 0, 38.5, 190, 1),
      ];
      const summary = summarizeLap('Driver1', frames);
      expect(summary.lapTime).toBeCloseTo(90); // 190 - 100
    });

    it('calculates correct avg and max speed', () => {
      const frames = [
        makeFrame(0, 100, 0.8, 0, 40, 0, 1),
        makeFrame(0.5, 200, 0.9, 0, 39, 45, 1),
        makeFrame(1, 150, 0.85, 0, 38, 90, 1),
      ];
      const summary = summarizeLap('Driver1', frames);
      expect(summary.avgSpeed).toBeCloseTo((100 + 200 + 150) / 3);
      expect(summary.maxSpeed).toBe(200);
    });

    it('calculates fuel used', () => {
      const frames = [
        makeFrame(0, 150, 0.8, 0, 40, 0, 1),
        makeFrame(0.5, 155, 0.85, 0, 39, 45, 1),
        makeFrame(1, 160, 0.9, 0, 38.2, 90, 1),
      ];
      const summary = summarizeLap('Driver1', frames);
      expect(summary.fuelUsed).toBeCloseTo(40 - 38.2);
    });

    it('handles empty frames', () => {
      const summary = summarizeLap('Driver1', []);
      expect(summary.lapTime).toBe(0);
      expect(summary.avgSpeed).toBe(0);
      expect(summary.maxSpeed).toBe(0);
      expect(summary.avgThrottle).toBe(0);
      expect(summary.avgBrake).toBe(0);
      expect(summary.fuelUsed).toBe(0);
    });
  });

  describe('compareLaps', () => {
    it('returns correct delta (driver1 lapTime - driver2 lapTime)', () => {
      const frames1 = [
        makeFrame(0, 150, 0.8, 0, 40, 0, 1),
        makeFrame(1, 150, 0.8, 0, 39, 92, 1),
      ];
      const frames2 = [
        makeFrame(0, 160, 0.9, 0, 40, 0, 1),
        makeFrame(1, 160, 0.9, 0, 39, 88, 1),
      ];
      const result = compareLaps('Alice', frames1, 'Bob', frames2);
      expect(result.delta).toBeCloseTo(92 - 88); // 4, driver1 slower
    });

    it('returns correct speed delta', () => {
      const frames1 = [
        makeFrame(0, 100, 0.8, 0, 40, 0, 1),
        makeFrame(1, 200, 0.8, 0, 39, 90, 1),
      ];
      const frames2 = [
        makeFrame(0, 120, 0.8, 0, 40, 0, 1),
        makeFrame(1, 180, 0.8, 0, 39, 88, 1),
      ];
      const result = compareLaps('Alice', frames1, 'Bob', frames2);
      const expectedD1AvgSpeed = (100 + 200) / 2;
      const expectedD2AvgSpeed = (120 + 180) / 2;
      expect(result.speedDelta).toBeCloseTo(expectedD1AvgSpeed - expectedD2AvgSpeed);
    });
  });

  describe('compareDriverSessions', () => {
    it('matches laps by lap number', () => {
      const frames1 = [
        makeFrame(0, 150, 0.8, 0, 40, 0, 1),
        makeFrame(1, 150, 0.8, 0, 39, 90, 1),
        makeFrame(0, 155, 0.85, 0, 39, 200, 2),
        makeFrame(1, 155, 0.85, 0, 38, 290, 2),
      ];
      const frames2 = [
        makeFrame(0, 160, 0.9, 0, 40, 0, 1),
        makeFrame(1, 160, 0.9, 0, 39, 88, 1),
        makeFrame(0, 158, 0.88, 0, 39, 200, 2),
        makeFrame(1, 158, 0.88, 0, 38, 289, 2),
      ];
      const results = compareDriverSessions('s1', frames1, 's2', frames2, 'Alice', 'Bob');
      expect(results).toHaveLength(2);
      expect(results[0].driver1.lap).toBe(1);
      expect(results[1].driver1.lap).toBe(2);
    });

    it('skips laps that only one driver has', () => {
      const frames1 = [
        makeFrame(0, 150, 0.8, 0, 40, 0, 1),
        makeFrame(1, 150, 0.8, 0, 39, 90, 1),
        makeFrame(0, 155, 0.85, 0, 39, 200, 3), // lap 3, driver2 has no lap 3
      ];
      const frames2 = [
        makeFrame(0, 160, 0.9, 0, 40, 0, 1),
        makeFrame(1, 160, 0.9, 0, 39, 88, 1),
        makeFrame(0, 158, 0.88, 0, 39, 200, 2), // lap 2, driver1 has no lap 2
        makeFrame(1, 158, 0.88, 0, 38, 289, 2),
      ];
      const results = compareDriverSessions('s1', frames1, 's2', frames2, 'Alice', 'Bob');
      expect(results).toHaveLength(1);
      expect(results[0].driver1.lap).toBe(1);
    });
  });
});
