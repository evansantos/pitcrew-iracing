/**
 * Lap delta calculation service.
 * Compares two laps by interpolating time at uniform track positions,
 * then computing cumulative time difference.
 */

export interface DistTimePoint {
  dist: number; // 0.0 - 1.0 (LapDistPct)
  time: number; // session time in seconds
}

export interface DeltaPoint {
  dist: number;
  delta: number; // positive = lap1 slower, negative = lap1 faster
}

/**
 * Interpolate data points to a uniform distance grid.
 * Uses linear interpolation between adjacent points.
 */
export function interpolateToGrid(points: DistTimePoint[], gridSize: number): DistTimePoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return Array.from({ length: gridSize }, (_, i) => ({
      dist: i / (gridSize - 1),
      time: points[0].time,
    }));
  }

  // Sort by distance
  const sorted = [...points].sort((a, b) => a.dist - b.dist);

  const grid: DistTimePoint[] = [];
  for (let i = 0; i < gridSize; i++) {
    const targetDist = i / (gridSize - 1);

    // Find the two surrounding points
    let lower = sorted[0];
    let upper = sorted[sorted.length - 1];

    for (let j = 0; j < sorted.length - 1; j++) {
      if (sorted[j].dist <= targetDist && sorted[j + 1].dist >= targetDist) {
        lower = sorted[j];
        upper = sorted[j + 1];
        break;
      }
    }

    // Linear interpolation
    const range = upper.dist - lower.dist;
    const t = range > 0 ? (targetDist - lower.dist) / range : 0;
    const interpolatedTime = lower.time + t * (upper.time - lower.time);

    grid.push({ dist: targetDist, time: interpolatedTime });
  }

  return grid;
}

/**
 * Calculate lap delta between two laps.
 *
 * @param lap1 - First lap data points (the lap being compared)
 * @param lap2 - Reference lap data points
 * @param gridSize - Number of points in the output grid (default 100)
 * @returns Array of delta points. Positive delta = lap1 is slower.
 */
export function calculateLapDelta(
  lap1: DistTimePoint[],
  lap2: DistTimePoint[],
  gridSize: number = 100,
): DeltaPoint[] {
  const grid1 = interpolateToGrid(lap1, gridSize);
  const grid2 = interpolateToGrid(lap2, gridSize);

  return grid1.map((point, i) => ({
    dist: point.dist,
    delta: point.time - grid2[i].time,
  }));
}
