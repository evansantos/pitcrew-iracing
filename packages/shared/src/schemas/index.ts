import { z } from 'zod';

/**
 * Zod schemas for runtime validation
 */

export const TelemetryUpdateSchema = z.object({
  timestamp: z.number(),
  sessionTime: z.number(),
  player: z.object({
    speed: z.number(),
    rpm: z.number(),
    gear: z.number(),
    throttle: z.number(),
    brake: z.number(),
    lap: z.number(),
    lapDistPct: z.number(),
    currentLapTime: z.number(),
    lastLapTime: z.number(),
    bestLapTime: z.number(),
    position: z.number(),
    classPosition: z.number(),
  }),
  fuel: z.object({
    level: z.number(),
    levelPct: z.number(),
    usePerHour: z.number(),
    lapsRemaining: z.number(),
  }),
});

export const OpponentDataSchema = z.object({
  carIdx: z.number(),
  driverName: z.string(),
  carNumber: z.string(),
  carClass: z.string(),
  lap: z.number(),
  lapDistPct: z.number(),
  position: z.number(),
  classPosition: z.number(),
  lastLapTime: z.number(),
  bestLapTime: z.number(),
  estimatedLapTime: z.number(),
  gapToPlayer: z.number(),
  gapToLeader: z.number(),
  isOnPitRoad: z.boolean(),
  pitStopCount: z.number(),
});

export const SessionInfoSchema = z.object({
  sessionId: z.string(),
  sessionType: z.enum(['practice', 'qualifying', 'race', 'time_trial', 'lone_qualifying']),
  trackName: z.string(),
  trackId: z.number(),
  trackLength: z.number(),
  startTime: z.date(),
  duration: z.number(),
  laps: z.number(),
  multiClass: z.boolean(),
  classes: z.array(z.string()),
});

export const StrategyRecommendationSchema = z.object({
  timestamp: z.number(),
  sessionTime: z.number(),
  pitWindow: z.object({
    optimal: z.object({
      lapStart: z.number(),
      lapEnd: z.number(),
      sessionTime: z.number(),
    }),
    currentStatus: z.enum(['early', 'optimal', 'late', 'critical']),
    reasoning: z.array(z.string()),
  }),
  fuelStrategy: z.object({
    lapsRemaining: z.number(),
    fuelRemaining: z.number(),
    canFinish: z.boolean(),
    savingRequired: z.boolean(),
  }),
});
