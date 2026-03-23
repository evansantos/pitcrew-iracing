/**
 * Delta encoder — only sends fields that changed by ≥ threshold.
 *
 * Two flavors:
 *  - `encode(prev, next, threshold)` — returns a DeltaFrame
 *  - `DeltaEncoder` class   — stateful, remembers the last frame
 */

import type { TelemetryFrame, DeltaFrame, DeepPartial } from './types.js';

/** Default change threshold (0.1% of a normalised value, or absolute for 0-based) */
export const DEFAULT_THRESHOLD = 0.001;

/**
 * Returns true if the numeric change is significant enough to include.
 *
 * For non-zero previous values we check relative change.
 * For zero previous values we use absolute change (avoids div-by-zero).
 */
export function isSignificantChange(
  prev: number,
  next: number,
  threshold: number = DEFAULT_THRESHOLD
): boolean {
  if (prev === next) return false;
  if (prev === 0) return Math.abs(next) > threshold;
  return Math.abs((next - prev) / prev) >= threshold;
}

/**
 * Deep-diff two plain objects.  Only numeric leaf values are thresholded;
 * non-numeric changed values are always included.
 * Returns `undefined` if nothing changed in this sub-tree.
 */
export function diffObjects<T extends Record<string, unknown>>(
  prev: T,
  next: T,
  threshold: number
): DeepPartial<T> | undefined {
  const delta: Record<string, unknown> = {};
  let changed = false;

  for (const key of Object.keys(next) as Array<keyof T>) {
    const prevVal = prev[key];
    const nextVal = next[key];

    if (typeof nextVal === 'number' && typeof prevVal === 'number') {
      if (isSignificantChange(prevVal, nextVal, threshold)) {
        delta[key as string] = nextVal;
        changed = true;
      }
    } else if (
      nextVal !== null &&
      typeof nextVal === 'object' &&
      !Array.isArray(nextVal) &&
      prevVal !== null &&
      typeof prevVal === 'object' &&
      !Array.isArray(prevVal)
    ) {
      const subDelta = diffObjects(
        prevVal as Record<string, unknown>,
        nextVal as Record<string, unknown>,
        threshold
      );
      if (subDelta !== undefined) {
        delta[key as string] = subDelta;
        changed = true;
      }
    } else if (nextVal !== prevVal) {
      // Non-numeric, non-object: always include if changed
      delta[key as string] = nextVal;
      changed = true;
    }
  }

  return changed ? (delta as DeepPartial<T>) : undefined;
}

/**
 * Encode a full frame against a previous frame.
 * The `timestamp` field is always included.
 */
export function encode(
  prev: TelemetryFrame | null,
  next: TelemetryFrame,
  threshold: number = DEFAULT_THRESHOLD
): DeltaFrame {
  if (prev === null) {
    // First frame — send everything
    return { ...next };
  }

  const delta = diffObjects(
    prev as unknown as Record<string, unknown>,
    next as unknown as Record<string, unknown>,
    threshold
  ) as DeepPartial<TelemetryFrame> | undefined;

  return {
    ...(delta ?? {}),
    timestamp: next.timestamp,
  };
}

/**
 * Stateful encoder that remembers the last frame.
 */
export class DeltaEncoder {
  private lastFrame: TelemetryFrame | null = null;
  private readonly threshold: number;

  constructor(threshold: number = DEFAULT_THRESHOLD) {
    this.threshold = threshold;
  }

  /** Returns the delta frame to send on the wire. */
  next(frame: TelemetryFrame): DeltaFrame {
    const delta = encode(this.lastFrame, frame, this.threshold);
    this.lastFrame = frame;
    return delta;
  }

  /** Reset state (e.g. when a new client connects and needs a full frame). */
  reset(): void {
    this.lastFrame = null;
  }

  /** Read-only access to the last known frame. */
  get last(): TelemetryFrame | null {
    return this.lastFrame;
  }
}
