import { describe, it, expect } from 'vitest';
import { detectSectors, calculateSplits, compareSplits } from '../sector-analyzer.js';
import type { StoredFrame, ProcessedTelemetry } from '@iracing-race-engineer/shared';

function makeFrame(dist: number, speed: number, sessionTime: number): StoredFrame {
  return {
    seq: 0,
    lap: 1,
    lapDistPct: dist,
    telemetry: {
      sessionTime,
      player: {
        speed,
        rpm: 6000,
        gear: 4,
        throttle: 0.8,
        brake: 0,
        lap: 1,
        lapDistPct: dist,
        currentLapTime: sessionTime,
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

/** Build N evenly-spaced frames with constant speed 150 km/h */
function makeConstantLap(count: number): StoredFrame[] {
  return Array.from({ length: count }, (_, i) => {
    const dist = i / (count - 1);
    return makeFrame(dist, 150, dist * 90);
  });
}

describe('detectSectors', () => {
  it('returns 3 equal sectors when no braking zones found (constant speed)', () => {
    const frames = makeConstantLap(30);
    const sectors = detectSectors(frames);
    expect(sectors).toHaveLength(3);
    expect(sectors[0].startDist).toBeCloseTo(0);
    expect(sectors[0].endDist).toBeCloseTo(1 / 3);
    expect(sectors[1].startDist).toBeCloseTo(1 / 3);
    expect(sectors[1].endDist).toBeCloseTo(2 / 3);
    expect(sectors[2].startDist).toBeCloseTo(2 / 3);
    expect(sectors[2].endDist).toBeCloseTo(1);
  });

  it('finds braking zones from speed drops', () => {
    // Introduce a clear speed drop > 30 km/h around dist 0.3
    const frames = Array.from({ length: 50 }, (_, i) => {
      const dist = i / 49;
      // Speed drops sharply from 150 to 100 around dist 0.3
      const speed = dist >= 0.28 && dist <= 0.32 ? 100 : 150;
      return makeFrame(dist, speed, dist * 90);
    });
    const sectors = detectSectors(frames);
    // Should detect a braking zone, producing more than 3 sectors (or exactly the boundaries)
    expect(sectors.length).toBeGreaterThan(1);
    // At least one boundary should be near 0.28
    const nearBrake = sectors.some(
      (s) => Math.abs(s.startDist - 0.28) < 0.05 || Math.abs(s.endDist - 0.28) < 0.05,
    );
    expect(nearBrake).toBe(true);
  });

  it('merges boundaries that are too close together', () => {
    // Two speed drops very close together (< 5% apart) should merge into one boundary
    const frames = Array.from({ length: 100 }, (_, i) => {
      const dist = i / 99;
      // Two drops at 0.30 and 0.33 — only 3% apart, should merge
      const inDrop1 = dist >= 0.29 && dist <= 0.31;
      const inDrop2 = dist >= 0.32 && dist <= 0.34;
      const speed = inDrop1 || inDrop2 ? 100 : 150;
      return makeFrame(dist, speed, dist * 90);
    });
    const sectorsRaw = detectSectors(frames);

    // Build a version with two clearly separate drops (> 5% apart) for comparison
    const framesWide = Array.from({ length: 100 }, (_, i) => {
      const dist = i / 99;
      const inDrop1 = dist >= 0.20 && dist <= 0.22;
      const inDrop2 = dist >= 0.60 && dist <= 0.62;
      const speed = inDrop1 || inDrop2 ? 100 : 150;
      return makeFrame(dist, speed, dist * 90);
    });
    const sectorsWide = detectSectors(framesWide);

    // Close drops should produce fewer sectors than wide-apart drops
    expect(sectorsRaw.length).toBeLessThan(sectorsWide.length);
  });

  it('returns empty array for fewer than 10 frames', () => {
    const frames = Array.from({ length: 5 }, (_, i) =>
      makeFrame(i / 4, 150, i * 10),
    );
    expect(detectSectors(frames)).toEqual([]);
  });
});

describe('calculateSplits', () => {
  it('returns correct entry, min, and exit speeds', () => {
    // Sector covers dist 0..0.5, speeds: entry 150, dips to 100, exits at 130
    const frames: StoredFrame[] = [
      makeFrame(0.0, 150, 0),
      makeFrame(0.1, 140, 5),
      makeFrame(0.2, 100, 12), // min speed
      makeFrame(0.3, 120, 18),
      makeFrame(0.4, 130, 24),
      makeFrame(0.5, 130, 30),
    ];
    const sectors = [{ index: 0, startDist: 0, endDist: 0.5, type: 'braking' as const }];
    const splits = calculateSplits(frames, sectors);
    expect(splits).toHaveLength(1);
    expect(splits[0].entrySpeed).toBe(150);
    expect(splits[0].minSpeed).toBe(100);
    expect(splits[0].exitSpeed).toBe(130);
  });

  it('returns correct sector times', () => {
    const frames: StoredFrame[] = [
      makeFrame(0.0, 150, 10),
      makeFrame(0.25, 140, 20),
      makeFrame(0.5, 130, 35),
      makeFrame(0.75, 140, 55),
      makeFrame(1.0, 150, 80),
    ];
    const sectors = [
      { index: 0, startDist: 0, endDist: 0.5, type: 'straight' as const },
      { index: 1, startDist: 0.5, endDist: 1.0, type: 'straight' as const },
    ];
    const splits = calculateSplits(frames, sectors);
    expect(splits[0].time).toBeCloseTo(35 - 10); // 25s
    expect(splits[1].time).toBeCloseTo(80 - 35); // 45s
  });
});

describe('compareSplits', () => {
  it('computes deltas correctly', () => {
    const current: import('../sector-analyzer.js').SectorSplit[] = [
      { sector: 0, time: 30, entrySpeed: 150, minSpeed: 100, exitSpeed: 130 },
      { sector: 1, time: 40, entrySpeed: 130, minSpeed: 90, exitSpeed: 140 },
    ];
    const reference: import('../sector-analyzer.js').SectorSplit[] = [
      { sector: 0, time: 28, entrySpeed: 150, minSpeed: 105, exitSpeed: 135 },
      { sector: 1, time: 38, entrySpeed: 135, minSpeed: 95, exitSpeed: 145 },
    ];
    const deltas = compareSplits(current, reference);
    expect(deltas[0].delta).toBeCloseTo(2);  // 30 - 28
    expect(deltas[1].delta).toBeCloseTo(2);  // 40 - 38
  });

  it('marks the weakest sector (largest positive delta)', () => {
    const current: import('../sector-analyzer.js').SectorSplit[] = [
      { sector: 0, time: 30, entrySpeed: 150, minSpeed: 100, exitSpeed: 130 },
      { sector: 1, time: 45, entrySpeed: 130, minSpeed: 90, exitSpeed: 140 },
      { sector: 2, time: 25, entrySpeed: 140, minSpeed: 110, exitSpeed: 150 },
    ];
    const reference: import('../sector-analyzer.js').SectorSplit[] = [
      { sector: 0, time: 28, entrySpeed: 150, minSpeed: 105, exitSpeed: 135 },
      { sector: 1, time: 38, entrySpeed: 135, minSpeed: 95, exitSpeed: 145 }, // +7 delta — weakest
      { sector: 2, time: 26, entrySpeed: 140, minSpeed: 112, exitSpeed: 152 },
    ];
    const deltas = compareSplits(current, reference);
    const weakest = deltas.filter((d) => d.isWeakest);
    expect(weakest).toHaveLength(1);
    expect(weakest[0].sector).toBe(1);
  });
});
