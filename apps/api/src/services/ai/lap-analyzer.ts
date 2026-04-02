/**
 * Lap analyzer — identifies top improvement areas from telemetry.
 * Compares current lap vs best lap to find braking, throttle, and cornering deficits.
 */
import type { StoredFrame } from '@iracing-race-engineer/shared';

export interface ImprovementArea {
  type: 'braking' | 'throttle' | 'cornering';
  /** Track position (0-1) where the issue occurs */
  position: number;
  /** Severity 0-1 (1 = worst) */
  severity: number;
  /** Brief description */
  description: string;
}

/**
 * Analyze a lap and identify top improvement areas vs a reference.
 * Returns up to `maxAreas` improvement areas sorted by severity.
 */
export function analyzeLap(
  currentLap: StoredFrame[],
  referenceLap: StoredFrame[],
  maxAreas: number = 3,
): ImprovementArea[] {
  if (currentLap.length < 10 || referenceLap.length < 10) return [];

  const areas: ImprovementArea[] = [];

  // Sample at ~20 track segments
  const segments = 20;
  for (let i = 0; i < segments; i++) {
    const targetDist = i / segments;

    const current = findNearest(currentLap, targetDist);
    const reference = findNearest(referenceLap, targetDist);
    if (!current || !reference) continue;

    const curT = current.telemetry;
    const refT = reference.telemetry;

    // Check braking: current brakes earlier or harder than needed
    const brakeDiff = curT.player.brake - refT.player.brake;
    if (brakeDiff > 0.15) {
      areas.push({
        type: 'braking',
        position: targetDist,
        severity: Math.min(brakeDiff, 1),
        description: `Heavy braking at ${(targetDist * 100).toFixed(0)}% — ${(brakeDiff * 100).toFixed(0)}% more than reference`,
      });
    }

    // Check throttle: current applies less throttle
    const throttleDiff = refT.player.throttle - curT.player.throttle;
    if (throttleDiff > 0.15) {
      areas.push({
        type: 'throttle',
        position: targetDist,
        severity: Math.min(throttleDiff, 1),
        description: `Late throttle at ${(targetDist * 100).toFixed(0)}% — ${(throttleDiff * 100).toFixed(0)}% less than reference`,
      });
    }

    // Check cornering speed deficit
    const speedDiff = refT.player.speed - curT.player.speed;
    if (speedDiff > 10) {
      areas.push({
        type: 'cornering',
        position: targetDist,
        severity: Math.min(speedDiff / 50, 1),
        description: `Slow cornering at ${(targetDist * 100).toFixed(0)}% — ${speedDiff.toFixed(0)} km/h slower`,
      });
    }
  }

  // Sort by severity descending, return top N
  return areas
    .sort((a, b) => b.severity - a.severity)
    .slice(0, maxAreas);
}

function findNearest(frames: StoredFrame[], dist: number): StoredFrame | null {
  let closest: StoredFrame | null = null;
  let minDist = Infinity;

  for (const frame of frames) {
    const d = Math.abs(frame.lapDistPct - dist);
    if (d < minDist) {
      minDist = d;
      closest = frame;
    }
  }

  return closest;
}
