/**
 * FileStore — NDJSON-based telemetry session persistence
 *
 * Stores telemetry frames as newline-delimited JSON with a separate index file
 * per session for fast lookups by lap, time range, or track position.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type {
  ProcessedTelemetry,
  StoredFrame,
  SessionIndex,
  StoredSessionSummary,
  LapBoundary,
  FrameQuery,
} from '@iracing-race-engineer/shared';

export interface FileStoreOptions {
  /** Directory to store session data */
  dataDir: string;
  /** Auto-flush interval in ms (0 = disabled) */
  autoFlushMs?: number;
  /** Max frames per session (ring buffer). 0 = unlimited */
  maxFramesPerSession?: number;
}

interface SessionStartParams {
  racerName: string;
  trackName: string;
  carName: string;
  sessionType: string;
  source?: 'live' | 'import';
}

interface ActiveSession {
  index: SessionIndex;
  buffer: StoredFrame[];
  flushedCount: number;
}

export class FileStore {
  private readonly dataDir: string;
  private readonly maxFrames: number;
  private readonly activeSessions = new Map<string, ActiveSession>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: FileStoreOptions) {
    this.dataDir = options.dataDir;
    this.maxFrames = options.maxFramesPerSession ?? 0;

    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    const autoFlushMs = options.autoFlushMs ?? 5000;
    if (autoFlushMs > 0) {
      this.flushTimer = setInterval(() => this.flushAll(), autoFlushMs);
    }
  }

  startSession(params: SessionStartParams): string {
    const sessionId = randomUUID();
    const index: SessionIndex = {
      sessionId,
      racerName: params.racerName,
      trackName: params.trackName,
      carName: params.carName,
      sessionType: params.sessionType,
      startTime: Date.now(),
      endTime: null,
      totalFrames: 0,
      laps: [],
      source: params.source ?? 'live',
    };

    this.activeSessions.set(sessionId, {
      index,
      buffer: [],
      flushedCount: 0,
    });

    // Create session directory
    const sessionDir = this.sessionDir(sessionId);
    mkdirSync(sessionDir, { recursive: true });

    // Write initial index
    this.writeIndex(sessionId, index);

    return sessionId;
  }

  endSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.flush(sessionId);
      session.index.endTime = Date.now();
      this.writeIndex(sessionId, session.index);
      this.activeSessions.delete(sessionId);
    } else {
      // Session already flushed to disk, update the index
      const index = this.readIndexFromDisk(sessionId);
      if (index) {
        index.endTime = Date.now();
        this.writeIndex(sessionId, index);
      }
    }
  }

  recordFrame(sessionId: string, telemetry: ProcessedTelemetry): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`[FileStore] recordFrame called for unknown session: ${sessionId}`);
      return;
    }

    const seq = session.flushedCount + session.buffer.length;
    const lap = telemetry.player?.lap ?? 0;
    const lapDistPct = telemetry.player?.lapDistPct ?? 0;

    const frame: StoredFrame = { seq, lap, lapDistPct, telemetry };
    session.buffer.push(frame);

    // Update lap boundaries
    this.updateLapBoundaries(session.index, lap, seq);

    // Update total frames
    session.index.totalFrames = session.flushedCount + session.buffer.length;
  }

  flush(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.buffer.length === 0) return;

    const sessionDir = this.sessionDir(sessionId);
    const dataFile = join(sessionDir, 'frames.ndjson');

    // If ring buffer is active and we'd exceed it, we need to truncate
    if (this.maxFrames > 0) {
      const totalAfterFlush = session.flushedCount + session.buffer.length;
      if (totalAfterFlush > this.maxFrames) {
        // Read existing flushed frames
        const existingFrames = this.readFramesFromDisk(sessionId);
        const allFrames = [...existingFrames, ...session.buffer];

        // Keep only the latest maxFrames
        const kept = allFrames.slice(-this.maxFrames);

        // Rewrite the file
        const ndjson = kept.map(f => JSON.stringify(f)).join('\n') + '\n';
        writeFileSync(dataFile, ndjson);

        session.flushedCount = kept.length;
        session.buffer = [];
        session.index.totalFrames = kept.length;

        // Rebuild lap boundaries from kept frames
        session.index.laps = [];
        for (const frame of kept) {
          this.updateLapBoundaries(session.index, frame.lap, frame.seq);
        }

        this.writeIndex(sessionId, session.index);
        return;
      }
    }

    // Normal append
    const ndjson = session.buffer.map(f => JSON.stringify(f)).join('\n') + '\n';
    appendFileSync(dataFile, ndjson);

    session.flushedCount += session.buffer.length;
    session.buffer = [];

    // Write updated index
    this.writeIndex(sessionId, session.index);
  }

  getSessionIndex(sessionId: string): SessionIndex | null {
    const active = this.activeSessions.get(sessionId);
    if (active) return active.index;
    return this.readIndexFromDisk(sessionId);
  }

  getFrames(query: FrameQuery): StoredFrame[] {
    const session = this.activeSessions.get(query.sessionId);

    // Get all frames (flushed + buffered)
    let frames: StoredFrame[];
    if (session) {
      const flushed = this.readFramesFromDisk(query.sessionId);
      frames = [...flushed, ...session.buffer];
    } else {
      frames = this.readFramesFromDisk(query.sessionId);
    }

    // Filter by laps
    if (query.laps && query.laps.length > 0) {
      const lapSet = new Set(query.laps);
      frames = frames.filter(f => lapSet.has(f.lap));
    }

    // Filter by time range
    if (query.timeRange) {
      frames = frames.filter(f =>
        f.telemetry.sessionTime >= query.timeRange!.start &&
        f.telemetry.sessionTime <= query.timeRange!.end
      );
    }

    // Filter by distance range
    if (query.distRange) {
      frames = frames.filter(f =>
        f.lapDistPct >= query.distRange!.start &&
        f.lapDistPct <= query.distRange!.end
      );
    }

    // Downsample
    if (query.downsample && query.downsample > 1) {
      frames = frames.filter((_, i) => i % query.downsample! === 0);
    }

    // Limit
    if (query.limit && query.limit > 0) {
      frames = frames.slice(0, query.limit);
    }

    return frames;
  }

  listSessions(): StoredSessionSummary[] {
    const summaries: StoredSessionSummary[] = [];

    // Active sessions
    for (const session of this.activeSessions.values()) {
      summaries.push(this.indexToSummary(session.index));
    }

    // Persisted sessions
    if (existsSync(this.dataDir)) {
      for (const entry of readdirSync(this.dataDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const sessionId = entry.name;
        if (this.activeSessions.has(sessionId)) continue; // already added

        const index = this.readIndexFromDisk(sessionId);
        if (index) {
          summaries.push(this.indexToSummary(index));
        }
      }
    }

    return summaries;
  }

  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushAll();
  }

  // --- Private helpers ---

  private flushAll(): void {
    for (const sessionId of this.activeSessions.keys()) {
      this.flush(sessionId);
    }
  }

  private sessionDir(sessionId: string): string {
    return join(this.dataDir, sessionId);
  }

  private writeIndex(sessionId: string, index: SessionIndex): void {
    const indexPath = join(this.sessionDir(sessionId), 'index.json');
    writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }

  private readIndexFromDisk(sessionId: string): SessionIndex | null {
    const indexPath = join(this.sessionDir(sessionId), 'index.json');
    if (!existsSync(indexPath)) return null;
    try {
      return JSON.parse(readFileSync(indexPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  private readFramesFromDisk(sessionId: string): StoredFrame[] {
    const dataFile = join(this.sessionDir(sessionId), 'frames.ndjson');
    if (!existsSync(dataFile)) return [];
    try {
      const content = readFileSync(dataFile, 'utf-8').trim();
      if (!content) return [];
      const frames: StoredFrame[] = [];
      for (const line of content.split('\n')) {
        try {
          frames.push(JSON.parse(line));
        } catch {
          // Skip corrupt line
        }
      }
      return frames;
    } catch {
      return [];
    }
  }

  private updateLapBoundaries(index: SessionIndex, lap: number, seq: number): void {
    const existing = index.laps.find(l => l.lap === lap);
    if (existing) {
      existing.endSeq = seq;
    } else {
      index.laps.push({
        lap,
        startSeq: seq,
        endSeq: seq,
        lapTime: null,
      });
    }
  }

  private indexToSummary(index: SessionIndex): StoredSessionSummary {
    return {
      sessionId: index.sessionId,
      racerName: index.racerName,
      trackName: index.trackName,
      carName: index.carName,
      sessionType: index.sessionType,
      startTime: index.startTime,
      endTime: index.endTime,
      totalFrames: index.totalFrames,
      totalLaps: index.laps.length,
      source: index.source,
    };
  }
}
