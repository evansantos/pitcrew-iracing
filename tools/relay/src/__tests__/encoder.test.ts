import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSignificantChange,
  diffObjects,
  encode,
  DeltaEncoder,
  DEFAULT_THRESHOLD,
} from '../encoder.js';
import type { TelemetryFrame } from '../types.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTelemetry(overrides: Partial<TelemetryFrame> = {}): TelemetryFrame {
  return {
    timestamp: 1000,
    sessionTime: 100,
    player: {
      speed: 120,
      rpm: 5500,
      gear: 4,
      throttle: 0.7,
      brake: 0,
      lap: 1,
      lapDistPct: 0.5,
      currentLapTime: 45,
      lastLapTime: 92,
      bestLapTime: 91.8,
      position: 3,
      classPosition: 2,
    },
    fuel: {
      level: 40,
      levelPct: 50,
      usePerHour: 3.2,
      lapsRemaining: 20,
    },
    tires: {
      lf: { temp: 85, wear: 0.1, pressure: 179 },
      rf: { temp: 86, wear: 0.12, pressure: 179 },
      lr: { temp: 83, wear: 0.08, pressure: 165 },
      rr: { temp: 84, wear: 0.09, pressure: 165 },
    },
    track: {
      temperature: 32,
      airTemp: 28,
      windSpeed: 2.5,
      windDirection: 1.2,
      humidity: 55,
    },
    session: {
      state: 4,
      flags: 0,
      timeRemaining: 3500,
      lapsRemaining: 29,
    },
    ...overrides,
  };
}

// ─── isSignificantChange ──────────────────────────────────────────────────────

describe('isSignificantChange', () => {
  it('returns false when values are identical', () => {
    expect(isSignificantChange(100, 100)).toBe(false);
  });

  it('returns false when change is below threshold (relative)', () => {
    // 0.05% change — below 0.1%
    expect(isSignificantChange(1000, 1000.5, DEFAULT_THRESHOLD)).toBe(false);
  });

  it('returns true when change exceeds threshold (relative)', () => {
    // 1% change — above 0.1%
    expect(isSignificantChange(1000, 1010, DEFAULT_THRESHOLD)).toBe(true);
  });

  it('handles zero previous value with absolute comparison', () => {
    expect(isSignificantChange(0, 0.5, DEFAULT_THRESHOLD)).toBe(true);
  });

  it('returns false when next is also zero', () => {
    expect(isSignificantChange(0, 0, DEFAULT_THRESHOLD)).toBe(false);
  });

  it('handles negative values correctly', () => {
    expect(isSignificantChange(-100, -110, DEFAULT_THRESHOLD)).toBe(true);
    expect(isSignificantChange(-100, -100.05, DEFAULT_THRESHOLD)).toBe(false);
  });

  it('respects a custom threshold', () => {
    // 5% threshold
    expect(isSignificantChange(100, 104, 0.05)).toBe(false);
    expect(isSignificantChange(100, 106, 0.05)).toBe(true);
  });
});

// ─── diffObjects ──────────────────────────────────────────────────────────────

describe('diffObjects', () => {
  it('returns undefined when nothing changed', () => {
    const obj = { a: 1, b: 2 };
    expect(diffObjects(obj, obj, DEFAULT_THRESHOLD)).toBeUndefined();
  });

  it('returns only changed numeric fields', () => {
    const prev = { a: 100, b: 200 };
    const next = { a: 101, b: 200 };
    const delta = diffObjects(prev, next, DEFAULT_THRESHOLD);
    expect(delta).toEqual({ a: 101 });
    expect(delta).not.toHaveProperty('b');
  });

  it('always includes changed non-numeric values', () => {
    const prev = { a: 'hello', b: 1 };
    const next = { a: 'world', b: 1 };
    expect(diffObjects(prev, next, DEFAULT_THRESHOLD)).toEqual({ a: 'world' });
  });

  it('handles nested objects recursively', () => {
    const prev = { nested: { x: 1, y: 2 } };
    const next = { nested: { x: 1, y: 20 } }; // y changed significantly
    const delta = diffObjects(prev, next, DEFAULT_THRESHOLD);
    expect(delta).toEqual({ nested: { y: 20 } });
  });

  it('returns undefined for nested object when sub-fields did not change', () => {
    const prev = { nested: { x: 100, y: 200 } };
    const next = { nested: { x: 100, y: 200 } };
    expect(diffObjects(prev, next, DEFAULT_THRESHOLD)).toBeUndefined();
  });
});

// ─── encode ───────────────────────────────────────────────────────────────────

describe('encode', () => {
  it('returns full frame when prev is null', () => {
    const frame = makeTelemetry({ timestamp: 9999 });
    const delta = encode(null, frame);
    expect(delta.timestamp).toBe(9999);
    expect(delta.player).toBeDefined();
    expect(delta.fuel).toBeDefined();
    expect(delta.tires).toBeDefined();
  });

  it('always includes timestamp', () => {
    const prev = makeTelemetry({ timestamp: 1000 });
    const next = makeTelemetry({ timestamp: 2000 });
    // speed unchanged — only timestamp should appear
    const delta = encode(prev, next);
    expect(delta.timestamp).toBe(2000);
  });

  it('omits unchanged fields', () => {
    const prev = makeTelemetry({ timestamp: 1000 });
    const next = makeTelemetry({ timestamp: 2000 }); // identical except timestamp
    const delta = encode(prev, next);
    // player fields shouldn't be present if nothing changed
    expect(delta.player).toBeUndefined();
    expect(delta.fuel).toBeUndefined();
  });

  it('includes only changed nested fields', () => {
    const prev = makeTelemetry({ timestamp: 1000 });
    const next = makeTelemetry({
      timestamp: 2000,
      player: { ...makeTelemetry().player, speed: 200 }, // big change
    });
    const delta = encode(prev, next);
    expect(delta.player?.speed).toBe(200);
    // other player fields unchanged — should be absent
    expect(delta.player?.rpm).toBeUndefined();
  });

  it('fuel changes are captured', () => {
    const prev = makeTelemetry({ timestamp: 1000 });
    const next = makeTelemetry({
      timestamp: 2000,
      fuel: { ...makeTelemetry().fuel, level: 35 }, // dropped from 40 → 35
    });
    const delta = encode(prev, next);
    expect(delta.fuel?.level).toBe(35);
  });
});

// ─── DeltaEncoder ────────────────────────────────────────────────────────────

describe('DeltaEncoder', () => {
  let enc: DeltaEncoder;

  beforeEach(() => {
    enc = new DeltaEncoder();
  });

  it('starts with null last frame', () => {
    expect(enc.last).toBeNull();
  });

  it('first call returns full frame', () => {
    const frame = makeTelemetry();
    const delta = enc.next(frame);
    expect(delta.player).toBeDefined();
    expect(delta.fuel).toBeDefined();
  });

  it('second call with same data returns only timestamp', () => {
    const frame = makeTelemetry({ timestamp: 1000 });
    enc.next(frame);
    const same = makeTelemetry({ timestamp: 2000 });
    const delta = enc.next(same);
    expect(delta.timestamp).toBe(2000);
    expect(delta.player).toBeUndefined();
  });

  it('updates last after each call', () => {
    const frame = makeTelemetry({ timestamp: 1000 });
    enc.next(frame);
    expect(enc.last?.timestamp).toBe(1000);

    const frame2 = makeTelemetry({ timestamp: 2000 });
    enc.next(frame2);
    expect(enc.last?.timestamp).toBe(2000);
  });

  it('reset causes next call to return full frame again', () => {
    const frame = makeTelemetry({ timestamp: 1000 });
    enc.next(frame);

    enc.reset();
    expect(enc.last).toBeNull();

    const frame2 = makeTelemetry({ timestamp: 2000 });
    const delta = enc.next(frame2);
    expect(delta.player).toBeDefined();
  });

  it('respects custom threshold', () => {
    // With 50% threshold, a 1% change should be ignored
    const highThreshEnc = new DeltaEncoder(0.5);
    const frame1 = makeTelemetry({ timestamp: 1000 });
    highThreshEnc.next(frame1);

    const frame2 = makeTelemetry({
      timestamp: 2000,
      player: { ...frame1.player, speed: frame1.player.speed * 1.01 }, // 1% change
    });
    const delta = highThreshEnc.next(frame2);
    expect(delta.player).toBeUndefined();
  });

  it('accumulates bandwidth savings over many frames', () => {
    const frame = makeTelemetry({ timestamp: 1000 });
    enc.next(frame); // full first frame

    let totalDeltaKeys = 0;
    for (let i = 1; i <= 10; i++) {
      const same = makeTelemetry({ timestamp: 1000 + i * 16 });
      const delta = enc.next(same);
      // Only timestamp should be present
      totalDeltaKeys += Object.keys(delta).length;
    }

    // Each delta should have just timestamp (1 key)
    expect(totalDeltaKeys).toBe(10);
  });
});
