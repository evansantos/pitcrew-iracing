import { describe, it, expect } from 'vitest';
import { analyzeLap } from '../lap-analyzer.js';
import type { StoredFrame, ProcessedTelemetry } from '@iracing-race-engineer/shared';

function makeFrame(dist: number, overrides: Partial<{ speed: number; throttle: number; brake: number }> = {}): StoredFrame {
  return {
    seq: 0,
    lap: 1,
    lapDistPct: dist,
    telemetry: {
      sessionTime: dist * 90,
      player: {
        speed: overrides.speed ?? 150,
        rpm: 6000,
        gear: 4,
        throttle: overrides.throttle ?? 0.8,
        brake: overrides.brake ?? 0,
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

function makeLap(count: number, overrides?: (dist: number) => Partial<{ speed: number; throttle: number; brake: number }>): StoredFrame[] {
  return Array.from({ length: count }, (_, i) => {
    const dist = i / count;
    return makeFrame(dist, overrides?.(dist) ?? {});
  });
}

describe('analyzeLap', () => {
  it('returns empty array when current lap has fewer than 10 frames', () => {
    const current = makeLap(5);
    const reference = makeLap(20);
    expect(analyzeLap(current, reference)).toEqual([]);
  });

  it('returns empty array when reference lap has fewer than 10 frames', () => {
    const current = makeLap(20);
    const reference = makeLap(5);
    expect(analyzeLap(current, reference)).toEqual([]);
  });

  it('returns empty array when laps are identical', () => {
    const lap = makeLap(30);
    expect(analyzeLap(lap, lap)).toEqual([]);
  });

  it('detects heavy braking areas', () => {
    const current = makeLap(30, (dist) => dist > 0.4 && dist < 0.6 ? { brake: 0.8 } : {});
    const reference = makeLap(30, () => ({ brake: 0 }));
    const areas = analyzeLap(current, reference);
    expect(areas.some(a => a.type === 'braking')).toBe(true);
  });

  it('detects late throttle application', () => {
    const current = makeLap(30, (dist) => dist > 0.4 && dist < 0.6 ? { throttle: 0.3 } : {});
    const reference = makeLap(30, () => ({ throttle: 0.8 }));
    const areas = analyzeLap(current, reference);
    expect(areas.some(a => a.type === 'throttle')).toBe(true);
  });

  it('detects slow cornering speed', () => {
    const current = makeLap(30, (dist) => dist > 0.2 && dist < 0.4 ? { speed: 80 } : {});
    const reference = makeLap(30, () => ({ speed: 150 }));
    const areas = analyzeLap(current, reference);
    expect(areas.some(a => a.type === 'cornering')).toBe(true);
  });

  it('limits results to maxAreas (default 3)', () => {
    const current = makeLap(30, () => ({ brake: 0.8, throttle: 0.1, speed: 50 }));
    const reference = makeLap(30, () => ({ brake: 0, throttle: 0.8, speed: 150 }));
    const areas = analyzeLap(current, reference);
    expect(areas.length).toBeLessThanOrEqual(3);
  });

  it('sorts results by severity descending', () => {
    const current = makeLap(30, () => ({ brake: 0.8, throttle: 0.1, speed: 50 }));
    const reference = makeLap(30, () => ({ brake: 0, throttle: 0.8, speed: 150 }));
    const areas = analyzeLap(current, reference);
    for (let i = 1; i < areas.length; i++) {
      expect(areas[i].severity).toBeLessThanOrEqual(areas[i - 1].severity);
    }
  });
});
