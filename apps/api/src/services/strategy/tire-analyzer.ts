/**
 * Tire Degradation Analyzer
 * Models tire wear, temperature, and performance degradation
 */

import type { LapData, TireDegradation } from './types.js';

export class TireAnalyzer {
  private readonly OPTIMAL_TEMP_MIN = 75; // °C
  private readonly OPTIMAL_TEMP_MAX = 95; // °C
  private readonly CRITICAL_WEAR = 0.75; // 75% wear threshold
  private readonly HIGH_WEAR = 0.60; // 60% wear threshold

  /**
   * Analyze tire condition and predict degradation
   */
  analyzeTireDegradation(recentLaps: LapData[]): TireDegradation {
    if (recentLaps.length === 0) {
      return this.getDefaultDegradation();
    }

    const latestLap = recentLaps[recentLaps.length - 1];
    const currentWear = Math.max(0, Math.min(1, latestLap.avgTireWear || 0));
    const currentTemp = latestLap.avgTireTemp || 80;

    const degradationRate = this.calculateDegradationRate(recentLaps);
    const performance = this.calculatePerformance(currentWear, currentTemp);
    const estimatedLapsRemaining = this.estimateLapsRemaining(
      currentWear,
      degradationRate
    );
    const optimalTemp = (this.OPTIMAL_TEMP_MIN + this.OPTIMAL_TEMP_MAX) / 2;

    return {
      currentWear,
      currentTemp,
      optimalTemp,
      degradationRate,
      estimatedLapsRemaining,
      performance,
    };
  }

  /**
   * Calculate tire degradation rate per lap
   */
  private calculateDegradationRate(laps: LapData[]): number {
    if (laps.length < 2) return 0.01; // Default 1% per lap

    const validLaps = laps.filter((lap) => lap.avgTireWear !== undefined);
    if (validLaps.length < 2) return 0.01;

    // Calculate wear change over recent laps
    const wearChanges: number[] = [];
    for (let i = 1; i < validLaps.length; i++) {
      const wearChange = (validLaps[i].avgTireWear || 0) - (validLaps[i - 1].avgTireWear || 0);
      wearChanges.push(wearChange);
    }

    // Use weighted average for degradation rate
    const weights = wearChanges.map((_, idx) => Math.pow(1.1, idx));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    const weightedRate = wearChanges.reduce((sum, change, idx) => {
      return sum + change * weights[idx];
    }, 0);

    return Math.max(0, weightedRate / totalWeight);
  }

  /**
   * Calculate current tire performance (0-1 scale)
   */
  private calculatePerformance(wear: number, temp: number): number {
    // Temperature factor
    let tempFactor = 1.0;
    if (temp < this.OPTIMAL_TEMP_MIN) {
      tempFactor = 0.7 + (temp / this.OPTIMAL_TEMP_MIN) * 0.3;
    } else if (temp > this.OPTIMAL_TEMP_MAX) {
      const overTemp = temp - this.OPTIMAL_TEMP_MAX;
      tempFactor = Math.max(0.6, 1.0 - (overTemp / 50) * 0.4);
    }

    // Wear factor - exponential degradation (clamp wear to [0,1] for valid output)
    const clampedWear = Math.max(0, Math.min(1, wear));
    const wearFactor = Math.exp(-2 * clampedWear); // Exponential decay

    // Combined performance
    const performance = tempFactor * wearFactor;

    return Math.max(0, Math.min(1, performance));
  }

  /**
   * Estimate laps remaining before tires need changing
   */
  private estimateLapsRemaining(currentWear: number, degradationRate: number): number {
    if (degradationRate <= 0) return 999;

    // If already past 80% wear, no laps remaining before threshold
    if (currentWear >= 0.8) return 0;

    // Use 80% wear as the limit for strategy purposes
    const lapsTo80Percent = (0.8 - currentWear) / degradationRate;

    return Math.max(0, Math.floor(lapsTo80Percent));
  }

  /**
   * Determine if tires need changing
   */
  shouldChangeTires(wear: number, performance: number): boolean {
    return wear >= this.CRITICAL_WEAR || performance < 0.7;
  }

  /**
   * Calculate expected lap time delta due to tire wear
   */
  calculateLapTimeDelta(
    currentWear: number,
    baselineLapTime: number
  ): number {
    // Assume 0.5% lap time increase per 10% wear
    const wearPercentage = currentWear * 100;
    const timeDelta = (baselineLapTime * 0.005 * wearPercentage) / 10;

    return timeDelta;
  }

  /**
   * Analyze tire temperature and provide recommendations
   */
  analyzeTemperature(temp: number): {
    status: 'cold' | 'optimal' | 'hot';
    message: string;
  } {
    if (temp < this.OPTIMAL_TEMP_MIN) {
      return {
        status: 'cold',
        message: `Tires are cold (${temp.toFixed(1)}°C). Push harder to generate heat.`,
      };
    } else if (temp > this.OPTIMAL_TEMP_MAX) {
      return {
        status: 'hot',
        message: `Tires are overheating (${temp.toFixed(1)}°C). Back off to preserve them.`,
      };
    } else {
      return {
        status: 'optimal',
        message: `Tires are in optimal range (${temp.toFixed(1)}°C).`,
      };
    }
  }

  /**
   * Calculate tire stint strategy
   */
  calculateStintStrategy(
    currentWear: number,
    degradationRate: number,
    lapsRemaining: number
  ): {
    canFinishOnCurrentTires: boolean;
    recommendedPitLap: number;
    expectedWearAtFinish: number;
  } {
    const lapsToFinish = lapsRemaining;
    const expectedWearAtFinish = currentWear + degradationRate * lapsToFinish;

    const canFinish = expectedWearAtFinish < 0.9; // Allow up to 90% wear

    let recommendedPitLap = 0;
    if (!canFinish && degradationRate > 0) {
      // Calculate when we'll hit 80% wear (guard against currentWear already past 80%)
      const lapsTo80Percent = currentWear >= 0.8 ? 0 : (0.8 - currentWear) / degradationRate;
      recommendedPitLap = Math.max(0, Math.floor(lapsTo80Percent));
    }

    return {
      canFinishOnCurrentTires: canFinish,
      recommendedPitLap,
      expectedWearAtFinish: Math.min(1.0, expectedWearAtFinish),
    };
  }

  /**
   * Get default degradation when no data is available
   */
  private getDefaultDegradation(): TireDegradation {
    return {
      currentWear: 0,
      currentTemp: 80,
      optimalTemp: (this.OPTIMAL_TEMP_MIN + this.OPTIMAL_TEMP_MAX) / 2,
      degradationRate: 0.01,
      estimatedLapsRemaining: 100,
      performance: 1.0,
    };
  }
}
