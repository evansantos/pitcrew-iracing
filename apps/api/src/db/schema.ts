import { pgTable, serial, varchar, timestamp, integer, real, boolean, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * Sessions table - stores race session information
 */
export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    sessionId: varchar('session_id', { length: 255 }).notNull().unique(),
    trackName: varchar('track_name', { length: 255 }).notNull(),
    carName: varchar('car_name', { length: 255 }).notNull(),
    driverName: varchar('driver_name', { length: 255 }).notNull(),
    sessionType: varchar('session_type', { length: 50 }).notNull(), // 'practice', 'qualify', 'race'
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time'),
    totalLaps: integer('total_laps'),
    bestLapTime: real('best_lap_time'),
    averageLapTime: real('average_lap_time'),
    finalPosition: integer('final_position'),
    isCompleted: boolean('is_completed').default(false),
    metadata: jsonb('metadata'), // Additional session data
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      sessionIdIdx: index('session_id_idx').on(table.sessionId),
      startTimeIdx: index('start_time_idx').on(table.startTime),
      driverNameIdx: index('driver_name_idx').on(table.driverName),
    };
  }
);

/**
 * Laps table - stores individual lap data
 */
export const laps = pgTable(
  'laps',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .references(() => sessions.id, { onDelete: 'cascade' })
      .notNull(),
    lapNumber: integer('lap_number').notNull(),
    lapTime: real('lap_time').notNull(),
    isValidLap: boolean('is_valid_lap').default(true),
    sector1Time: real('sector1_time'),
    sector2Time: real('sector2_time'),
    sector3Time: real('sector3_time'),
    fuelUsed: real('fuel_used'),
    fuelRemaining: real('fuel_remaining'),
    avgTireTemp: real('avg_tire_temp'),
    avgTireWear: real('avg_tire_wear'),
    incidentCount: integer('incident_count').default(0),
    position: integer('position'),
    timestamp: timestamp('timestamp').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      sessionIdIdx: index('laps_session_id_idx').on(table.sessionId),
      lapNumberIdx: index('laps_lap_number_idx').on(table.lapNumber),
      timestampIdx: index('laps_timestamp_idx').on(table.timestamp),
    };
  }
);

/**
 * Pit stops table - stores pit stop information
 */
export const pitStops = pgTable(
  'pit_stops',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .references(() => sessions.id, { onDelete: 'cascade' })
      .notNull(),
    lapNumber: integer('lap_number').notNull(),
    pitInTime: timestamp('pit_in_time').notNull(),
    pitOutTime: timestamp('pit_out_time'),
    stopDuration: real('stop_duration'), // in seconds
    fuelAdded: real('fuel_added'),
    tiresChanged: boolean('tires_changed').default(false),
    damageRepaired: boolean('damage_repaired').default(false),
    penaltyServed: boolean('penalty_served').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      sessionIdIdx: index('pit_stops_session_id_idx').on(table.sessionId),
      lapNumberIdx: index('pit_stops_lap_number_idx').on(table.lapNumber),
    };
  }
);

/**
 * Strategy recommendations table - stores AI-generated strategy suggestions
 */
export const strategyRecommendations = pgTable(
  'strategy_recommendations',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .references(() => sessions.id, { onDelete: 'cascade' })
      .notNull(),
    recommendationType: varchar('recommendation_type', { length: 50 }).notNull(), // 'pit_window', 'fuel', 'tire', 'undercut'
    title: varchar('title', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
    optimalLap: integer('optimal_lap'),
    windowStart: integer('window_start'),
    windowEnd: integer('window_end'),
    expectedGain: real('expected_gain'), // in seconds
    confidence: real('confidence'), // 0-1 scale
    metadata: jsonb('metadata'), // Additional recommendation data
    isActioned: boolean('is_actioned').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      sessionIdIdx: index('strategy_session_id_idx').on(table.sessionId),
      recommendationTypeIdx: index('strategy_type_idx').on(table.recommendationType),
      createdAtIdx: index('strategy_created_at_idx').on(table.createdAt),
    };
  }
);

/**
 * Telemetry snapshots table - stores periodic telemetry data for analysis
 */
export const telemetrySnapshots = pgTable(
  'telemetry_snapshots',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .references(() => sessions.id, { onDelete: 'cascade' })
      .notNull(),
    lapNumber: integer('lap_number').notNull(),
    lapDistPct: real('lap_dist_pct').notNull(),
    speed: real('speed').notNull(),
    rpm: integer('rpm').notNull(),
    gear: integer('gear').notNull(),
    throttle: real('throttle').notNull(),
    brake: real('brake').notNull(),
    steeringAngle: real('steering_angle'),
    fuelLevel: real('fuel_level'),
    tireTempLF: real('tire_temp_lf'),
    tireTempRF: real('tire_temp_rf'),
    tireTempLR: real('tire_temp_lr'),
    tireTempRR: real('tire_temp_rr'),
    tireWearLF: real('tire_wear_lf'),
    tireWearRF: real('tire_wear_rf'),
    tireWearLR: real('tire_wear_lr'),
    tireWearRR: real('tire_wear_rr'),
    timestamp: timestamp('timestamp').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      sessionIdIdx: index('telemetry_session_id_idx').on(table.sessionId),
      lapNumberIdx: index('telemetry_lap_number_idx').on(table.lapNumber),
      timestampIdx: index('telemetry_timestamp_idx').on(table.timestamp),
    };
  }
);

/**
 * Opponents table - stores opponent data for analysis
 */
export const opponents = pgTable(
  'opponents',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .references(() => sessions.id, { onDelete: 'cascade' })
      .notNull(),
    carIdx: integer('car_idx').notNull(),
    driverName: varchar('driver_name', { length: 255 }).notNull(),
    carNumber: varchar('car_number', { length: 50 }).notNull(),
    carClass: varchar('car_class', { length: 100 }).notNull(),
    bestLapTime: real('best_lapTime'),
    lastLapTime: real('last_lap_time'),
    currentLap: integer('current_lap'),
    position: integer('position'),
    classPosition: integer('class_position'),
    lapsCompleted: integer('laps_completed'),
    timestamp: timestamp('timestamp').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      sessionIdIdx: index('opponents_session_id_idx').on(table.sessionId),
      carIdxIdx: index('opponents_car_idx_idx').on(table.carIdx),
      timestampIdx: index('opponents_timestamp_idx').on(table.timestamp),
    };
  }
);

/**
 * Incidents table - stores racing incidents
 */
export const incidents = pgTable(
  'incidents',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .references(() => sessions.id, { onDelete: 'cascade' })
      .notNull(),
    lapNumber: integer('lap_number').notNull(),
    incidentType: varchar('incident_type', { length: 50 }).notNull(), // 'contact', 'off_track', 'loss_of_control'
    severity: varchar('severity', { length: 20 }).notNull(), // 'minor', 'moderate', 'major'
    damageLevel: real('damage_level'), // 0-1 scale
    timestamp: timestamp('timestamp').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      sessionIdIdx: index('incidents_session_id_idx').on(table.sessionId),
      lapNumberIdx: index('incidents_lap_number_idx').on(table.lapNumber),
    };
  }
);

// Export types for use in the application
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Lap = typeof laps.$inferSelect;
export type NewLap = typeof laps.$inferInsert;

export type PitStop = typeof pitStops.$inferSelect;
export type NewPitStop = typeof pitStops.$inferInsert;

export type StrategyRecommendation = typeof strategyRecommendations.$inferSelect;
export type NewStrategyRecommendation = typeof strategyRecommendations.$inferInsert;

export type TelemetrySnapshot = typeof telemetrySnapshots.$inferSelect;
export type NewTelemetrySnapshot = typeof telemetrySnapshots.$inferInsert;

export type Opponent = typeof opponents.$inferSelect;
export type NewOpponent = typeof opponents.$inferInsert;

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
