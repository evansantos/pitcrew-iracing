import { describe, it, expect } from 'vitest';
import { buildReferenceLine, compareToReference, compareLapToReference } from '../racing-line.js';
import type { StoredFrame, ProcessedTelemetry } from '@iracing-race-engineer/shared';

function makeFrame(dist: number, speed: number): StoredFrame {
  return {
    seq: 0,
    lap: 1,
    lapDistPct: dist,
    telemetry: {
      sessionTime: dist * 90,
      player: {
        speed,
        rpm: 6000,
        gear: 4,
        throttle: speed > 100 ? 0.8 : 0.3,
        brake: speed < 80 ? 0.5 : 0,
        lap: 1,
        lapDistPct: dist,
        currentLapTime: dist * 90,
        lastLapTime: 90,
        bestLapTime: 89,
        position: 1,
        classPosition: 1,
      },
      fuel: { level: 40, levelPct: 50, usePerHour: 3, lapsRemaining: 20, tankCapacity: 80 },
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

function makeLap(count: number, speedFn: (dist: number) => number): StoredFrame[] {
  return Array.from({ length: count }, (_, i) => {
    const dist = i / count;
    return makeFrame(dist, speedFn(dist));
  });
}

describe('racing-line', () => {
  describe('buildReferenceLine', () => {
    it('returns empty for empty frames', () => {
      expect(buildReferenceLine([])).toEqual([]);
    });

    it('samples 100 points from lap frames', () => {
      const frames = makeLap(200, () => 150);
      const ref = buildReferenceLine(frames);
      expect(ref.length).toBe(100);
    });

    it('captures speed at each sample point', () => {
      const frames = makeLap(200, (dist) => 100 + dist * 100); // 100-200 km/h
      const ref = buildReferenceLine(frames);
      // First point should be ~100, last ~199
      expect(ref[0].speed).toBeLessThan(110);
      expect(ref[99].speed).toBeGreaterThan(180);
    });
  });

  describe('compareToReference', () => {
    it('returns null for empty reference', () => {
      expect(compareToReference(0.5, 150, [])).toBeNull();
    });

    it('returns green when speed is within 5 km/h of reference', () => {
      const ref = [{ dist: 0.5, speed: 150, throttle: 0.8, brake: 0 }];
      const result = compareToReference(0.5, 148, ref);
      expect(result?.color).toBe('green');
    });

    it('returns yellow when 5-15 km/h slower', () => {
      const ref = [{ dist: 0.5, speed: 150, throttle: 0.8, brake: 0 }];
      const result = compareToReference(0.5, 140, ref);
      expect(result?.color).toBe('yellow');
    });

    it('returns red when >15 km/h slower', () => {
      const ref = [{ dist: 0.5, speed: 150, throttle: 0.8, brake: 0 }];
      const result = compareToReference(0.5, 130, ref);
      expect(result?.color).toBe('red');
    });

    it('returns blue when >5 km/h faster', () => {
      const ref = [{ dist: 0.5, speed: 150, throttle: 0.8, brake: 0 }];
      const result = compareToReference(0.5, 160, ref);
      expect(result?.color).toBe('blue');
    });
  });

  describe('compareLapToReference', () => {
    it('returns empty for empty inputs', () => {
      expect(compareLapToReference([], [])).toEqual([]);
    });

    it('returns deviation for each reference point', () => {
      const refFrames = makeLap(200, () => 150);
      const ref = buildReferenceLine(refFrames);
      const currentFrames = makeLap(200, () => 140); // 10 km/h slower
      const deviations = compareLapToReference(currentFrames, ref);
      expect(deviations.length).toBe(100);
      expect(deviations.every(d => d.color === 'yellow')).toBe(true);
    });
  });
});
