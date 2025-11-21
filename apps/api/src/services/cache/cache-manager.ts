/**
 * Cache Manager Service
 * Provides high-level caching operations for race engineer data
 */

import { redisService } from './redis-client.js';
import type { StrategyState } from '../strategy/types.js';

export class CacheManager {
  private readonly SESSION_PREFIX = 'session:';
  private readonly TELEMETRY_PREFIX = 'telemetry:';
  private readonly STRATEGY_PREFIX = 'strategy:';
  private readonly LEADERBOARD_PREFIX = 'leaderboard:';
  private readonly LAP_PREFIX = 'lap:';

  // Cache TTLs (in seconds)
  private readonly SESSION_TTL = 3600; // 1 hour
  private readonly TELEMETRY_TTL = 60; // 1 minute
  private readonly STRATEGY_TTL = 300; // 5 minutes
  private readonly LEADERBOARD_TTL = 10; // 10 seconds
  private readonly LAP_TTL = 3600; // 1 hour

  // Maximum list sizes
  private readonly MAX_TELEMETRY_HISTORY = 1000;
  private readonly MAX_LAP_HISTORY = 100;

  constructor(private redis: typeof redisService) {}

  /**
   * Cache session state
   */
  async cacheSession(sessionId: string, sessionData: any): Promise<void> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    await this.redis.set(key, sessionData, this.SESSION_TTL);
  }

  /**
   * Get cached session
   */
  async getSession<T>(sessionId: string): Promise<T | null> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    return await this.redis.get<T>(key);
  }

  /**
   * Delete session cache
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    await this.redis.delete(key);
  }

  /**
   * Cache current telemetry snapshot
   */
  async cacheTelemetry(sessionId: string, telemetryData: any): Promise<void> {
    const key = `${this.TELEMETRY_PREFIX}${sessionId}:current`;
    await this.redis.set(key, telemetryData, this.TELEMETRY_TTL);
  }

  /**
   * Add telemetry to history list
   */
  async addTelemetryToHistory(sessionId: string, telemetryData: any): Promise<void> {
    const key = `${this.TELEMETRY_PREFIX}${sessionId}:history`;
    await this.redis.listPush(key, telemetryData);

    // Trim list to max size
    const length = await this.redis.listLength(key);
    if (length > this.MAX_TELEMETRY_HISTORY) {
      await this.redis.listTrim(key, -this.MAX_TELEMETRY_HISTORY, -1);
    }

    // Set expiration
    await this.redis.expire(key, this.SESSION_TTL);
  }

  /**
   * Get recent telemetry history
   */
  async getTelemetryHistory<T>(
    sessionId: string,
    count: number = 60
  ): Promise<T[]> {
    const key = `${this.TELEMETRY_PREFIX}${sessionId}:history`;
    return await this.redis.listRange<T>(key, -count, -1);
  }

  /**
   * Get current telemetry
   */
  async getCurrentTelemetry<T>(sessionId: string): Promise<T | null> {
    const key = `${this.TELEMETRY_PREFIX}${sessionId}:current`;
    return await this.redis.get<T>(key);
  }

  /**
   * Cache strategy state
   */
  async cacheStrategy(sessionId: string, strategy: StrategyState): Promise<void> {
    const key = `${this.STRATEGY_PREFIX}${sessionId}`;
    await this.redis.set(key, strategy, this.STRATEGY_TTL);
  }

  /**
   * Get cached strategy
   */
  async getStrategy(sessionId: string): Promise<StrategyState | null> {
    const key = `${this.STRATEGY_PREFIX}${sessionId}`;
    return await this.redis.get<StrategyState>(key);
  }

  /**
   * Cache leaderboard/standings
   */
  async cacheLeaderboard(sessionId: string, leaderboard: any[]): Promise<void> {
    const key = `${this.LEADERBOARD_PREFIX}${sessionId}`;
    await this.redis.set(key, leaderboard, this.LEADERBOARD_TTL);
  }

  /**
   * Get cached leaderboard
   */
  async getLeaderboard<T>(sessionId: string): Promise<T[] | null> {
    const key = `${this.LEADERBOARD_PREFIX}${sessionId}`;
    return await this.redis.get<T[]>(key);
  }

  /**
   * Cache lap data
   */
  async cacheLap(sessionId: string, lapNumber: number, lapData: any): Promise<void> {
    const key = `${this.LAP_PREFIX}${sessionId}:${lapNumber}`;
    await this.redis.set(key, lapData, this.LAP_TTL);

    // Also add to lap history list
    const historyKey = `${this.LAP_PREFIX}${sessionId}:history`;
    await this.redis.listPush(historyKey, { lapNumber, ...lapData });

    // Trim history
    const length = await this.redis.listLength(historyKey);
    if (length > this.MAX_LAP_HISTORY) {
      await this.redis.listTrim(historyKey, -this.MAX_LAP_HISTORY, -1);
    }

    await this.redis.expire(historyKey, this.SESSION_TTL);
  }

  /**
   * Get lap data
   */
  async getLap<T>(sessionId: string, lapNumber: number): Promise<T | null> {
    const key = `${this.LAP_PREFIX}${sessionId}:${lapNumber}`;
    return await this.redis.get<T>(key);
  }

  /**
   * Get lap history
   */
  async getLapHistory<T>(sessionId: string, count: number = 10): Promise<T[]> {
    const key = `${this.LAP_PREFIX}${sessionId}:history`;
    return await this.redis.listRange<T>(key, -count, -1);
  }

  /**
   * Cache session statistic
   */
  async cacheSessionStat(
    sessionId: string,
    statName: string,
    value: any
  ): Promise<void> {
    const key = `${this.SESSION_PREFIX}${sessionId}:stat:${statName}`;
    await this.redis.set(key, value, this.SESSION_TTL);
  }

  /**
   * Get session statistic
   */
  async getSessionStat<T>(sessionId: string, statName: string): Promise<T | null> {
    const key = `${this.SESSION_PREFIX}${sessionId}:stat:${statName}`;
    return await this.redis.get<T>(key);
  }

  /**
   * Increment session counter
   */
  async incrementSessionCounter(
    sessionId: string,
    counterName: string,
    amount: number = 1
  ): Promise<number> {
    const key = `${this.SESSION_PREFIX}${sessionId}:counter:${counterName}`;
    const result = await this.redis.increment(key, amount);
    await this.redis.expire(key, this.SESSION_TTL);
    return result;
  }

  /**
   * Clear all session caches
   */
  async clearSession(sessionId: string): Promise<void> {
    const patterns = [
      `${this.SESSION_PREFIX}${sessionId}*`,
      `${this.TELEMETRY_PREFIX}${sessionId}*`,
      `${this.STRATEGY_PREFIX}${sessionId}*`,
      `${this.LEADERBOARD_PREFIX}${sessionId}*`,
      `${this.LAP_PREFIX}${sessionId}*`,
    ];

    for (const pattern of patterns) {
      await this.redis.deletePattern(pattern);
    }
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(): Promise<string[]> {
    const keys = await this.redis.keys(`${this.SESSION_PREFIX}*`);
    return keys.map((key) => key.replace(this.SESSION_PREFIX, '').split(':')[0]);
  }

  /**
   * Check if session is cached
   */
  async isSessionActive(sessionId: string): Promise<boolean> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    return await this.redis.exists(key);
  }

  /**
   * Refresh session TTL
   */
  async refreshSession(sessionId: string): Promise<void> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    await this.redis.expire(key, this.SESSION_TTL);
  }

  /**
   * Publish real-time event to subscribers
   */
  async publishEvent(channel: string, event: any): Promise<void> {
    await this.redis.publish(channel, event);
  }
}

// Singleton instance
export const cacheManager = new CacheManager(redisService);
