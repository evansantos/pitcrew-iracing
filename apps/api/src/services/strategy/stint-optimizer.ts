/**
 * Multi-stint tire compound strategy optimizer.
 * Uses dynamic programming to find optimal stint splits given race parameters.
 */

export interface CompoundData {
  name: string;        // e.g., 'Soft', 'Medium', 'Hard'
  wearRate: number;    // % per lap (e.g., 1.5 for Soft)
  paceDelta: number;   // seconds vs baseline (negative = faster, e.g., -0.5 for Soft)
  degradationK: number; // quadratic degradation coefficient
}

export interface RaceParams {
  totalLaps: number;
  currentLap: number;
  compounds: CompoundData[];
  pitStopTime: number;  // seconds (from PitModel)
  fuelPerLap: number;   // liters
  baseLapTime: number;  // seconds
  maxStintLaps?: number; // max laps on one set of tires (default: 100 / wearRate)
}

export interface Stint {
  compound: string;
  startLap: number;
  endLap: number;
  laps: number;
  expectedTime: number; // total stint time in seconds
}

export interface StintPlan {
  stints: Stint[];
  totalTime: number;
  pitStops: number;
}

const DEFAULT_COMPOUNDS: CompoundData[] = [
  { name: 'Soft', wearRate: 1.5, paceDelta: -0.5, degradationK: 0.003 },
  { name: 'Medium', wearRate: 0.8, paceDelta: 0, degradationK: 0.001 },
  { name: 'Hard', wearRate: 0.5, paceDelta: 0.3, degradationK: 0.0005 },
];

/**
 * Calculate expected lap time on a given compound at a given tire age.
 * lapTime = baseLapTime + paceDelta + degradationK * tireAge^2
 */
function lapTime(baseLapTime: number, compound: CompoundData, tireAge: number): number {
  return baseLapTime + compound.paceDelta + compound.degradationK * tireAge * tireAge;
}

/**
 * Calculate total stint time for a given compound and stint length.
 */
function stintTime(baseLapTime: number, compound: CompoundData, stintLaps: number): number {
  let total = 0;
  for (let age = 0; age < stintLaps; age++) {
    total += lapTime(baseLapTime, compound, age);
  }
  return total;
}

/**
 * Max stint length for a compound (when tire wear reaches 100%).
 */
function maxStintForCompound(compound: CompoundData, override?: number): number {
  if (override) return override;
  return Math.floor(100 / compound.wearRate);
}

/**
 * Optimize stint strategy using dynamic programming.
 * Returns the top 3 strategies sorted by total time.
 */
export function optimizeStints(params: RaceParams): StintPlan[] {
  const {
    totalLaps,
    currentLap,
    compounds,
    pitStopTime,
    baseLapTime,
    maxStintLaps,
  } = params;

  const remainingLaps = totalLaps - currentLap;
  if (remainingLaps <= 0) return [];
  if (compounds.length === 0) return [];

  const activeCompounds = compounds.length > 0 ? compounds : DEFAULT_COMPOUNDS;

  // DP: dp[lapsRemaining] = { totalTime, plan }
  // For each number of remaining laps, find the best strategy.
  // We try all possible first-stint lengths and compounds, then recurse.
  interface DPEntry {
    totalTime: number;
    stints: Stint[];
    pitStops: number;
  }

  const cache = new Map<number, DPEntry[]>();

  function solve(lapsLeft: number, lapOffset: number): DPEntry[] {
    if (lapsLeft <= 0) return [{ totalTime: 0, stints: [], pitStops: 0 }];

    const cacheKey = lapsLeft;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;

    const candidates: DPEntry[] = [];

    for (const compound of activeCompounds) {
      const maxStint = Math.min(lapsLeft, maxStintForCompound(compound, maxStintLaps));

      for (let stintLen = Math.min(maxStint, lapsLeft); stintLen >= Math.min(5, lapsLeft); stintLen--) {
        const sTime = stintTime(baseLapTime, compound, stintLen);
        const stint: Stint = {
          compound: compound.name,
          startLap: currentLap + lapOffset,
          endLap: currentLap + lapOffset + stintLen,
          laps: stintLen,
          expectedTime: sTime,
        };

        const remaining = lapsLeft - stintLen;

        if (remaining === 0) {
          // No more stints needed
          candidates.push({
            totalTime: sTime,
            stints: [stint],
            pitStops: 0,
          });
        } else if (remaining >= 3) {
          // Need another stint (minimum 3 laps)
          const subResults = solve(remaining, lapOffset + stintLen);
          for (const sub of subResults) {
            candidates.push({
              totalTime: sTime + pitStopTime + sub.totalTime,
              stints: [stint, ...sub.stints],
              pitStops: 1 + sub.pitStops,
            });
          }
        }
      }
    }

    // Sort by total time and keep top 3
    candidates.sort((a, b) => a.totalTime - b.totalTime);
    const best = candidates.slice(0, 3);
    cache.set(cacheKey, best);
    return best;
  }

  const results = solve(remainingLaps, 0);

  return results.map(r => ({
    stints: r.stints,
    totalTime: Math.round(r.totalTime * 1000) / 1000,
    pitStops: r.pitStops,
  }));
}

export { DEFAULT_COMPOUNDS };
