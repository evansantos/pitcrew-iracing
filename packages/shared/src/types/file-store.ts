/**
 * FileStore types for telemetry session persistence
 */
import type { ProcessedTelemetry } from './telemetry';

/**
 * A single stored telemetry frame with metadata
 */
export interface StoredFrame {
  /** Frame sequence number within the session */
  seq: number;
  /** Lap number when this frame was recorded */
  lap: number;
  /** Track position (0.0 - 1.0) */
  lapDistPct: number;
  /** Telemetry data */
  telemetry: ProcessedTelemetry;
}

/**
 * Lap boundary info for fast seeking
 */
export interface LapBoundary {
  /** Lap number */
  lap: number;
  /** First frame sequence number in this lap */
  startSeq: number;
  /** Last frame sequence number in this lap */
  endSeq: number;
  /** Lap time in seconds (null if incomplete) */
  lapTime: number | null;
}

/**
 * Session index stored alongside telemetry data for fast lookups
 */
export interface SessionIndex {
  /** Unique session identifier */
  sessionId: string;
  /** Racer/driver name */
  racerName: string;
  /** Track name */
  trackName: string;
  /** Car name */
  carName: string;
  /** Session type (practice, qualifying, race) */
  sessionType: string;
  /** When the session started recording */
  startTime: number;
  /** When the session stopped recording (null if still active) */
  endTime: number | null;
  /** Total frames recorded */
  totalFrames: number;
  /** Lap boundaries for fast seeking */
  laps: LapBoundary[];
  /** Source of the data */
  source: 'live' | 'import';
}

/**
 * Summary of a stored session (for listing)
 */
export interface StoredSessionSummary {
  sessionId: string;
  racerName: string;
  trackName: string;
  carName: string;
  sessionType: string;
  startTime: number;
  endTime: number | null;
  totalFrames: number;
  totalLaps: number;
  source: 'live' | 'import';
}

/**
 * Options for querying frames from a session
 */
export interface FrameQuery {
  sessionId: string;
  /** Filter by lap number(s) */
  laps?: number[];
  /** Filter by time range (session time in seconds) */
  timeRange?: { start: number; end: number };
  /** Filter by track position range */
  distRange?: { start: number; end: number };
  /** Limit number of frames returned */
  limit?: number;
  /** Downsample factor (e.g., 2 = every other frame) */
  downsample?: number;
}
