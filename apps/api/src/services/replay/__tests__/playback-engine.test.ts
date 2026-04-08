import { describe, it, expect, vi, afterEach } from 'vitest';
import { PlaybackEngine } from '../playback-engine.js';
import type { StoredFrame, ProcessedTelemetry } from '@iracing-race-engineer/shared';

function makeStoredFrame(seq: number, sessionTime: number): StoredFrame {
  return {
    seq,
    lap: Math.floor(seq / 10) + 1,
    lapDistPct: (seq % 10) / 10,
    telemetry: {
      timestamp: Date.now(),
      sessionTime,
      player: { speed: 200, rpm: 7000, gear: 4, throttle: 0.8, brake: 0, lap: 1, lapDistPct: 0, currentLapTime: 0, lastLapTime: 0, bestLapTime: 0, position: 1, classPosition: 1, incidents: 0, driverName: 'Test', carName: 'GT3', oilTemp: 0, oilPress: 0, waterTemp: 0, waterLevel: 0, voltage: 0, engineWarnings: 0, manifoldPress: 0, push2PassStatus: false, push2PassCount: 0, dcBrakePct: 0, clutch: 1 },
      fuel: { level: 50, levelPct: 0.42, usePerHour: 30, lapsRemaining: 20, tankCapacity: 120 },
      tires: { lf: { tempL: 90, tempM: 95, tempR: 92, wearL: 0.9, wearM: 0.88, wearR: 0.91, avgTemp: 92, avgWear: 0.9 }, rf: { tempL: 91, tempM: 96, tempR: 93, wearL: 0.89, wearM: 0.87, wearR: 0.9, avgTemp: 93, avgWear: 0.89 }, lr: { tempL: 88, tempM: 92, tempR: 90, wearL: 0.92, wearM: 0.9, wearR: 0.93, avgTemp: 90, avgWear: 0.92 }, rr: { tempL: 89, tempM: 93, tempR: 91, wearL: 0.91, wearM: 0.89, wearR: 0.92, avgTemp: 91, avgWear: 0.91 } },
      track: { name: 'Spa', temperature: 30, airTemp: 25, windSpeed: 5, windDirection: 180, humidity: 60 },
      session: { state: 4, flags: 0, timeRemaining: 3600, lapsRemaining: 20 },
    } as ProcessedTelemetry,
  };
}

describe('PlaybackEngine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with frames', () => {
    const frames = [makeStoredFrame(0, 0), makeStoredFrame(1, 1)];
    const engine = new PlaybackEngine(frames);

    expect(engine.getState().totalFrames).toBe(2);
    expect(engine.getState().cursor).toBe(0);
    expect(engine.getState().playing).toBe(false);
  });

  it('seeks to a specific frame', () => {
    const frames = Array.from({ length: 10 }, (_, i) => makeStoredFrame(i, i));
    const engine = new PlaybackEngine(frames);

    engine.seek(5);
    expect(engine.getState().cursor).toBe(5);
  });

  it('clamps seek to valid range', () => {
    const frames = Array.from({ length: 5 }, (_, i) => makeStoredFrame(i, i));
    const engine = new PlaybackEngine(frames);

    engine.seek(100);
    expect(engine.getState().cursor).toBe(4);

    engine.seek(-5);
    expect(engine.getState().cursor).toBe(0);
  });

  it('returns current frame', () => {
    const frames = Array.from({ length: 5 }, (_, i) => makeStoredFrame(i, i * 10));
    const engine = new PlaybackEngine(frames);

    engine.seek(2);
    const frame = engine.getCurrentFrame();
    expect(frame).not.toBeNull();
    expect(frame!.seq).toBe(2);
  });

  it('tracks playback speed', () => {
    const frames = [makeStoredFrame(0, 0)];
    const engine = new PlaybackEngine(frames);

    engine.setSpeed(2);
    expect(engine.getState().speed).toBe(2);

    engine.setSpeed(0.5);
    expect(engine.getState().speed).toBe(0.5);
  });

  it('advances cursor on step', () => {
    const frames = Array.from({ length: 10 }, (_, i) => makeStoredFrame(i, i));
    const engine = new PlaybackEngine(frames);

    engine.step();
    expect(engine.getState().cursor).toBe(1);

    engine.step();
    expect(engine.getState().cursor).toBe(2);
  });

  it('stops at end of frames', () => {
    const frames = Array.from({ length: 3 }, (_, i) => makeStoredFrame(i, i));
    const engine = new PlaybackEngine(frames);

    engine.step();
    engine.step();
    engine.step(); // at end
    expect(engine.getState().cursor).toBe(2);
    expect(engine.getState().playing).toBe(false);
  });
});
