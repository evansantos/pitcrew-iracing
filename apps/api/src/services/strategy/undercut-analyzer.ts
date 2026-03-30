/**
 * Undercut/Overcut Analyzer
 * Analyzes opportunities for undercut and overcut strategies
 */

import type { GapAnalysis, UndercutAnalysis, OvercutAnalysis } from './types.js';

export class UndercutAnalyzer {
  private readonly PIT_STOP_TIME_LOSS = 25; // seconds
  private readonly NEW_TIRE_ADVANTAGE = 1.0; // seconds per lap with new tires
  private readonly TIRE_DELTA_THRESHOLD = 5; // laps difference to consider undercut

  /**
   * Analyze undercut opportunity against target car
   */
  analyzeUndercut(
    gapAnalysis: GapAnalysis[],
    currentLap: number,
    playerTireLaps: number
  ): UndercutAnalysis | null {
    // Sort by position
    const sortedGaps = [...gapAnalysis].sort((a, b) => a.position - b.position);

    // Find car directly ahead
    const carAhead = sortedGaps.find((gap) => gap.position === 1); // Assuming player is position 0

    if (!carAhead) {
      return null;
    }

    const gapToTarget = carAhead.gapToPlayer;

    // Check if undercut is viable
    const isViable = this.isUndercutViable(
      gapToTarget,
      playerTireLaps,
      carAhead.gapTrend
    );

    if (!isViable) {
      return null;
    }

    // Calculate potential gain
    const estimatedGainPerLap = this.calculateUndercutGain(playerTireLaps);

    // Recommend pitting in next 1-2 laps
    const recommendedLap = currentLap + 1;

    // Confidence based on gap and tire age
    const confidence = this.calculateUndercutConfidence(
      gapToTarget,
      playerTireLaps,
      carAhead.gapTrend
    );

    return {
      isViable,
      targetCarIdx: carAhead.carIdx,
      targetDriverName: carAhead.driverName,
      gapToTarget,
      estimatedGainPerLap,
      recommendedLap,
      confidence,
    };
  }

  /**
   * Analyze overcut opportunity against target car
   */
  analyzeOvercut(
    gapAnalysis: GapAnalysis[],
    currentLap: number,
    playerTireLaps: number,
    opponentPittedLap?: number
  ): OvercutAnalysis | null {
    if (!opponentPittedLap) {
      return null; // No opponent has pitted yet
    }

    const sortedGaps = [...gapAnalysis].sort((a, b) => a.position - b.position);
    const carAhead = sortedGaps.find((gap) => gap.position === 1);

    if (!carAhead) {
      return null;
    }

    const gapToTarget = carAhead.gapToPlayer;
    const lapsSinceOpponentPit = currentLap - opponentPittedLap;

    // Check if overcut is viable
    const isViable = this.isOvercutViable(
      gapToTarget,
      playerTireLaps,
      lapsSinceOpponentPit
    );

    if (!isViable) {
      return null;
    }

    // Calculate additional laps we can stay out
    const additionalLaps = this.calculateOvercutLaps(playerTireLaps, lapsSinceOpponentPit);

    // Estimated gain per lap with tire advantage
    const estimatedGainPerLap = this.calculateOvercutGain(
      playerTireLaps,
      lapsSinceOpponentPit
    );

    const recommendedLap = currentLap + additionalLaps;

    const confidence = this.calculateOvercutConfidence(
      gapToTarget,
      playerTireLaps,
      additionalLaps
    );

    return {
      isViable,
      targetCarIdx: carAhead.carIdx,
      targetDriverName: carAhead.driverName,
      gapToTarget,
      additionalLapsOnCurrentTires: additionalLaps,
      estimatedGainPerLap,
      recommendedLap,
      confidence,
    };
  }

  /**
   * Check if undercut is viable
   */
  private isUndercutViable(
    gap: number,
    tireLaps: number,
    trend: 'closing' | 'opening' | 'stable'
  ): boolean {
    // Undercut viable if:
    // 1. Gap is within pit stop time loss window (20-30 seconds)
    // 2. Our tires are old enough to benefit from fresh rubber (>10 laps)
    // 3. We're not losing ground rapidly

    if (gap < 15 || gap > 35) return false;
    if (tireLaps < 10) return false;
    if (trend === 'opening') return false;

    return true;
  }

  /**
   * Check if overcut is viable
   */
  private isOvercutViable(
    gap: number,
    tireLaps: number,
    lapsSinceOpponentPit: number
  ): boolean {
    // Overcut viable if:
    // 1. Opponent has pitted recently (1-3 laps ago)
    // 2. We're close enough to capitalize (gap < 30 seconds)
    // 3. Our tires are still good enough (< 20 laps)

    if (lapsSinceOpponentPit < 1 || lapsSinceOpponentPit > 3) return false;
    if (gap > 30) return false;
    if (tireLaps > 20) return false;

    return true;
  }

  /**
   * Calculate potential gain per lap from undercut
   */
  private calculateUndercutGain(playerTireLaps: number): number {
    // Fresh tires give approximately 1-1.5 seconds advantage per lap
    // The advantage decreases as opponent's tires warm up
    const baseGain = this.NEW_TIRE_ADVANTAGE;
    const tireAdvantage = Math.min(2.0, playerTireLaps * 0.05); // 0.05s per lap age

    return baseGain + tireAdvantage;
  }

  /**
   * Calculate potential gain per lap from overcut
   */
  private calculateOvercutGain(
    playerTireLaps: number,
    lapsSinceOpponentPit: number
  ): number {
    // Staying out means we're on older but warmed-up tires
    // Gain diminishes as our tires degrade
    const baseGain = 0.5;
    const tireDelta = playerTireLaps - lapsSinceOpponentPit;
    const degradationPenalty = tireDelta * 0.02;

    return Math.max(0, baseGain - degradationPenalty);
  }

  /**
   * Calculate how many additional laps for overcut
   */
  private calculateOvercutLaps(
    playerTireLaps: number,
    lapsSinceOpponentPit: number
  ): number {
    // Stay out 2-4 laps longer than opponent
    const maxAdditionalLaps = 4;
    const tireConditionFactor = Math.max(1, maxAdditionalLaps - Math.floor(playerTireLaps / 5));

    return Math.min(maxAdditionalLaps, tireConditionFactor);
  }

  /**
   * Calculate confidence in undercut strategy
   */
  private calculateUndercutConfidence(
    gap: number,
    tireLaps: number,
    trend: 'closing' | 'opening' | 'stable'
  ): number {
    let confidence = 0.5;

    // Gap factor - ideal gap is 22-28 seconds (pit stop time)
    if (gap >= 22 && gap <= 28) {
      confidence += 0.2;
    } else if (gap >= 18 && gap <= 32) {
      confidence += 0.1;
    }

    // Tire age factor - older tires = more benefit
    if (tireLaps > 15) {
      confidence += 0.2;
    } else if (tireLaps > 12) {
      confidence += 0.1;
    }

    // Trend factor
    if (trend === 'closing') {
      confidence += 0.1;
    } else if (trend === 'opening') {
      confidence -= 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate confidence in overcut strategy
   */
  private calculateOvercutConfidence(
    gap: number,
    tireLaps: number,
    additionalLaps: number
  ): number {
    let confidence = 0.5;

    // Gap factor
    if (gap >= 15 && gap <= 25) {
      confidence += 0.15;
    }

    // Tire condition factor - fresher is better for overcut
    if (tireLaps < 12) {
      confidence += 0.2;
    } else if (tireLaps < 16) {
      confidence += 0.1;
    }

    // Additional laps factor - more laps = higher risk
    if (additionalLaps <= 2) {
      confidence += 0.15;
    } else if (additionalLaps <= 3) {
      confidence += 0.05;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Analyze gap trend over recent laps
   */
  analyzeGapTrend(recentGaps: number[]): {
    trend: 'closing' | 'opening' | 'stable';
    rate: number;
  } {
    if (recentGaps.length < 3) {
      return { trend: 'stable', rate: 0 };
    }

    // Calculate linear regression for trend
    const n = recentGaps.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = recentGaps;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) {
      return { trend: 'stable', rate: 0 };
    }
    const slope = (n * sumXY - sumX * sumY) / denominator;

    let trend: 'closing' | 'opening' | 'stable';
    if (slope < -0.1) {
      trend = 'closing';
    } else if (slope > 0.1) {
      trend = 'opening';
    } else {
      trend = 'stable';
    }

    return { trend, rate: slope };
  }
}
