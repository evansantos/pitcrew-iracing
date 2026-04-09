/**
 * Pit Strategy Model
 * Calculates pit stop times, fuel optimization, and what-if pit scenarios
 */

export interface PitParams {
  pitLaneTime: number;   // seconds (default 25)
  fuelAmount: number;    // liters to add
  fillRate: number;      // liters/sec (default 0.5)
  tireChange: boolean;   // whether changing tires (adds 3s)
}

export interface FuelOptResult {
  fuelLoad: number;      // liters to add
  stintLaps: number;     // laps this fuel covers
  timeImpact: number;    // seconds gained/lost from fuel weight
}

export interface WhatIfResult {
  pitNowTime: number;      // total race time if pit now
  pitLaterTime: number;    // total race time if pit in N laps
  delta: number;           // positive = pit now costs more time
  recommendation: string;  // human-readable advice
}

export interface PitModelOptions {
  pitLaneTime?: number;
  fillRate?: number;
  tireChangeTime?: number;
  fuelWeightEffect?: number;
}

export class PitModel {
  private readonly pitLaneTime: number;
  private readonly fillRate: number;
  private readonly tireChangeTime: number;
  private readonly fuelWeightEffect: number;

  constructor(options: PitModelOptions = {}) {
    this.pitLaneTime = options.pitLaneTime ?? 25;
    this.fillRate = options.fillRate ?? 0.5;
    this.tireChangeTime = options.tireChangeTime ?? 3;
    this.fuelWeightEffect = options.fuelWeightEffect ?? 0.03;
  }

  /**
   * Calculate total pit stop time given pit parameters.
   * Fueling and tire change happen in parallel; only the longer one counts.
   */
  calculatePitTime(params: PitParams): number {
    const fuelFillTime = params.fuelAmount / params.fillRate;
    const tireTime = params.tireChange ? this.tireChangeTime : 0;
    return params.pitLaneTime + Math.max(fuelFillTime, tireTime);
  }

  /**
   * Determine optimal fuel load for a stint.
   * Adds 1-lap safety margin and caps at tank capacity.
   */
  optimizeFuelLoad(
    stintLaps: number,
    fuelPerLap: number,
    tankCapacity: number
  ): FuelOptResult {
    const minimumFuel = (stintLaps + 1) * fuelPerLap;
    const fuelLoad = Math.min(minimumFuel, tankCapacity);

    // Average weight over stint: start with fuelLoad, end with ~0; average = fuelLoad/2
    const timeImpact = fuelLoad * this.fuelWeightEffect * stintLaps / 2;

    return {
      fuelLoad,
      stintLaps,
      timeImpact,
    };
  }

  /**
   * Compare pitting now vs staying out N more laps then pitting.
   * N = laps of fuel remaining (floor division).
   */
  whatIf(
    currentFuel: number,
    fuelPerLap: number,
    currentLap: number,
    totalLaps: number,
    baseLapTime: number
  ): WhatIfResult {
    const lapsRemaining = totalLaps - currentLap;

    // Scenario A: pit now
    // Pit stop time + remaining laps on fresh tires at base pace
    const pitNowTime = this.pitLaneTime + lapsRemaining * baseLapTime;

    // Scenario B: stay out N more laps on degrading tires, then pit
    // N = laps of fuel remaining
    const lapsOfFuel = fuelPerLap > 0 ? Math.floor(currentFuel / fuelPerLap) : 0;
    const lapsBeforePit = Math.min(lapsOfFuel, lapsRemaining);
    const lapsAfterPit = lapsRemaining - lapsBeforePit;

    // Staying out incurs tire degradation + fuel weight penalty on current stint
    // Model: each additional lap on old tires adds degradation (0.05s per lap squared)
    // and fuel weight costs fuelWeightEffect per kg per lap
    let stayOutTime = 0;
    for (let i = 0; i < lapsBeforePit; i++) {
      const degradation = 0.05 * (i + 1); // progressive tire deg
      const fuelWeight = (currentFuel - i * fuelPerLap) * this.fuelWeightEffect;
      stayOutTime += baseLapTime + degradation + fuelWeight;
    }

    const pitLaterTime =
      stayOutTime +
      (lapsAfterPit > 0 ? this.pitLaneTime : 0) +
      lapsAfterPit * baseLapTime;

    const delta = pitNowTime - pitLaterTime;

    let recommendation: string;
    if (delta < 0) {
      recommendation = 'Pit now';
    } else {
      recommendation = `Stay out ${lapsBeforePit} more laps`;
    }

    return {
      pitNowTime,
      pitLaterTime,
      delta,
      recommendation,
    };
  }
}
