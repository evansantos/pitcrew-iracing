/**
 * Fuel Strategy Calculator
 * Calculates fuel requirements, pit windows, and fuel-saving strategies
 */

import type { LapData, SessionContext, FuelStrategy } from './types.js';

export class FuelCalculator {
  private readonly SAFETY_MARGIN = 0.5; // 0.5 liters safety margin
  private readonly PIT_STOP_TIME_LOSS = 25; // seconds lost in pit stop

  /**
   * Calculate fuel strategy for the session
   */
  calculateFuelStrategy(
    recentLaps: LapData[],
    sessionContext: SessionContext
  ): FuelStrategy {
    const validLaps = recentLaps.filter((lap) => lap.isValidLap && lap.fuelUsed > 0);

    if (validLaps.length === 0) {
      return this.getDefaultStrategy(sessionContext);
    }

    const fuelPerLap = this.calculateAverageFuelPerLap(validLaps);
    const currentFuel = validLaps[validLaps.length - 1]?.fuelRemaining || 0;
    const lapsRemaining = sessionContext.totalLaps - sessionContext.currentLap;

    const requiredFuel = fuelPerLap * lapsRemaining;
    const refuelRequired = requiredFuel + this.SAFETY_MARGIN > currentFuel;

    let refuelAmount = 0;
    let estimatedPitLap = 0;

    if (refuelRequired) {
      refuelAmount = Math.max(0, requiredFuel + this.SAFETY_MARGIN - currentFuel);
      estimatedPitLap = this.calculateOptimalPitLap(
        currentFuel,
        fuelPerLap,
        lapsRemaining,
        sessionContext
      );
    }

    return {
      requiredFuel,
      currentFuel,
      fuelPerLap,
      lapsRemaining,
      refuelRequired,
      refuelAmount: Math.min(refuelAmount, sessionContext.tankCapacity),
      safetySafetyMargin: this.SAFETY_MARGIN,
      estimatedPitLap,
    };
  }

  /**
   * Calculate average fuel consumption per lap
   */
  private calculateAverageFuelPerLap(laps: LapData[]): number {
    if (laps.length === 0) return 0;

    // Use weighted average, giving more weight to recent laps
    const weights = laps.map((_, idx) => Math.pow(1.1, idx));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    const weightedSum = laps.reduce((sum, lap, idx) => {
      return sum + lap.fuelUsed * weights[idx];
    }, 0);

    return weightedSum / totalWeight;
  }

  /**
   * Calculate optimal lap for pit stop based on fuel
   */
  private calculateOptimalPitLap(
    currentFuel: number,
    fuelPerLap: number,
    lapsRemaining: number,
    context: SessionContext
  ): number {
    // Calculate how many laps we can do with current fuel
    const lapsOnCurrentFuel = Math.floor(
      (currentFuel - this.SAFETY_MARGIN) / fuelPerLap
    );

    // If we can finish the race, no pit needed
    if (lapsOnCurrentFuel >= lapsRemaining) {
      return 0;
    }

    // Calculate optimal pit lap
    // Try to pit as late as possible while maintaining safety margin
    const optimalLap = context.currentLap + Math.max(1, lapsOnCurrentFuel - 2);

    return Math.min(optimalLap, context.totalLaps - 1);
  }

  /**
   * Calculate fuel required to finish from current position
   */
  calculateFuelToFinish(
    currentFuel: number,
    fuelPerLap: number,
    lapsRemaining: number
  ): number {
    const requiredFuel = fuelPerLap * lapsRemaining;
    return Math.max(0, requiredFuel + this.SAFETY_MARGIN - currentFuel);
  }

  /**
   * Estimate laps remaining with current fuel
   */
  estimateLapsRemaining(currentFuel: number, fuelPerLap: number): number {
    if (fuelPerLap <= 0) return 0;
    return Math.floor((currentFuel - this.SAFETY_MARGIN) / fuelPerLap);
  }

  /**
   * Calculate fuel save target per lap
   */
  calculateFuelSaveTarget(
    currentFuel: number,
    fuelPerLap: number,
    lapsRemaining: number
  ): number {
    const fuelDeficit = this.calculateFuelToFinish(
      currentFuel,
      fuelPerLap,
      lapsRemaining
    );

    if (fuelDeficit <= 0) return 0;

    // Calculate how much fuel to save per lap
    return fuelDeficit / lapsRemaining;
  }

  /**
   * Get default strategy when no lap data is available
   */
  private getDefaultStrategy(context: SessionContext): FuelStrategy {
    // Assume 2.5 liters per lap as default
    const defaultFuelPerLap = 2.5;
    const lapsRemaining = context.totalLaps - context.currentLap;

    return {
      requiredFuel: defaultFuelPerLap * lapsRemaining,
      currentFuel: context.fuelCapacity,
      fuelPerLap: defaultFuelPerLap,
      lapsRemaining,
      refuelRequired: false,
      refuelAmount: 0,
      safetySafetyMargin: this.SAFETY_MARGIN,
      estimatedPitLap: 0,
    };
  }
}
