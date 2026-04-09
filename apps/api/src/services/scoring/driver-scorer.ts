/**
 * Driver performance scoring — composite rating from consistency, racecraft, and improvement.
 * Score range: 0-100.
 */

export interface ConsistencyScore {
  score: number;
  breakdown: {
    stdDev: number;
    pctWithin1Percent: number;
    validLaps: number;
  };
}

export interface RacecraftScore {
  score: number;
  breakdown: {
    positionsGained: number;
    overtakes: number;
    gapConsistency: number;
    cleanLaps: number;
  };
}

export interface ImprovementScore {
  score: number;
  breakdown: {
    bestVsHistorical: number;
    bestVsAverage: number;
    lapsToTarget: number;
  };
}

export interface CompositeScore {
  overall: number;
  consistency: ConsistencyScore;
  racecraft: RacecraftScore;
  improvement: ImprovementScore;
}

/**
 * Calculate consistency score from lap times.
 * Excludes outlier laps (> 5s from median).
 */
export function calculateConsistency(lapTimes: number[]): ConsistencyScore {
  if (lapTimes.length < 3) {
    return { score: 0, breakdown: { stdDev: 0, pctWithin1Percent: 0, validLaps: 0 } };
  }

  // Exclude outliers (pit laps, incidents)
  const sorted = [...lapTimes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const valid = lapTimes.filter(t => Math.abs(t - median) < 5);

  if (valid.length < 3) {
    return { score: 0, breakdown: { stdDev: 0, pctWithin1Percent: 0, validLaps: 0 } };
  }

  const mean = valid.reduce((s, t) => s + t, 0) / valid.length;
  const variance = valid.reduce((s, t) => s + (t - mean) ** 2, 0) / valid.length;
  const stdDev = Math.sqrt(variance);

  const best = Math.min(...valid);
  const threshold = best * 1.01;
  const withinCount = valid.filter(t => t <= threshold).length;
  const pctWithin1Percent = (withinCount / valid.length) * 100;

  // Score: stddev < 0.3s = 100, < 0.5s = 80, < 1.0s = 60, < 2.0s = 40, else 20
  let score: number;
  if (stdDev < 0.3) score = 100;
  else if (stdDev < 0.5) score = 80 + (0.5 - stdDev) / 0.2 * 20;
  else if (stdDev < 1.0) score = 60 + (1.0 - stdDev) / 0.5 * 20;
  else if (stdDev < 2.0) score = 40 + (2.0 - stdDev) / 1.0 * 20;
  else score = Math.max(0, 20 - (stdDev - 2.0) * 5);

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    breakdown: {
      stdDev: Math.round(stdDev * 1000) / 1000,
      pctWithin1Percent: Math.round(pctWithin1Percent),
      validLaps: valid.length,
    },
  };
}

/**
 * Calculate racecraft score from position data.
 */
export function calculateRacecraft(
  positions: number[],
  gapsToCarAhead: number[] = [],
): RacecraftScore {
  if (positions.length < 2) {
    return { score: 0, breakdown: { positionsGained: 0, overtakes: 0, gapConsistency: 0, cleanLaps: 0 } };
  }

  const startPos = positions[0];
  const endPos = positions[positions.length - 1];
  const positionsGained = startPos - endPos; // positive = gained positions

  // Count overtakes (position improvements between consecutive laps)
  let overtakes = 0;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] < positions[i - 1]) {
      overtakes += positions[i - 1] - positions[i];
    }
  }

  // Gap consistency (lower std dev = better)
  let gapConsistency = 0;
  if (gapsToCarAhead.length > 2) {
    const validGaps = gapsToCarAhead.filter(g => g > 0 && g < 30);
    if (validGaps.length > 2) {
      const mean = validGaps.reduce((s, g) => s + g, 0) / validGaps.length;
      const variance = validGaps.reduce((s, g) => s + (g - mean) ** 2, 0) / validGaps.length;
      gapConsistency = Math.max(0, 100 - Math.sqrt(variance) * 20);
    }
  }

  // Clean laps (no position lost)
  const cleanLaps = positions.filter((_, i) => i === 0 || positions[i] <= positions[i - 1]).length;
  const cleanPct = (cleanLaps / positions.length) * 100;

  // Composite racecraft score
  const posScore = Math.min(100, Math.max(0, 50 + positionsGained * 10));
  const overtakeScore = Math.min(100, overtakes * 15);
  const score = (posScore * 0.3 + overtakeScore * 0.3 + gapConsistency * 0.2 + cleanPct * 0.2);

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    breakdown: {
      positionsGained,
      overtakes,
      gapConsistency: Math.round(gapConsistency),
      cleanLaps,
    },
  };
}

/**
 * Calculate improvement score from historical best times.
 */
export function calculateImprovement(
  currentBest: number,
  sessionAverage: number,
  historicalBests: number[] = [],
): ImprovementScore {
  if (currentBest <= 0 || sessionAverage <= 0) {
    return { score: 0, breakdown: { bestVsHistorical: 0, bestVsAverage: 0, lapsToTarget: 0 } };
  }

  // Best vs historical: how does this session's best compare to past sessions
  let bestVsHistorical = 50; // neutral if no history
  if (historicalBests.length > 0) {
    const historicalAvg = historicalBests.reduce((s, t) => s + t, 0) / historicalBests.length;
    const improvement = historicalAvg - currentBest; // positive = faster
    // Score: 1s faster = 100, same = 50, 1s slower = 0
    bestVsHistorical = Math.max(0, Math.min(100, 50 + improvement * 50));
  }

  // Best vs session average: how tight is the session
  const sessionSpread = sessionAverage - currentBest;
  // < 0.5s spread = 100, < 1s = 80, < 2s = 60, < 3s = 40, else 20
  let bestVsAverage: number;
  if (sessionSpread < 0.5) bestVsAverage = 100;
  else if (sessionSpread < 1.0) bestVsAverage = 80;
  else if (sessionSpread < 2.0) bestVsAverage = 60;
  else if (sessionSpread < 3.0) bestVsAverage = 40;
  else bestVsAverage = 20;

  const score = (bestVsHistorical * 0.5 + bestVsAverage * 0.5);

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    breakdown: {
      bestVsHistorical: Math.round(bestVsHistorical),
      bestVsAverage: Math.round(bestVsAverage),
      lapsToTarget: 0,
    },
  };
}

/**
 * Calculate composite score: consistency 40%, racecraft 30%, improvement 30%.
 */
export function calculateComposite(
  consistency: ConsistencyScore,
  racecraft: RacecraftScore,
  improvement: ImprovementScore,
): CompositeScore {
  const overall = Math.round(
    consistency.score * 0.4 +
    racecraft.score * 0.3 +
    improvement.score * 0.3
  );

  return {
    overall: Math.max(0, Math.min(100, overall)),
    consistency,
    racecraft,
    improvement,
  };
}
