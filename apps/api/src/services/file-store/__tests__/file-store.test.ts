import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStore } from '../index.js';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ProcessedTelemetry } from '@iracing-race-engineer/shared';

function makeFrame(lap: number, lapDistPct: number, overrides: Partial<ProcessedTelemetry> = {}): ProcessedTelemetry {
  return {
    timestamp: Date.now(),
    sessionTime: lap * 90 + lapDistPct * 90,
    player: {
      driverName: 'Test Driver',
      carName: 'GT3',
      speed: 200,
      rpm: 7000,
      gear: 4,
      throttle: 0.8,
      brake: 0,
      lap,
      lapDistPct,
      currentLapTime: lapDistPct * 90,
      lastLapTime: 89.5,
      bestLapTime: 88.2,
      position: 1,
      classPosition: 1,
      incidents: 0,
      oilTemp: 110,
      oilPress: 5.2,
      waterTemp: 85,
      waterLevel: 1,
      voltage: 14.2,
      engineWarnings: 0,
      manifoldPress: 1.1,
      push2PassStatus: false,
      push2PassCount: 0,
      dcBrakePct: 0,
      clutch: 1,
    },
    fuel: { level: 50, levelPct: 0.42, usePerHour: 30, lapsRemaining: 20, tankCapacity: 120 },
    tires: {
      lf: { tempL: 90, tempM: 95, tempR: 92, wearL: 0.9, wearM: 0.88, wearR: 0.91, avgTemp: 92.3, avgWear: 0.9 },
      rf: { tempL: 91, tempM: 96, tempR: 93, wearL: 0.89, wearM: 0.87, wearR: 0.9, avgTemp: 93.3, avgWear: 0.89 },
      lr: { tempL: 88, tempM: 92, tempR: 90, wearL: 0.92, wearM: 0.9, wearR: 0.93, avgTemp: 90, avgWear: 0.92 },
      rr: { tempL: 89, tempM: 93, tempR: 91, wearL: 0.91, wearM: 0.89, wearR: 0.92, avgTemp: 91, avgWear: 0.91 },
    },
    track: { name: 'Spa', temperature: 30, airTemp: 25, windSpeed: 5, windDirection: 180, humidity: 60 },
    session: { state: 4, flags: 0, timeRemaining: 3600, lapsRemaining: 20 },
    ...overrides,
  } as ProcessedTelemetry;
}

describe('FileStore', () => {
  let store: FileStore;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filestore-test-'));
    store = new FileStore({ dataDir: tmpDir, autoFlushMs: 0 }); // autoFlush=0 disables timer, we flush manually
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('session lifecycle', () => {
    it('creates a new session and returns its ID', () => {
      const sessionId = store.startSession({
        racerName: 'Test Driver',
        trackName: 'Spa',
        carName: 'GT3',
        sessionType: 'race',
      });

      expect(sessionId).toBeTruthy();
      expect(typeof sessionId).toBe('string');
    });

    it('ends a session and finalizes the index', () => {
      const sessionId = store.startSession({
        racerName: 'Test Driver',
        trackName: 'Spa',
        carName: 'GT3',
        sessionType: 'race',
      });

      store.endSession(sessionId);

      const index = store.getSessionIndex(sessionId);
      expect(index).toBeTruthy();
      expect(index!.endTime).not.toBeNull();
    });
  });

  describe('recording frames', () => {
    it('records telemetry frames to a session', () => {
      const sessionId = store.startSession({
        racerName: 'Test Driver',
        trackName: 'Spa',
        carName: 'GT3',
        sessionType: 'race',
      });

      store.recordFrame(sessionId, makeFrame(1, 0.0));
      store.recordFrame(sessionId, makeFrame(1, 0.5));
      store.recordFrame(sessionId, makeFrame(2, 0.0));

      store.flush(sessionId);

      const index = store.getSessionIndex(sessionId);
      expect(index!.totalFrames).toBe(3);
    });

    it('tracks lap boundaries correctly', () => {
      const sessionId = store.startSession({
        racerName: 'Test Driver',
        trackName: 'Spa',
        carName: 'GT3',
        sessionType: 'race',
      });

      store.recordFrame(sessionId, makeFrame(1, 0.0));
      store.recordFrame(sessionId, makeFrame(1, 0.5));
      store.recordFrame(sessionId, makeFrame(2, 0.0));
      store.recordFrame(sessionId, makeFrame(2, 0.5));
      store.recordFrame(sessionId, makeFrame(3, 0.0));

      store.flush(sessionId);

      const index = store.getSessionIndex(sessionId);
      expect(index!.laps).toHaveLength(3);
      expect(index!.laps[0].lap).toBe(1);
      expect(index!.laps[0].startSeq).toBe(0);
      expect(index!.laps[0].endSeq).toBe(1);
      expect(index!.laps[1].lap).toBe(2);
      expect(index!.laps[1].startSeq).toBe(2);
    });
  });

  describe('querying frames', () => {
    it('retrieves all frames for a session', () => {
      const sessionId = store.startSession({
        racerName: 'Test Driver',
        trackName: 'Spa',
        carName: 'GT3',
        sessionType: 'race',
      });

      store.recordFrame(sessionId, makeFrame(1, 0.0));
      store.recordFrame(sessionId, makeFrame(1, 0.5));
      store.recordFrame(sessionId, makeFrame(2, 0.0));
      store.flush(sessionId);

      const frames = store.getFrames({ sessionId });
      expect(frames).toHaveLength(3);
      expect(frames[0].lap).toBe(1);
      expect(frames[2].lap).toBe(2);
    });

    it('filters frames by lap', () => {
      const sessionId = store.startSession({
        racerName: 'Test Driver',
        trackName: 'Spa',
        carName: 'GT3',
        sessionType: 'race',
      });

      store.recordFrame(sessionId, makeFrame(1, 0.0));
      store.recordFrame(sessionId, makeFrame(1, 0.5));
      store.recordFrame(sessionId, makeFrame(2, 0.0));
      store.recordFrame(sessionId, makeFrame(2, 0.5));
      store.flush(sessionId);

      const frames = store.getFrames({ sessionId, laps: [2] });
      expect(frames).toHaveLength(2);
      expect(frames[0].lap).toBe(2);
      expect(frames[1].lap).toBe(2);
    });

    it('downsamples frames', () => {
      const sessionId = store.startSession({
        racerName: 'Test Driver',
        trackName: 'Spa',
        carName: 'GT3',
        sessionType: 'race',
      });

      for (let i = 0; i < 10; i++) {
        store.recordFrame(sessionId, makeFrame(1, i / 10));
      }
      store.flush(sessionId);

      const frames = store.getFrames({ sessionId, downsample: 3 });
      expect(frames).toHaveLength(4); // 0, 3, 6, 9
    });
  });

  describe('session listing', () => {
    it('lists all stored sessions', () => {
      const id1 = store.startSession({
        racerName: 'Driver A',
        trackName: 'Spa',
        carName: 'GT3',
        sessionType: 'race',
      });
      store.recordFrame(id1, makeFrame(1, 0.0));
      store.flush(id1);
      store.endSession(id1);

      const id2 = store.startSession({
        racerName: 'Driver B',
        trackName: 'Monza',
        carName: 'LMP2',
        sessionType: 'qualifying',
      });
      store.recordFrame(id2, makeFrame(1, 0.0));
      store.flush(id2);
      store.endSession(id2);

      const sessions = store.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.trackName).sort()).toEqual(['Monza', 'Spa']);
    });
  });

  describe('ring buffer', () => {
    it('enforces max frames limit per session', () => {
      const smallStore = new FileStore({ dataDir: tmpDir, autoFlushMs: 0, maxFramesPerSession: 5 });

      const sessionId = smallStore.startSession({
        racerName: 'Test Driver',
        trackName: 'Spa',
        carName: 'GT3',
        sessionType: 'race',
      });

      for (let i = 0; i < 10; i++) {
        smallStore.recordFrame(sessionId, makeFrame(1, i / 10));
      }
      smallStore.flush(sessionId);

      const frames = smallStore.getFrames({ sessionId });
      expect(frames).toHaveLength(5);
      // Should keep the latest 5 frames
      expect(frames[0].seq).toBe(5);

      smallStore.close();
    });
  });

  describe('persistence', () => {
    it('survives close and reopen', () => {
      const sessionId = store.startSession({
        racerName: 'Test Driver',
        trackName: 'Spa',
        carName: 'GT3',
        sessionType: 'race',
      });

      store.recordFrame(sessionId, makeFrame(1, 0.0));
      store.recordFrame(sessionId, makeFrame(1, 0.5));
      store.flush(sessionId);
      store.endSession(sessionId);
      store.close();

      // Reopen
      const store2 = new FileStore({ dataDir: tmpDir, autoFlushMs: 0 });
      const sessions = store2.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe(sessionId);

      const frames = store2.getFrames({ sessionId });
      expect(frames).toHaveLength(2);

      store2.close();
    });

    it('skips corrupt NDJSON lines and returns remaining valid frames', () => {
      const sessionId = store.startSession({
        racerName: 'Test Driver',
        trackName: 'Spa',
        carName: 'GT3',
        sessionType: 'race',
      });

      store.recordFrame(sessionId, makeFrame(1, 0.0));
      store.recordFrame(sessionId, makeFrame(1, 0.5));
      store.recordFrame(sessionId, makeFrame(1, 1.0));
      store.flush(sessionId);

      // Corrupt line 2 (index 1) of the NDJSON file
      const ndjsonPath = join(tmpDir, sessionId, 'frames.ndjson');
      const lines = readFileSync(ndjsonPath, 'utf-8').split('\n');
      lines[1] = '{corrupt json!!!';
      writeFileSync(ndjsonPath, lines.join('\n'));

      // End the session so subsequent reads go through readFramesFromDisk
      store.endSession(sessionId);

      const frames = store.getFrames({ sessionId });
      expect(frames).toHaveLength(2);
    });
  });
});
