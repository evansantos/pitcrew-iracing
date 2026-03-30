/**
 * Session Manager Service
 * Handles session lifecycle and in-memory session state management.
 *
 * Note: Database persistence (Drizzle/PG) was removed in the Docker cleanup refactor.
 * Session data is now tracked in-memory only. A future iteration may add
 * file-based or SQLite persistence if needed.
 */

import { logger } from '../../utils/logger.js';

export interface SessionData {
  sessionId: string;
  trackName: string;
  carName: string;
  driverName: string;
  sessionType: 'practice' | 'qualify' | 'race';
  startTime: Date;
}

export interface LapData {
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
  private currentSession: SessionData | null = null;
  private currentSessionId: string | null = null;
  private lapHistory: Map<number, LapData> = new Map();

  /**
   * Start a new racing session
   */
  async startSession(sessionData: SessionData): Promise<void> {
    logger.info({ sessionId: sessionData.sessionId }, 'Starting new session');
    this.currentSession = sessionData;
    this.currentSessionId = sessionData.sessionId;
    this.lapHistory.clear();
    logger.info({ sessionId: sessionData.sessionId }, 'Session started successfully');
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSessionId) {
      logger.warn('No active session to end');
      return;
    }

    logger.info({ sessionId: this.currentSessionId }, 'Ending session');
    this.currentSession = null;
    this.currentSessionId = null;
    this.lapHistory.clear();
    logger.info('Session ended');
  }

  /**
   * Record a completed lap
   */
  async recordLap(lapData: LapData): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }
    this.lapHistory.set(lapData.lapNumber, lapData);
    logger.debug({ lapNumber: lapData.lapNumber, lapTime: lapData.lapTime }, 'Lap recorded');
  }

  /**
   * Get recent laps for strategy calculations
   */
  async getRecentLaps(count: number = 10): Promise<LapData[]> {
    const allLaps = Array.from(this.lapHistory.values())
      .sort((a, b) => a.lapNumber - b.lapNumber);
    return allLaps.slice(-count);
  }

  /**
   * Get current session info
   */
  getCurrentSession(): { sessionId: string | null } {
    return {
      sessionId: this.currentSessionId,
    };
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.currentSessionId !== null;
  }

  /**
   * Clean up old data (no-op without database)
   */
  async cleanupOldData(_olderThanDays: number = 7): Promise<{
    sessionsDeleted: number;
    lapsDeleted: number;
    snapshotsDeleted: number;
  }> {
    logger.info('cleanupOldData is a no-op without database persistence');
    return { sessionsDeleted: 0, lapsDeleted: 0, snapshotsDeleted: 0 };
  }

  /**
   * Clean up all data (clears in-memory state)
   */
  async cleanupAllData(): Promise<void> {
    this.currentSession = null;
    this.currentSessionId = null;
    this.lapHistory.clear();
    logger.info('All in-memory session data cleared');
  }
}

export const sessionManager = new SessionManager();
