import { describe, it, expect, beforeEach } from 'vitest';
import { CommentaryEngine } from '../commentary.js';
import type { TelemetrySnapshot } from '../commentary.js';

function makeTelemetry(overrides: {
  position?: number;
  lap?: number;
  lastLapTime?: number;
  flags?: string;
} = {}): TelemetrySnapshot {
  return {
    player: {
      position: overrides.position ?? 5,
      lap: overrides.lap ?? 1,
      lastLapTime: overrides.lastLapTime ?? 0,
    },
    session: {
      flags: overrides.flags ?? 'green',
    },
  };
}

describe('CommentaryEngine', () => {
  let engine: CommentaryEngine;

  beforeEach(() => {
    engine = new CommentaryEngine();
  });

  it('processTelemetry detects overtake when position improves', () => {
    // Prime the engine with initial position
    engine.processTelemetry('Max Verstappen', makeTelemetry({ position: 5 }), 100, 1);

    // Position improves from 5 → 3
    const events = engine.processTelemetry(
      'Max Verstappen',
      makeTelemetry({ position: 3 }),
      200,
      2
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('overtake');
    expect(events[0].message).toContain('Max Verstappen');
    expect(events[0].message).toContain('P3');
    expect(events[0].racerName).toBe('Max Verstappen');
  });

  it('processTelemetry detects position lost when position worsens', () => {
    // Prime with P2
    engine.processTelemetry('Lewis Hamilton', makeTelemetry({ position: 2 }), 100, 1);

    // Position drops from 2 → 4
    const events = engine.processTelemetry(
      'Lewis Hamilton',
      makeTelemetry({ position: 4 }),
      300,
      3
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('position_lost');
    expect(events[0].message).toContain('Lewis Hamilton');
    expect(events[0].message).toContain('P4');
  });

  it('processTelemetry detects new best lap', () => {
    // First call sets session best (90000 ms)
    const first = engine.processTelemetry(
      'Charles Leclerc',
      makeTelemetry({ lastLapTime: 90000 }),
      90,
      2
    );
    expect(first.some(e => e.type === 'lap_record')).toBe(true);

    // Second call with a faster lap (88500 ms) — new session best
    const second = engine.processTelemetry(
      'Max Verstappen',
      makeTelemetry({ lastLapTime: 88500 }),
      180,
      3
    );
    const lapRecord = second.find(e => e.type === 'lap_record');
    expect(lapRecord).toBeDefined();
    expect(lapRecord!.message).toContain('NEW BEST LAP');
    expect(lapRecord!.message).toContain('Max Verstappen');
  });

  it('processTelemetry returns empty array when nothing changed', () => {
    // First call sets baseline
    engine.processTelemetry('Fernando Alonso', makeTelemetry({ position: 4, lastLapTime: 0 }), 0, 1);

    // Same state, same position, no new lap time, same flags
    const events = engine.processTelemetry(
      'Fernando Alonso',
      makeTelemetry({ position: 4, lastLapTime: 0 }),
      100,
      2
    );

    expect(events).toHaveLength(0);
  });

  it('getEvents returns events in chronological order', () => {
    // Prime positions first
    engine.processTelemetry('Carlos Sainz', makeTelemetry({ position: 6 }), 0, 1);
    engine.processTelemetry('George Russell', makeTelemetry({ position: 8 }), 0, 1);

    engine.processTelemetry('Carlos Sainz', makeTelemetry({ position: 4 }), 100, 2);
    engine.processTelemetry('George Russell', makeTelemetry({ position: 6 }), 200, 3);

    const events = engine.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < events.length; i++) {
      expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i - 1].timestamp);
    }
  });

  it('getEvents filters by afterTimestamp', () => {
    // Prime positions
    engine.processTelemetry('Lando Norris', makeTelemetry({ position: 3 }), 0, 1);

    const before = Date.now();

    // Generate an event
    engine.processTelemetry('Lando Norris', makeTelemetry({ position: 1 }), 100, 2);

    const all = engine.getEvents();
    const filtered = engine.getEvents(undefined, before);

    // filtered should only include events generated after 'before'
    expect(filtered.every(e => e.timestamp > before)).toBe(true);
    expect(filtered.length).toBeLessThanOrEqual(all.length);
  });

  it('getEvents respects limit parameter', () => {
    // Prime positions for two drivers
    engine.processTelemetry('Driver A', makeTelemetry({ position: 5 }), 0, 1);
    engine.processTelemetry('Driver B', makeTelemetry({ position: 7 }), 0, 1);
    engine.processTelemetry('Driver C', makeTelemetry({ position: 9 }), 0, 1);

    // Generate multiple events
    engine.processTelemetry('Driver A', makeTelemetry({ position: 3 }), 100, 2);
    engine.processTelemetry('Driver B', makeTelemetry({ position: 5 }), 200, 3);
    engine.processTelemetry('Driver C', makeTelemetry({ position: 7 }), 300, 4);

    const limited = engine.getEvents(2);
    expect(limited.length).toBeLessThanOrEqual(2);
  });

  it('event buffer caps at 200 events (ring buffer)', () => {
    // Seed a position so position-change events can fire
    engine.processTelemetry('Ring Buffer Driver', makeTelemetry({ position: 200 }), 0, 1);

    // Generate > 200 events by toggling position back and forth
    for (let i = 0; i < 210; i++) {
      const pos = i % 2 === 0 ? 100 : 101;
      engine.processTelemetry('Ring Buffer Driver', makeTelemetry({ position: pos }), i * 10, i + 1);
    }

    const all = engine.getEvents();
    expect(all.length).toBeLessThanOrEqual(200);
  });
});
