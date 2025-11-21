/**
 * Session Manager Service
 * Handles session lifecycle, database persistence, and session state management
 */

import { db } from '../../db/index.js';
import { sessions, laps, pitStops, telemetrySnapshots, opponents, incidents } from '../../db/schema.js';
import type { NewSession, NewLap, NewPitStop, NewTelemetrySnapshot, NewOpponent, NewIncident } from '../../db/schema.js';
import { eq, desc, inArray, lt } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import { cacheManager } from '../../services/cache/index.js';

export interface SessionData {
  sessionId: string;
  trackName: string;
  carName: string;
  driverName: string;
  sessionType: 'practice' | 'qualify' | 'race';
  startTime: Date;
}

export interface LapData {
  sessionDbId: number;
  lapNumber: number;
  lapTime: number;
  isValidLap: boolean;
  sector1Time?: number;
  sector2Time?: number;
  sector3Time?: number;
  fuelUsed?: number;
  fuelRemaining?: number;
  avgTireTemp?: number;
  avgTireWear?: number;
  incidentCount?: number;
  position?: number;
  timestamp: Date;
}

export class SessionManager {
  private currentSessionDbId: number | null = null;
  private currentSessionId: string | null = null;
  private sessionStartTime: Date | null = null;
  private lapHistory: Map<number, any> = new Map();

  /**
   * Start a new racing session
   */
  async startSession(sessionData: SessionData): Promise<number> {
    try {
      logger.info({ sessionId: sessionData.sessionId }, 'Starting new session');

      const newSession: NewSession = {
        sessionId: sessionData.sessionId,
        trackName: sessionData.trackName,
        carName: sessionData.carName,
        driverName: sessionData.driverName,
        sessionType: sessionData.sessionType,
        startTime: sessionData.startTime,
        isCompleted: false,
        totalLaps: 0,
      };

      const result = await db.insert(sessions).values(newSession).returning({ id: sessions.id });

      this.currentSessionDbId = result[0].id;
      this.currentSessionId = sessionData.sessionId;
      this.sessionStartTime = sessionData.startTime;

      // Cache session data
      await cacheManager.cacheSession(sessionData.sessionId, {
        dbId: this.currentSessionDbId,
        ...sessionData,
      });

      logger.info({ sessionId: sessionData.sessionId, dbId: this.currentSessionDbId }, 'Session started successfully');

      return this.currentSessionDbId;
    } catch (error) {
      logger.error({ error, sessionData }, 'Failed to start session');
      throw error;
    }
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSessionDbId || !this.currentSessionId) {
      logger.warn('No active session to end');
      return;
    }

    try {
      logger.info({ sessionId: this.currentSessionId }, 'Ending session');

      // Calculate session statistics
      const sessionLaps = await db.query.laps.findMany({
        where: eq(laps.sessionId, this.currentSessionDbId),
        orderBy: [desc(laps.lapNumber)],
      });

      const validLaps = sessionLaps.filter(lap => lap.isValidLap);
      const bestLap = validLaps.length > 0
        ? Math.min(...validLaps.map(lap => lap.lapTime))
        : null;

      const avgLap = validLaps.length > 0
        ? validLaps.reduce((sum, lap) => sum + lap.lapTime, 0) / validLaps.length
        : null;

      // Update session record
      await db.update(sessions)
        .set({
          endTime: new Date(),
          isCompleted: true,
          totalLaps: sessionLaps.length,
          bestLapTime: bestLap,
          averageLapTime: avgLap,
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, this.currentSessionDbId));

      // Clear cache
      await cacheManager.clearSession(this.currentSessionId);

      logger.info({
        sessionId: this.currentSessionId,
        totalLaps: sessionLaps.length,
        bestLap,
      }, 'Session ended successfully');

      this.currentSessionDbId = null;
      this.currentSessionId = null;
      this.sessionStartTime = null;
      this.lapHistory.clear();
    } catch (error) {
      logger.error({ error }, 'Failed to end session');
      throw error;
    }
  }

  /**
   * Record a completed lap
   */
  async recordLap(lapData: Omit<LapData, 'sessionDbId'>): Promise<void> {
    if (!this.currentSessionDbId) {
      throw new Error('No active session');
    }

    try {
      const newLap: NewLap = {
        sessionId: this.currentSessionDbId,
        lapNumber: lapData.lapNumber,
        lapTime: lapData.lapTime,
        isValidLap: lapData.isValidLap,
        sector1Time: lapData.sector1Time,
        sector2Time: lapData.sector2Time,
        sector3Time: lapData.sector3Time,
        fuelUsed: lapData.fuelUsed,
        fuelRemaining: lapData.fuelRemaining,
        avgTireTemp: lapData.avgTireTemp,
        avgTireWear: lapData.avgTireWear,
        incidentCount: lapData.incidentCount || 0,
        position: lapData.position,
        timestamp: lapData.timestamp,
      };

      await db.insert(laps).values(newLap);

      // Cache lap data
      if (this.currentSessionId) {
        await cacheManager.cacheLap(this.currentSessionId, lapData.lapNumber, lapData);
      }

      // Store in memory for quick access
      this.lapHistory.set(lapData.lapNumber, lapData);

      logger.debug({ lapNumber: lapData.lapNumber, lapTime: lapData.lapTime }, 'Lap recorded');
    } catch (error) {
      logger.error({ error, lapData }, 'Failed to record lap');
      throw error;
    }
  }

  /**
   * Record a pit stop
   */
  async recordPitStop(data: {
    lapNumber: number;
    pitInTime: Date;
    pitOutTime?: Date;
    stopDuration?: number;
    fuelAdded?: number;
    tiresChanged?: boolean;
    damageRepaired?: boolean;
  }): Promise<void> {
    if (!this.currentSessionDbId) {
      throw new Error('No active session');
    }

    try {
      const newPitStop: NewPitStop = {
        sessionId: this.currentSessionDbId,
        lapNumber: data.lapNumber,
        pitInTime: data.pitInTime,
        pitOutTime: data.pitOutTime,
        stopDuration: data.stopDuration,
        fuelAdded: data.fuelAdded,
        tiresChanged: data.tiresChanged || false,
        damageRepaired: data.damageRepaired || false,
      };

      await db.insert(pitStops).values(newPitStop);

      logger.info({ lapNumber: data.lapNumber }, 'Pit stop recorded');
    } catch (error) {
      logger.error({ error, data }, 'Failed to record pit stop');
      throw error;
    }
  }

  /**
   * Record telemetry snapshot
   */
  async recordTelemetrySnapshot(data: {
    lapNumber: number;
    lapDistPct: number;
    speed: number;
    rpm: number;
    gear: number;
    throttle: number;
    brake: number;
    steeringAngle?: number;
    fuelLevel?: number;
    tireTempLF?: number;
    tireTempRF?: number;
    tireTempLR?: number;
    tireTempRR?: number;
    tireWearLF?: number;
    tireWearRF?: number;
    tireWearLR?: number;
    tireWearRR?: number;
    timestamp: Date;
  }): Promise<void> {
    if (!this.currentSessionDbId) {
      return; // Silently skip if no session
    }

    try {
      const newSnapshot: NewTelemetrySnapshot = {
        sessionId: this.currentSessionDbId,
        lapNumber: data.lapNumber,
        lapDistPct: data.lapDistPct,
        speed: data.speed,
        rpm: data.rpm,
        gear: data.gear,
        throttle: data.throttle,
        brake: data.brake,
        steeringAngle: data.steeringAngle,
        fuelLevel: data.fuelLevel,
        tireTempLF: data.tireTempLF,
        tireTempRF: data.tireTempRF,
        tireTempLR: data.tireTempLR,
        tireTempRR: data.tireTempRR,
        tireWearLF: data.tireWearLF,
        tireWearRF: data.tireWearRF,
        tireWearLR: data.tireWearLR,
        tireWearRR: data.tireWearRR,
        timestamp: data.timestamp,
      };

      await db.insert(telemetrySnapshots).values(newSnapshot);
    } catch (error) {
      logger.error({ error }, 'Failed to record telemetry snapshot');
      // Don't throw - telemetry snapshots are non-critical
    }
  }

  /**
   * Record opponent data
   */
  async recordOpponent(data: {
    carIdx: number;
    driverName: string;
    carNumber: string;
    carClass: string;
    bestLapTime?: number;
    lastLapTime?: number;
    currentLap?: number;
    position?: number;
    classPosition?: number;
    lapsCompleted?: number;
    timestamp: Date;
  }): Promise<void> {
    if (!this.currentSessionDbId) {
      return;
    }

    try {
      const newOpponent: NewOpponent = {
        sessionId: this.currentSessionDbId,
        carIdx: data.carIdx,
        driverName: data.driverName,
        carNumber: data.carNumber,
        carClass: data.carClass,
        bestLapTime: data.bestLapTime,
        lastLapTime: data.lastLapTime,
        currentLap: data.currentLap,
        position: data.position,
        classPosition: data.classPosition,
        lapsCompleted: data.lapsCompleted,
        timestamp: data.timestamp,
      };

      await db.insert(opponents).values(newOpponent);
    } catch (error) {
      logger.error({ error }, 'Failed to record opponent data');
    }
  }

  /**
   * Record incident
   */
  async recordIncident(data: {
    lapNumber: number;
    incidentType: 'contact' | 'off_track' | 'loss_of_control';
    severity: 'minor' | 'moderate' | 'major';
    damageLevel?: number;
    timestamp: Date;
  }): Promise<void> {
    if (!this.currentSessionDbId) {
      return;
    }

    try {
      const newIncident: NewIncident = {
        sessionId: this.currentSessionDbId,
        lapNumber: data.lapNumber,
        incidentType: data.incidentType,
        severity: data.severity,
        damageLevel: data.damageLevel,
        timestamp: data.timestamp,
      };

      await db.insert(incidents).values(newIncident);

      logger.warn({ lapNumber: data.lapNumber, type: data.incidentType }, 'Incident recorded');
    } catch (error) {
      logger.error({ error }, 'Failed to record incident');
    }
  }

  /**
   * Get recent laps for strategy calculations
   */
  async getRecentLaps(count: number = 10): Promise<any[]> {
    if (!this.currentSessionDbId) {
      return [];
    }

    try {
      const recentLaps = await db.query.laps.findMany({
        where: eq(laps.sessionId, this.currentSessionDbId),
        orderBy: [desc(laps.lapNumber)],
        limit: count,
      });

      return recentLaps.reverse(); // Return in chronological order
    } catch (error) {
      logger.error({ error }, 'Failed to get recent laps');
      return [];
    }
  }

  /**
   * Get current session info
   */
  getCurrentSession(): { sessionDbId: number | null; sessionId: string | null } {
    return {
      sessionDbId: this.currentSessionDbId,
      sessionId: this.currentSessionId,
    };
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.currentSessionDbId !== null;
  }

  /**
   * Clean up old sessions and telemetry data
   * @param olderThanDays Delete sessions older than this many days (default: 7)
   */
  async cleanupOldData(olderThanDays: number = 7): Promise<{
    sessionsDeleted: number;
    lapsDeleted: number;
    snapshotsDeleted: number;
  }> {
    try {
      logger.info({ olderThanDays }, 'Starting database cleanup');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Find old sessions
      const oldSessions = await db
        .select()
        .from(sessions)
        .where(lt(sessions.startTime, cutoffDate));

      if (oldSessions.length === 0) {
        logger.info('No old sessions to clean up');
        return { sessionsDeleted: 0, lapsDeleted: 0, snapshotsDeleted: 0 };
      }

      const oldSessionIds = oldSessions.map(s => s.id);

      // Delete related data (cascading delete)
      // Delete telemetry snapshots
      await db.delete(telemetrySnapshots)
        .where(inArray(telemetrySnapshots.sessionId, oldSessionIds));

      // Delete laps
      await db.delete(laps)
        .where(inArray(laps.sessionId, oldSessionIds));

      // Delete pit stops
      await db.delete(pitStops)
        .where(inArray(pitStops.sessionId, oldSessionIds));

      // Delete opponents
      await db.delete(opponents)
        .where(inArray(opponents.sessionId, oldSessionIds));

      // Delete incidents
      await db.delete(incidents)
        .where(inArray(incidents.sessionId, oldSessionIds));

      // Delete sessions
      await db.delete(sessions)
        .where(inArray(sessions.id, oldSessionIds));

      logger.info({
        sessionsDeleted: oldSessions.length,
        cutoffDate: cutoffDate.toISOString(),
      }, 'Database cleanup completed');

      return {
        sessionsDeleted: oldSessions.length,
        lapsDeleted: 0, // Count not available without extra query
        snapshotsDeleted: 0, // Count not available without extra query
      };
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup old data');
      throw error;
    }
  }

  /**
   * Clean up all data (use with caution!)
   */
  async cleanupAllData(): Promise<void> {
    try {
      logger.warn('Cleaning up ALL database data');

      await db.delete(telemetrySnapshots);
      await db.delete(laps);
      await db.delete(pitStops);
      await db.delete(opponents);
      await db.delete(incidents);
      await db.delete(sessions);

      logger.info('All database data cleaned up');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup all data');
      throw error;
    }
  }
}

export const sessionManager = new SessionManager();
