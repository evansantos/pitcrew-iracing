import { describe, it, expect } from 'vitest';
import { optimizeStints, DEFAULT_COMPOUNDS } from '../stint-optimizer.js';
import type { CompoundData, RaceParams } from '../stint-optimizer.js';

function makeParams(overrides: Partial<RaceParams> = {}): RaceParams {
  return {
    totalLaps: 30,
    currentLap: 0,
    compounds: DEFAULT_COMPOUNDS,
    pitStopTime: 25,
    fuelPerLap: 2,
    baseLapTime: 90,
    ...overrides,
  };
}

describe('stint-optimizer', () => {
  it('returns empty for zero remaining laps', () => {
    const result = optimizeStints(makeParams({ totalLaps: 5, currentLap: 5 }));
    expect(result).toEqual([]);
  });

  it('returns empty for no compounds', () => {
    const result = optimizeStints(makeParams({ compounds: [] }));
    expect(result).toEqual([]);
  });

  it('returns a single-stint plan when no pit is optimal', () => {
    // Short race on hard tires — should not need to pit
    const result = optimizeStints(makeParams({ totalLaps: 10, currentLap: 0 }));
    expect(result.length).toBeGreaterThan(0);
    // At least one plan should have 0 pit stops
    const noPitPlan = result.find(p => p.pitStops === 0);
    expect(noPitPlan).toBeDefined();
  });

  it('returns plans with pit stops for long races', () => {
    // 60 laps — soft tires max ~66 laps but degradation makes pitting optimal
    const result = optimizeStints(makeParams({ totalLaps: 60 }));
    expect(result.length).toBeGreaterThan(0);
    // Should have at least one multi-stint plan
    const multiStint = result.find(p => p.pitStops > 0);
    expect(multiStint).toBeDefined();
  });

  it('returns up to 3 alternative strategies', () => {
    const result = optimizeStints(makeParams({ totalLaps: 40 }));
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('sorts strategies by total time ascending', () => {
    const result = optimizeStints(makeParams({ totalLaps: 40 }));
    for (let i = 1; i < result.length; i++) {
      expect(result[i].totalTime).toBeGreaterThanOrEqual(result[i - 1].totalTime);
    }
  });

  it('stints cover all remaining laps with no gaps', () => {
    const params = makeParams({ totalLaps: 30, currentLap: 5 });
    const result = optimizeStints(params);
    for (const plan of result) {
      const totalStintLaps = plan.stints.reduce((sum, s) => sum + s.laps, 0);
      expect(totalStintLaps).toBe(25); // 30 - 5 remaining
    }
  });

  it('includes pit stop time in total time for multi-stint plans', () => {
    const result = optimizeStints(makeParams({ totalLaps: 50, pitStopTime: 30 }));
    const multiStint = result.find(p => p.pitStops > 0);
    if (multiStint) {
      const drivingTime = multiStint.stints.reduce((sum, s) => sum + s.expectedTime, 0);
      const expectedTotal = drivingTime + multiStint.pitStops * 30;
      expect(multiStint.totalTime).toBeCloseTo(expectedTotal, 1);
    }
  });

  it('soft compound has faster lap times but higher degradation', () => {
    const soft = DEFAULT_COMPOUNDS.find(c => c.name === 'Soft')!;
    const hard = DEFAULT_COMPOUNDS.find(c => c.name === 'Hard')!;
    expect(soft.paceDelta).toBeLessThan(hard.paceDelta);
    expect(soft.degradationK).toBeGreaterThan(hard.degradationK);
  });

  it('handles single-compound races', () => {
    const single: CompoundData[] = [{ name: 'Prime', wearRate: 1.0, paceDelta: 0, degradationK: 0.001 }];
    const result = optimizeStints(makeParams({ compounds: single, totalLaps: 20 }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].stints.every(s => s.compound === 'Prime')).toBe(true);
  });
});
