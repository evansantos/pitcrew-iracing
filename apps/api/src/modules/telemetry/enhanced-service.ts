/**
 * Enhanced Telemetry Service
 * Integrates telemetry processing with strategy engine, database persistence, and caching
 */

import { EventEmitter } from 'events';
import type { ProcessedTelemetry } from '@iracing-race-engineer/shared';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { StrategyEngine } from '../../services/strategy/index.js';
import type { SessionContext, LapData as StrategyLapData, GapAnalysis } from '../../services/strategy/types.js';
import { sessionManager } from '../session/session-manager.js';
import { cacheManager } from '../../services/cache/index.js';
import { RemoteTelemetryClient } from '../../services/remote-telemetry/relay-client.js';

// node-irsdk is optional (Windows-only)
let irsdk: any = null;
let isIrsdkAvailable = false;

try {
  const module = await import('node-irsdk');
  irsdk = module;
  isIrsdkAvailable = true;
  logger.info('node-irsdk loaded successfully');
} catch {
  logger.warn('node-irsdk not available (Windows only) - will use mock or remote mode');
}

export class EnhancedTelemetryService extends EventEmitter {
  private isConnected: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private strategyUpdateInterval: NodeJS.Timeout | null = null;
  private mode: 'local' | 'remote' | 'mock';
  private remoteClient: RemoteTelemetryClient | null = null;

  private strategyEngine: StrategyEngine;
  private lapHistory: StrategyLapData[] = [];
  private currentLap: number = 0;
  private lastLapTime: number = 0;
  private sessionContext: SessionContext | null = null;
  private telemetryCounter: number = 0;

  constructor() {
    super();
    this.strategyEngine = new StrategyEngine();
    this.mode = config.iracing.mode;

    logger.info(`EnhancedTelemetryService initialized in ${this.mode.toUpperCase()} mode`);
  }

  /**
   * Initialize connection to iRacing SDK (or mock/remote data source)
   */
  async connect(): Promise<void> {
    try {
      if (this.mode === 'remote') {
        await this.connectRemote();
      } else if (this.mode === 'mock') {
        await this.connectMock();
      } else {
        await this.connectLocal();
      }
    } catch (error) {
      logger.error({ error }, 'Failed to connect to telemetry source');
      throw error;
    }
  }

  /**
   * Connect to remote relay server
   */
  private async connectRemote(): Promise<void> {
    if (!config.iracing.relayHost) {
      throw new Error('IRACING_RELAY_HOST not configured');
    }

    logger.info({ host: config.iracing.relayHost, port: config.iracing.relayPort }, 'Connecting to remote telemetry relay...');

    this.remoteClient = new RemoteTelemetryClient({
      host: config.iracing.relayHost,
      port: config.iracing.relayPort,
    });

    // Handle remote telemetry
    this.remoteClient.on('telemetry', (data: ProcessedTelemetry) => {
      this.handleRemoteTelemetry(data);
    });

    this.remoteClient.on('connected', () => {
      logger.info('Connected to remote telemetry relay');
      this.isConnected = true;
      this.startStrategyUpdates();
    });

    this.remoteClient.on('disconnected', () => {
      logger.warn('Disconnected from remote telemetry relay');
      this.isConnected = false;
    });

    this.remoteClient.on('error', (error) => {
      logger.error({ error }, 'Remote telemetry error');
    });

    await this.remoteClient.connect();
  }

  /**
   * Connect to local iRacing SDK
   */
  private async connectLocal(): Promise<void> {
    if (!isIrsdkAvailable) {
      throw new Error('node-irsdk not available (Windows only)');
    }

    logger.info('Connecting to local iRacing SDK...');
    // TODO: Implement local iRacing SDK connection
    this.isConnected = true;
    this.startProcessing();
    this.startStrategyUpdates();
    logger.info('Connected to local iRacing SDK successfully');
  }

  /**
   * Connect to mock telemetry
   */
  private async connectMock(): Promise<void> {
    logger.info('Connecting to MOCK telemetry source...');

    // Initialize mock session
    await this.initializeMockSession();

    this.isConnected = true;
    this.startProcessing();
    this.startStrategyUpdates();

    logger.info('Connected to MOCK telemetry successfully');
  }

  /**
   * Initialize mock session for testing
   */
  private async initializeMockSession(): Promise<void> {
    const sessionId = `mock-${Date.now()}`;

    await sessionManager.startSession({
      sessionId,
      trackName: 'Watkins Glen International',
      carName: 'BMW M4 GT3',
      driverName: 'Mock Driver',
      sessionType: 'race',
      startTime: new Date(),
    });

    this.sessionContext = {
      sessionId,
      trackName: 'Watkins Glen International',
      carName: 'BMW M4 GT3',
      sessionType: 'race',
      totalLaps: 30,
      currentLap: 1,
      sessionTimeRemaining: 1800, // 30 minutes
      fuelCapacity: 100,
      tankCapacity: 100,
    };

    logger.info({ sessionId }, 'Mock session initialized');
  }

  /**
   * Initialize session from remote telemetry data
   */
  private async initializeRemoteSession(telemetryData: any): Promise<void> {
    const sessionId = `remote-${Date.now()}`;

    // Extract session info from telemetry
    const trackName = telemetryData.track?.name || 'Unknown Track';
    const carName = telemetryData.player?.carName || 'Unknown Car';
    const driverName = telemetryData.player?.driverName || 'Unknown Driver';

    // Determine session type from session data
    let sessionType: 'practice' | 'qualify' | 'race' = 'race';
    if (telemetryData.session?.type) {
      const type = telemetryData.session.type.toLowerCase();
      if (type.includes('practice')) sessionType = 'practice';
      else if (type.includes('qualify')) sessionType = 'qualify';
      else sessionType = 'race';
    }

    await sessionManager.startSession({
      sessionId,
      trackName,
      carName,
      driverName,
      sessionType,
      startTime: new Date(),
    });

    // Calculate total laps (if laps-based session)
    const totalLaps = telemetryData.session?.lapsRemaining
      ? telemetryData.session.lapsRemaining + (telemetryData.player?.lap || 0)
      : 0;

    this.sessionContext = {
      sessionId,
      trackName,
      carName,
      sessionType,
      totalLaps: totalLaps || 0,
      currentLap: telemetryData.player?.lap || 1,
      sessionTimeRemaining: telemetryData.session?.timeRemaining || 0,
      fuelCapacity: 100, // Default, can be refined later
      tankCapacity: 100,
    };

    logger.info({
      sessionId,
      trackName,
      carName,
      driverName,
      sessionType
    }, 'Remote session initialized');
  }

  /**
   * Disconnect from iRacing SDK
   */
  async disconnect(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.strategyUpdateInterval) {
      clearInterval(this.strategyUpdateInterval);
      this.strategyUpdateInterval = null;
    }

    // Disconnect remote client if active
    if (this.remoteClient) {
      this.remoteClient.disconnect();
      this.remoteClient = null;
    }

    // End session if active
    if (sessionManager.isSessionActive()) {
      await sessionManager.endSession();
    }

    this.isConnected = false;
    logger.info('Disconnected from telemetry source');
  }

  /**
   * Handle telemetry from remote relay
   */
  private async handleRemoteTelemetry(telemetryData: any): Promise<void> {
    // DEBUG: Log complete telemetry data structure
    logger.info({
      mode: telemetryData.mode,
      hasPlayer: !!telemetryData.player,
      hasSession: !!telemetryData.session,
      hasTrack: !!telemetryData.track,
      hasTelemetry: !!telemetryData.telemetry,
      hasDrivers: !!telemetryData.drivers,
      playerData: telemetryData.player ? {
        speed: telemetryData.player.speed,
        gear: telemetryData.player.gear,
        rpm: telemetryData.player.rpm,
        lap: telemetryData.player.lap
      } : null,
      rawDataKeys: Object.keys(telemetryData)
    }, 'DEBUG: Raw telemetry data from relay');

    // Check if this is SessionInfo data (spectating mode) or full telemetry (driving mode)
    const dataMode = (telemetryData as any).mode;

    if (dataMode === 'session_info') {
      // SPECTATING MODE - Limited data available
      await this.handleSessionInfo(telemetryData);
      return;
    }

    // DRIVING MODE - Full telemetry available
    // Initialize session if not already done
    if (!this.sessionContext && telemetryData.session && telemetryData.track) {
      await this.initializeRemoteSession(telemetryData);
    }

    // Update session context
    if (this.sessionContext && telemetryData.player) {
      this.sessionContext.currentLap = telemetryData.player.lap;
    }

    // Check for new lap
    if (telemetryData.player?.lap > this.currentLap && this.currentLap > 0) {
      await this.handleLapCompletion(telemetryData);
    }
    if (telemetryData.player?.lap) {
      this.currentLap = telemetryData.player.lap;
    }

    // Cache current telemetry
    if (this.sessionContext?.sessionId) {
      await cacheManager.cacheTelemetry(this.sessionContext.sessionId, telemetryData);

      // Add to telemetry history every 10th frame
      if (this.telemetryCounter % 10 === 0) {
        await cacheManager.addTelemetryToHistory(this.sessionContext.sessionId, telemetryData);
      }
    }

    // Record telemetry snapshot periodically
    if (this.telemetryCounter % 60 === 0) {
      await this.recordTelemetrySnapshot(telemetryData);
    }

    this.telemetryCounter++;

    // Emit telemetry event for WebSocket broadcasting
    this.emit('telemetry', telemetryData);
  }

  /**
   * Handle SessionInfo data (spectating mode)
   */
  private async handleSessionInfo(sessionData: any): Promise<void> {
    logger.info('Received SessionInfo data (spectating mode)');

    // Find player in drivers array
    const playerDriver = sessionData.drivers?.find((d: any) => d.isPlayer);

    if (playerDriver) {
      // Update current lap if available
      if (playerDriver.lap && playerDriver.lap !== this.currentLap) {
        logger.info({
          lap: playerDriver.lap,
          lastLapTime: playerDriver.lastLapTime,
          position: playerDriver.position
        }, 'Lap update from SessionInfo');

        this.currentLap = playerDriver.lap;
      }
    }

    // Emit session info for WebSocket broadcasting
    this.emit('telemetry', sessionData);
  }

  /**
   * Start processing telemetry data at 60Hz
   */
  private startProcessing(): void {
    const intervalMs = 1000 / 60; // 60Hz

    this.updateInterval = setInterval(() => {
      if (this.isConnected) {
        this.processTelemetry();
      }
    }, intervalMs);
  }

  /**
   * Start strategy updates at 1Hz (every second)
   */
  private startStrategyUpdates(): void {
    const intervalMs = 1000; // 1Hz

    this.strategyUpdateInterval = setInterval(() => {
      if (this.isConnected && this.sessionContext) {
        this.updateStrategy();
      }
    }, intervalMs);
  }

  /**
   * Process current telemetry frame
   */
  private async processTelemetry(): Promise<void> {
    if (this.mode === 'mock') {
      const { mockTelemetryGenerator } = await import('./mock-data.js');
      const telemetryData = mockTelemetryGenerator.generateFrame();

      // Update session context
      if (this.sessionContext) {
        this.sessionContext.currentLap = telemetryData.player.lap;
      }

      // Check for new lap
      if (telemetryData.player.lap > this.currentLap && this.currentLap > 0) {
        await this.handleLapCompletion(telemetryData);
      }
      this.currentLap = telemetryData.player.lap;

      // Cache current telemetry
      if (this.sessionContext?.sessionId) {
        await cacheManager.cacheTelemetry(this.sessionContext.sessionId, telemetryData);

        // Add to telemetry history every 10th frame (6Hz instead of 60Hz for storage)
        if (this.telemetryCounter % 10 === 0) {
          await cacheManager.addTelemetryToHistory(this.sessionContext.sessionId, telemetryData);
        }
      }

      // Record telemetry snapshot to database periodically (every 60 frames = 1 per second)
      if (this.telemetryCounter % 60 === 0) {
        await this.recordTelemetrySnapshot(telemetryData);
      }

      this.telemetryCounter++;

      // Emit telemetry event for WebSocket broadcasting
      this.emit('telemetry', telemetryData);
    } else {
      // TODO: Implement real iRacing SDK telemetry processing
    }
  }

  /**
   * Handle lap completion
   */
  private async handleLapCompletion(telemetryData: ProcessedTelemetry): Promise<void> {
    const lapTime = telemetryData.player.lastLapTime;

    if (lapTime <= 0) return;

    logger.info({ lap: this.currentLap, time: lapTime }, 'Lap completed');

    // Calculate tire wear and temp averages (use avgTemp and avgWear)
    const avgTireTemp = (
      (telemetryData.tires?.lf?.avgTemp || 0) +
      (telemetryData.tires?.rf?.avgTemp || 0) +
      (telemetryData.tires?.lr?.avgTemp || 0) +
      (telemetryData.tires?.rr?.avgTemp || 0)
    ) / 4;

    const avgTireWear = (
      (telemetryData.tires?.lf?.avgWear || 0) +
      (telemetryData.tires?.rf?.avgWear || 0) +
      (telemetryData.tires?.lr?.avgWear || 0) +
      (telemetryData.tires?.rr?.avgWear || 0)
    ) / 4;

    // Estimate fuel used (assume 2.5L per lap)
    const fuelUsed = 2.5;

    // Record lap in database
    await sessionManager.recordLap({
      lapNumber: this.currentLap,
      lapTime,
      isValidLap: true, // TODO: Determine validity based on incidents
      fuelUsed,
      fuelRemaining: telemetryData.fuel.level,
      avgTireTemp,
      avgTireWear,
      position: telemetryData.player.position,
      timestamp: new Date(),
    });

    // Add to lap history for strategy calculations
    const strategyLapData: StrategyLapData = {
      lapNumber: this.currentLap,
      lapTime,
      fuelUsed,
      fuelRemaining: telemetryData.fuel.level,
      isValidLap: true,
      avgTireTemp,
      avgTireWear,
      position: telemetryData.player.position,
      timestamp: new Date(),
    };

    this.lapHistory.push(strategyLapData);

    // Keep only last 20 laps for strategy
    if (this.lapHistory.length > 20) {
      this.lapHistory.shift();
    }
  }

  /**
   * Record telemetry snapshot to database
   */
  private async recordTelemetrySnapshot(telemetryData: ProcessedTelemetry): Promise<void> {
    // Sanitize data - ensure all required fields have valid values
    const safeInt = (value: any, defaultValue: number = 0): number => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(num) : defaultValue;
    };

    const safeFloat = (value: any, defaultValue: number = 0): number => {
      const num = Number(value);
      return Number.isFinite(num) ? num : defaultValue;
    };

    try {
      await sessionManager.recordTelemetrySnapshot({
        lapNumber: safeInt(telemetryData.player?.lap, 1),
        lapDistPct: safeFloat(telemetryData.player?.lapDistPct, 0),
        speed: safeFloat(telemetryData.player?.speed, 0),
        rpm: safeInt(telemetryData.player?.rpm, 0),
        gear: safeInt(telemetryData.player?.gear, 0),
        throttle: safeFloat(telemetryData.player?.throttle, 0),
        brake: safeFloat(telemetryData.player?.brake, 0),
        fuelLevel: safeFloat(telemetryData.fuel?.level),
        tireTempLF: safeFloat(telemetryData.tires?.lf?.avgTemp),
        tireTempRF: safeFloat(telemetryData.tires?.rf?.avgTemp),
        tireTempLR: safeFloat(telemetryData.tires?.lr?.avgTemp),
        tireTempRR: safeFloat(telemetryData.tires?.rr?.avgTemp),
        tireWearLF: safeFloat(telemetryData.tires?.lf?.avgWear),
        tireWearRF: safeFloat(telemetryData.tires?.rf?.avgWear),
        tireWearLR: safeFloat(telemetryData.tires?.lr?.avgWear),
        tireWearRR: safeFloat(telemetryData.tires?.rr?.avgWear),
        timestamp: new Date(),
      });
    } catch (error) {
      // Log but don't throw - telemetry snapshots are non-critical
      logger.debug({ error }, 'Failed to record telemetry snapshot (non-critical)');
    }
  }

  /**
   * Update strategy calculations
   */
  private async updateStrategy(): Promise<void> {
    if (!this.sessionContext || this.lapHistory.length === 0) {
      return;
    }

    try {
      const currentLapData = this.lapHistory[this.lapHistory.length - 1];

      // Generate gap analysis from opponents (mock for now)
      const gapAnalysis: GapAnalysis[] = [
        {
          carIdx: 1,
          driverName: 'Leader',
          position: 1,
          gapToPlayer: 12.5,
          gapTrend: 'stable',
          gapChangeRate: 0.1,
          lastLapTime: 90.5,
          bestLapTime: 89.2,
        },
        {
          carIdx: 3,
          driverName: 'Chaser',
          position: 3,
          gapToPlayer: -8.3,
          gapTrend: 'closing',
          gapChangeRate: -0.3,
          lastLapTime: 91.2,
          bestLapTime: 90.1,
        },
      ];

      // Calculate strategy
      const strategyState = this.strategyEngine.calculateStrategy(
        this.sessionContext,
        currentLapData,
        this.lapHistory,
        gapAnalysis,
        this.currentLap // tire laps = current lap for simplicity
      );

      // Cache strategy state
      await cacheManager.cacheStrategy(this.sessionContext.sessionId, strategyState);

      // Emit strategy update
      this.emit('strategy', strategyState);

      // Log recommendations
      if (strategyState.recommendations.length > 0) {
        logger.info({
          recommendations: strategyState.recommendations.map(r => ({
            type: r.type,
            title: r.title,
            severity: r.severity,
          })),
        }, 'Strategy recommendations updated');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to update strategy');
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; mode: string } {
    return {
      connected: this.isConnected,
      mode: this.mode,
    };
  }

  /**
   * Get current session context
   */
  getSessionContext(): SessionContext | null {
    return this.sessionContext;
  }
}

export const enhancedTelemetryService = new EnhancedTelemetryService();
