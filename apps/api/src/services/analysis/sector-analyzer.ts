/**
 * Sector analyzer — auto-detects track sectors from telemetry braking zones.
 */
import type { StoredFrame } from '@iracing-race-engineer/shared';

export interface SectorBoundary {
  index: number;
  startDist: number;
  endDist: number;
  type: 'braking' | 'straight';
}

export interface SectorSplit {
  sector: number;
  time: number;
  entrySpeed: number;
  minSpeed: number;
  exitSpeed: number;
}

export interface SectorDelta {
  sector: number;
  delta: number;
  isWeakest: boolean;
}

const MIN_FRAMES = 10;
const SPEED_DROP_THRESHOLD = 30; // km/h
const DIST_WINDOW = 0.025; // ~2.5% of lap (accounts for frame spacing)
const MERGE_THRESHOLD = 0.05; // 5% of lap

/**
 * Detect sector boundaries from telemetry by finding braking zones.
 */
export function detectSectors(frames: StoredFrame[]): SectorBoundary[] {
  if (frames.length < MIN_FRAMES) return [];

  const sorted = [...frames].sort((a, b) => a.lapDistPct - b.lapDistPct);

  // Find braking zone starts: where speed drops > 30 km/h within 2% track distance
  const boundaryDists: number[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    // Look ahead within 2% track distance
    const windowEnd = current.lapDistPct + DIST_WINDOW;
    let maxSpeedAhead = current.telemetry.player.speed;

    // Actually we look for a drop: compare speed now vs frames ahead in window
    let minSpeedAhead = current.telemetry.player.speed;
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].lapDistPct > windowEnd) break;
      const s = sorted[j].telemetry.player.speed;
      if (s < minSpeedAhead) minSpeedAhead = s;
    }

    const drop = current.telemetry.player.speed - minSpeedAhead;
    if (drop > SPEED_DROP_THRESHOLD) {
      boundaryDists.push(current.lapDistPct);
      // Skip ahead past the window to avoid duplicate detections in same zone
      while (i + 1 < sorted.length && sorted[i + 1].lapDistPct < windowEnd) {
        i++;
      }
    }
  }

  if (boundaryDists.length === 0) {
    // Return 3 equal sectors
    return buildEqualSectors(3);
  }

  // Merge boundaries that are < 5% apart
  const merged = mergeBoundaries(boundaryDists, MERGE_THRESHOLD);

  // Build sectors between boundaries (wrap around 0 and 1)
  return buildSectorsFromBoundaries(merged);
}

function mergeBoundaries(dists: number[], threshold: number): number[] {
  if (dists.length === 0) return [];
  const sorted = [...dists].sort((a, b) => a - b);
  const result: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - result[result.length - 1] >= threshold) {
      result.push(sorted[i]);
    }
  }
  return result;
}

function buildSectorsFromBoundaries(boundaries: number[]): SectorBoundary[] {
  const points = [0, ...boundaries, 1];
  return points.slice(0, -1).map((start, i) => ({
    index: i,
    startDist: start,
    endDist: points[i + 1],
    type: i % 2 === 0 ? 'straight' : 'braking',
  }));
}

function buildEqualSectors(count: number): SectorBoundary[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    startDist: i / count,
    endDist: (i + 1) / count,
    type: 'straight' as const,
  }));
}

/**
 * Calculate per-sector splits from frames.
 */
export function calculateSplits(frames: StoredFrame[], sectors: SectorBoundary[]): SectorSplit[] {
  const sorted = [...frames].sort((a, b) => a.lapDistPct - b.lapDistPct);

  return sectors.map((sector) => {
    const sectorFrames = sorted.filter(
      (f) => f.lapDistPct >= sector.startDist && f.lapDistPct <= sector.endDist,
    );

    if (sectorFrames.length === 0) {
      return {
        sector: sector.index,
        time: 0,
        entrySpeed: 0,
        minSpeed: 0,
        exitSpeed: 0,
      };
    }

    const speeds = sectorFrames.map((f) => f.telemetry.player.speed);
    const firstTime = sectorFrames[0].telemetry.sessionTime;
    const lastTime = sectorFrames[sectorFrames.length - 1].telemetry.sessionTime;

    return {
      sector: sector.index,
      time: lastTime - firstTime,
      entrySpeed: speeds[0],
      minSpeed: Math.min(...speeds),
      exitSpeed: speeds[speeds.length - 1],
    };
  });
}

/**
 * Compare current sector splits against a reference, identifying the weakest sector.
 */
export function compareSplits(current: SectorSplit[], reference: SectorSplit[]): SectorDelta[] {
  const deltas: SectorDelta[] = [];

  for (const cur of current) {
    const ref = reference.find((r) => r.sector === cur.sector);
    if (!ref) continue;
    deltas.push({
      sector: cur.sector,
      delta: cur.time - ref.time,
      isWeakest: false,
    });
  }

  // Mark the sector with the largest positive delta as weakest
  if (deltas.length > 0) {
    const maxDelta = Math.max(...deltas.map((d) => d.delta));
    if (maxDelta > 0) {
      const weakest = deltas.find((d) => d.delta === maxDelta);
      if (weakest) weakest.isWeakest = true;
    }
  }

  return deltas;
}
