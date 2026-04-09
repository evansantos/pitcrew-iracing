import { describe, it, expect } from 'vitest';
import { PitModel } from '../pit-model.js';

describe('PitModel', () => {
  // Test 1: calculatePitTime with fuel only (no tire change)
  it('calculatePitTime with fuel only uses fuel fill time when no tire change', () => {
    const model = new PitModel();
    // fuelFillTime = 20 / 0.5 = 40s, tireTime = 0
    // total = 25 + max(40, 0) = 65
    const result = model.calculatePitTime({
      pitLaneTime: 25,
      fuelAmount: 20,
      fillRate: 0.5,
      tireChange: false,
    });
    expect(result).toBe(65);
  });

  // Test 2: calculatePitTime with tire change (parallel timing, fuel wins)
  it('calculatePitTime with tire change adds tire time in parallel when fuel takes longer', () => {
    const model = new PitModel();
    // fuelFillTime = 10 / 0.5 = 20s, tireTime = 3s (default)
    // total = 25 + max(20, 3) = 45
    const result = model.calculatePitTime({
      pitLaneTime: 25,
      fuelAmount: 10,
      fillRate: 0.5,
      tireChange: true,
    });
    expect(result).toBe(45);
  });

  // Test 3: calculatePitTime where tire change takes longer than fueling
  it('calculatePitTime uses tire change time when it exceeds fuel fill time', () => {
    const model = new PitModel({ tireChangeTime: 10 });
    // fuelFillTime = 1 / 0.5 = 2s, tireTime = 10s
    // total = 25 + max(2, 10) = 35
    const result = model.calculatePitTime({
      pitLaneTime: 25,
      fuelAmount: 1,
      fillRate: 0.5,
      tireChange: true,
    });
    expect(result).toBe(35);
  });

  // Test 4: optimizeFuelLoad calculates minimum fuel with safety margin
  it('optimizeFuelLoad adds 1-lap safety margin to minimum fuel', () => {
    const model = new PitModel();
    // stintLaps=10, fuelPerLap=2.5 => minimumFuel = (10+1)*2.5 = 27.5
    const result = model.optimizeFuelLoad(10, 2.5, 100);
    expect(result.fuelLoad).toBe(27.5);
    expect(result.stintLaps).toBe(10);
  });

  // Test 5: optimizeFuelLoad caps at tank capacity
  it('optimizeFuelLoad caps fuel load at tank capacity', () => {
    const model = new PitModel();
    // minimumFuel = (20+1)*3 = 63, but tankCapacity = 50
    const result = model.optimizeFuelLoad(20, 3, 50);
    expect(result.fuelLoad).toBe(50);
  });

  // Test 6: optimizeFuelLoad returns time impact from fuel weight
  it('optimizeFuelLoad returns correct time impact from fuel weight', () => {
    const model = new PitModel({ fuelWeightEffect: 0.03 });
    // stintLaps=10, fuelPerLap=2.5 => fuelLoad=27.5
    // timeImpact = 27.5 * 0.03 * 10 / 2 = 4.125
    const result = model.optimizeFuelLoad(10, 2.5, 100);
    expect(result.timeImpact).toBeCloseTo(4.125, 5);
  });

  // Test 7: whatIf recommends staying out when fuel covers remaining laps with low degradation
  it('whatIf recommends staying out when degradation cost is less than pit stop time', () => {
    const model = new PitModel({ pitLaneTime: 25, fuelWeightEffect: 0.001 });
    // Few laps remaining, low fuel = low degradation, pit stop time outweighs staying out
    // currentFuel=6, fuelPerLap=2, lapsOfFuel=3; currentLap=17, totalLaps=20, lapsRemaining=3
    // Staying out 3 laps: degradation is small, no additional pit needed
    // Pitting now: 25s pit lane time + 3 laps at base pace
    const result = model.whatIf(6, 2, 17, 20, 90);
    // pitNowTime includes pit lane time, pitLaterTime avoids it if lapsAfterPit=0
    expect(result.recommendation).toMatch(/Stay out/);
  });

  // Test 8: whatIf recommends pitting when staying out incurs heavy degradation
  it('whatIf recommends pitting now when tire degradation makes staying out costly', () => {
    const model = new PitModel({ pitLaneTime: 25, fuelWeightEffect: 0.03 });
    // Many laps of fuel = many degraded laps before pit
    // currentFuel=40, fuelPerLap=2, lapsOfFuel=20; currentLap=0, totalLaps=30, lapsRemaining=30
    // Staying out 20 laps with progressive degradation (0.05*i per lap) + fuel weight
    // Then pit + 10 more laps
    // vs Pit now + 30 clean laps
    const result = model.whatIf(40, 2, 0, 30, 90);
    // With 20 degraded laps, pit now should be faster
    expect(result.delta).toBeLessThan(0);
    expect(result.recommendation).toBe('Pit now');
  });

  // Test 9: whatIf delta is consistent with pitNowTime - pitLaterTime
  it('whatIf returns delta equal to pitNowTime - pitLaterTime', () => {
    const model = new PitModel({ pitLaneTime: 25, fuelWeightEffect: 0.03 });
    const result = model.whatIf(20, 2, 10, 25, 90);
    expect(result.delta).toBeCloseTo(result.pitNowTime - result.pitLaterTime, 10);
  });

  // Test 10: constructor uses custom parameters
  it('constructor uses custom parameters over defaults', () => {
    const model = new PitModel({
      pitLaneTime: 30,
      fillRate: 1.0,
      tireChangeTime: 5,
      fuelWeightEffect: 0.05,
    });
    // calculatePitTime: fuelFillTime = 20 / 1.0 = 20s, tireTime = 5s
    // total = 30 + max(20, 5) = 50
    const pitTime = model.calculatePitTime({
      pitLaneTime: 30,
      fuelAmount: 20,
      fillRate: 1.0,
      tireChange: true,
    });
    expect(pitTime).toBe(50);

    // optimizeFuelLoad: timeImpact = 10 * 0.05 * 5 / 2 = 1.25
    const { timeImpact } = model.optimizeFuelLoad(5, 2, 100);
    // fuelLoad = (5+1)*2 = 12, timeImpact = 12 * 0.05 * 5 / 2 = 1.5
    expect(timeImpact).toBeCloseTo(1.5, 5);
  });
});
