import { describe, it, expect } from 'vitest';
import { FuelCalculator } from '../fuel-calculator.js';
import type { LapData, SessionContext } from '../types.js';

function makeLap(overrides: Partial<LapData> = {}): LapData {
  return {
    lapNumber: 5,
    lapTime: 90,
    fuelUsed: 2.5,
    fuelRemaining: 50,
    isValidLap: true,
    position: 3,
    timestamp: new Date(),
    ...overrides,
  };
}

function makeContext(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    sessionId: 'test-session',
    trackName: 'Spa',
    carName: 'GT3',
    sessionType: 'race',
    totalLaps: 30,
    currentLap: 10,
    sessionTimeRemaining: 3600,
    fuelCapacity: 120,
    tankCapacity: 120,
    ...overrides,
  };
}

describe('FuelCalculator', () => {
  const calc = new FuelCalculator();

  describe('calculateFuelStrategy', () => {
    it('returns default strategy when no valid laps', () => {
      const result = calc.calculateFuelStrategy([], makeContext());
      expect(result.fuelPerLap).toBe(2.5);
      expect(result.refuelRequired).toBe(false);
    });

    it('returns default strategy when all laps are invalid', () => {
      const laps = [makeLap({ isValidLap: false }), makeLap({ fuelUsed: 0 })];
      const result = calc.calculateFuelStrategy(laps, makeContext());
      expect(result.fuelPerLap).toBe(2.5);
    });

    it('calculates fuel strategy with valid laps', () => {
      const laps = [
        makeLap({ fuelUsed: 2.5, fuelRemaining: 50 }),
        makeLap({ fuelUsed: 2.6, fuelRemaining: 47.4 }),
        makeLap({ fuelUsed: 2.4, fuelRemaining: 45.0 }),
      ];
      const ctx = makeContext({ totalLaps: 30, currentLap: 10 });
      const result = calc.calculateFuelStrategy(laps, ctx);

      expect(result.fuelPerLap).toBeGreaterThan(0);
      expect(result.lapsRemaining).toBe(20);
      expect(result.currentFuel).toBe(45.0);
    });

    it('detects when refuel is required', () => {
      const laps = [makeLap({ fuelUsed: 3.0, fuelRemaining: 10 })];
      const ctx = makeContext({ totalLaps: 50, currentLap: 5 });
      const result = calc.calculateFuelStrategy(laps, ctx);

      expect(result.refuelRequired).toBe(true);
      expect(result.refuelAmount).toBeGreaterThan(0);
    });

    it('detects when no refuel is needed', () => {
      const laps = [makeLap({ fuelUsed: 1.0, fuelRemaining: 100 })];
      const ctx = makeContext({ totalLaps: 15, currentLap: 10 });
      const result = calc.calculateFuelStrategy(laps, ctx);

      expect(result.refuelRequired).toBe(false);
      expect(result.refuelAmount).toBe(0);
    });

    it('caps refuel amount at tank capacity', () => {
      const laps = [makeLap({ fuelUsed: 5.0, fuelRemaining: 5 })];
      const ctx = makeContext({ totalLaps: 100, currentLap: 5, tankCapacity: 50 });
      const result = calc.calculateFuelStrategy(laps, ctx);

      expect(result.refuelAmount).toBeLessThanOrEqual(50);
    });
  });

  describe('calculateFuelToFinish', () => {
    it('returns 0 when fuel is sufficient', () => {
      const result = calc.calculateFuelToFinish(100, 2.5, 10);
      expect(result).toBe(0);
    });

    it('returns deficit when fuel is insufficient', () => {
      const result = calc.calculateFuelToFinish(10, 2.5, 10);
      expect(result).toBeCloseTo(15.5, 1);
    });

    it('handles 0 fuelPerLap', () => {
      const result = calc.calculateFuelToFinish(10, 0, 10);
      expect(result).toBe(0);
    });

    it('handles 0 laps remaining', () => {
      const result = calc.calculateFuelToFinish(10, 2.5, 0);
      expect(result).toBe(0);
    });
  });

  describe('estimateLapsRemaining', () => {
    it('returns correct estimate', () => {
      const result = calc.estimateLapsRemaining(25, 2.5);
      expect(result).toBe(9);
    });

    it('returns 0 when fuelPerLap is 0', () => {
      expect(calc.estimateLapsRemaining(25, 0)).toBe(0);
    });

    it('returns 0 when fuelPerLap is negative', () => {
      expect(calc.estimateLapsRemaining(25, -1)).toBe(0);
    });
  });

  describe('calculateFuelSaveTarget', () => {
    it('returns 0 when no saving needed', () => {
      expect(calc.calculateFuelSaveTarget(100, 2.5, 10)).toBe(0);
    });

    it('calculates save target when deficit exists', () => {
      const result = calc.calculateFuelSaveTarget(20, 2.5, 10);
      expect(result).toBeCloseTo(0.55, 2);
    });

    it('returns 0 when lapsRemaining is 0', () => {
      expect(calc.calculateFuelSaveTarget(5, 2.5, 0)).toBe(0);
    });

    it('returns 0 when lapsRemaining is negative', () => {
      expect(calc.calculateFuelSaveTarget(5, 2.5, -1)).toBe(0);
    });
  });
});
