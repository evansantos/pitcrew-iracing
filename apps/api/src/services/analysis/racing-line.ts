/**
 * Racing line analysis — compares current line to best lap reference.
 * Samples the best lap at 100 equidistant points and computes speed deviation.
 */
import type { StoredFrame } from '@iracing-race-engineer/shared';

export interface ReferencePoint {
  dist: number;   // lapDistPct 0-1
  speed: number;  // km/h
  throttle: number; // 0-1
  brake: number;  // 0-1
}

export interface LineDeviation {
  dist: number;
  speedDiff: number; // positive = faster than reference
  color: 'green' | 'yellow' | 'red' | 'blue';
}

const SAMPLE_COUNT = 100;

/**
 * Build a reference line from a lap's frames, sampled at 100 equidistant points.
 */
export function buildReferenceLine(frames: StoredFrame[]): ReferencePoint[] {
  if (frames.length === 0) return [];

  const reference: ReferencePoint[] = [];

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const targetDist = i / SAMPLE_COUNT;
    const nearest = findNearest(frames, targetDist);
    if (nearest) {
      reference.push({
        dist: targetDist,
        speed: nearest.telemetry.player.speed,
        throttle: nearest.telemetry.player.throttle,
        brake: nearest.telemetry.player.brake,
      });
    }
  }

  return reference;
}

/**
 * Compare a current telemetry position against the reference line.
 * Returns deviation with color coding.
 */
export function compareToReference(
  currentDist: number,
  currentSpeed: number,
  reference: ReferencePoint[],
): LineDeviation | null {
  if (reference.length === 0) return null;

  // Find nearest reference point
  let closest = reference[0];
  let minDist = Math.abs(reference[0].dist - currentDist);

  for (const point of reference) {
    const d = Math.abs(point.dist - currentDist);
    if (d < minDist) {
      minDist = d;
      closest = point;
    }
  }

  const speedDiff = currentSpeed - closest.speed;

  let color: LineDeviation['color'];
  if (speedDiff > 5) {
    color = 'blue';    // faster than reference
  } else if (speedDiff > -5) {
    color = 'green';   // within 5 km/h
  } else if (speedDiff > -15) {
    color = 'yellow';  // 5-15 km/h slower
  } else {
    color = 'red';     // >15 km/h slower
  }

  return { dist: currentDist, speedDiff, color };
}

/**
 * Compare an entire lap against the reference, returning deviations at each sample point.
 */
export function compareLapToReference(
  lapFrames: StoredFrame[],
  reference: ReferencePoint[],
): LineDeviation[] {
  if (lapFrames.length === 0 || reference.length === 0) return [];

  const deviations: LineDeviation[] = [];

  for (const ref of reference) {
    const nearest = findNearest(lapFrames, ref.dist);
    if (nearest) {
      const speedDiff = nearest.telemetry.player.speed - ref.speed;

      let color: LineDeviation['color'];
      if (speedDiff > 5) {
        color = 'blue';
      } else if (speedDiff > -5) {
        color = 'green';
      } else if (speedDiff > -15) {
        color = 'yellow';
      } else {
        color = 'red';
      }

      deviations.push({ dist: ref.dist, speedDiff, color });
    }
  }

  return deviations;
}

function findNearest(frames: StoredFrame[], dist: number): StoredFrame | null {
  if (frames.length === 0) return null;
  let closest = frames[0];
  let minDist = Math.abs(frames[0].lapDistPct - dist);

  for (const frame of frames) {
    const d = Math.abs(frame.lapDistPct - dist);
    if (d < minDist) {
      minDist = d;
      closest = frame;
    }
  }

  return closest;
}
