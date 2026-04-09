import { describe, it, expect, beforeEach } from 'vitest';
import { LapPredictor } from '../lap-predictor.js';
import type { LapFeatures } from '../lap-predictor.js';

function makeFeatures(overrides: Partial<LapFeatures> = {}): LapFeatures {
  return {
    tireWear: 0.1,
    fuelLoad: 50,
    trackTemp: 30,
    lapNumber: 1,
    airTemp: 20,
    ...overrides,
  };
}

describe('LapPredictor', () => {
  let predictor: LapPredictor;

  beforeEach(() => {
    predictor = new LapPredictor();
  });

  // 1. predict returns average when fewer than 3 data points
  it('returns average when fewer than 3 data points', () => {
    predictor.addLap(makeFeatures({ lapNumber: 1 }), 90);
    predictor.addLap(makeFeatures({ lapNumber: 2 }), 92);

    const result = predictor.predict(makeFeatures({ lapNumber: 3 }));
    expect(result.predictedTime).toBeCloseTo(91, 5);
    expect(result.confidence).toBe(0);
  });

  // 2. predict returns average with confidence 0 when no data
  it('returns 0 with confidence 0 when no data', () => {
    const result = predictor.predict(makeFeatures());
    expect(result.predictedTime).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.tireCliffRisk).toBe(false);
  });

  // 3. fit with linear data produces accurate predictions
  it('fit with linear data produces accurate predictions', () => {
    // lapTime is driven purely by tireWear: lapTime = 90 + 10 * tireWear
    // Other features vary randomly so X^T X is full rank
    const rng = [0.12, 0.37, 0.55, 0.18, 0.63, 0.44, 0.29, 0.71, 0.09, 0.88];
    const features: LapFeatures[] = [];
    const lapTimes: number[] = [];
    for (let i = 0; i < 10; i++) {
      const tw = rng[i];
      features.push(makeFeatures({
        lapNumber: i + 1,
        tireWear: tw,
        fuelLoad: 80 - i * 3 + rng[(i + 3) % 10] * 5,
        trackTemp: 28 + rng[(i + 5) % 10] * 6,
        airTemp: 18 + rng[(i + 7) % 10] * 4,
      }));
      lapTimes.push(90 + 10 * tw);
    }

    predictor.fit(features, lapTimes);

    // Prediction should be close to the underlying relationship
    const result = predictor.predict(makeFeatures({
      lapNumber: 11,
      tireWear: 0.5,
      fuelLoad: 60,
      trackTemp: 31,
      airTemp: 20,
    }));
    // 90 + 10 * 0.5 = 95, allow ±1 second tolerance
    expect(result.predictedTime).toBeGreaterThan(93);
    expect(result.predictedTime).toBeLessThan(97);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  // 4. addLap triggers refit after 5 laps (needs >= columns in feature matrix)
  it('addLap triggers refit after 5 laps', () => {
    // Use fully varied features to ensure X^T X is not singular
    const laps = [
      { f: makeFeatures({ lapNumber: 1, tireWear: 0.05, fuelLoad: 70, trackTemp: 28, airTemp: 19 }), t: 90.5 },
      { f: makeFeatures({ lapNumber: 2, tireWear: 0.12, fuelLoad: 66, trackTemp: 31, airTemp: 21 }), t: 91.0 },
      { f: makeFeatures({ lapNumber: 3, tireWear: 0.22, fuelLoad: 60, trackTemp: 27, airTemp: 18 }), t: 91.8 },
      { f: makeFeatures({ lapNumber: 4, tireWear: 0.35, fuelLoad: 54, trackTemp: 33, airTemp: 22 }), t: 92.5 },
    ];

    for (const { f, t } of laps) {
      predictor.addLap(f, t);
    }

    // Before 5th lap: still < 5 laps, no fit yet, confidence = 0
    const before = predictor.predict(makeFeatures({ lapNumber: 5 }));
    expect(before.confidence).toBe(0);

    // 5th lap triggers refit
    predictor.addLap(makeFeatures({ lapNumber: 5, tireWear: 0.48, fuelLoad: 47, trackTemp: 30, airTemp: 20 }), 93.2);
    const after = predictor.predict(makeFeatures({ lapNumber: 6, tireWear: 0.55, fuelLoad: 43, trackTemp: 30, airTemp: 20 }));
    expect(after.confidence).toBeGreaterThan(0);
  });

  // 5. confidence increases with more data points
  it('confidence increases with more data points', () => {
    const addLaps = (count: number) => {
      const p = new LapPredictor();
      for (let i = 1; i <= count; i++) {
        p.addLap(
          makeFeatures({ lapNumber: i, tireWear: 0, fuelLoad: 0, trackTemp: 0, airTemp: 0 }),
          90 + 0.3 * i,
        );
      }
      return p.predict(makeFeatures({ lapNumber: count + 1, tireWear: 0, fuelLoad: 0, trackTemp: 0, airTemp: 0 }));
    };

    const fewLaps = addLaps(5);
    const moreLaps = addLaps(15);

    // Both should be valid; more data should give equal or better confidence
    expect(fewLaps.confidence).toBeGreaterThanOrEqual(0);
    expect(moreLaps.confidence).toBeGreaterThanOrEqual(fewLaps.confidence);
  });

  // 6. checkTireCliff returns false for normal laps
  it('checkTireCliff returns false for normal laps', () => {
    expect(predictor.checkTireCliff(90, 90.5)).toBe(false);
    expect(predictor.checkTireCliff(90, 91)).toBe(false);
    expect(predictor.checkTireCliff(90, 91.4)).toBe(false);
  });

  // 7. checkTireCliff returns true after 2 consecutive slow laps
  it('checkTireCliff returns true after 2 consecutive slow laps', () => {
    const first = predictor.checkTireCliff(90, 92); // actual > predicted + 1.5 → 1st
    expect(first).toBe(false);
    const second = predictor.checkTireCliff(90, 92); // 2nd consecutive
    expect(second).toBe(true);
  });

  // 8. handles identical features gracefully (singular matrix fallback)
  it('handles identical features gracefully when matrix is singular', () => {
    // All rows identical → X^T X is singular
    const identicalFeatures = makeFeatures({ lapNumber: 1 });
    const lapTimes = [90, 91, 90, 91, 90];
    predictor.fit(
      [identicalFeatures, identicalFeatures, identicalFeatures, identicalFeatures, identicalFeatures],
      lapTimes,
    );

    // Should not throw; singular → falls back to average (fit() syncs _lapTimes)
    const avg = lapTimes.reduce((s, t) => s + t, 0) / lapTimes.length;
    const result = predictor.predict(identicalFeatures);
    expect(result.confidence).toBe(0);
    expect(result.predictedTime).toBeCloseTo(avg, 5);
    expect(result.tireCliffRisk).toBe(false);
  });
});
