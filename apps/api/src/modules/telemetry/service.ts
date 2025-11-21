import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

// node-irsdk is optional (Windows-only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let irsdk: any = null;
let isIrsdkAvailable = false;

// Dynamically import node-irsdk (only available on Windows)
try {
  const module = await import('node-irsdk');
  irsdk = module;
  isIrsdkAvailable = true;
  logger.info('node-irsdk loaded successfully');
} catch {
  logger.warn('node-irsdk not available (Windows only) - telemetry will use mock data');
}

/**
 * TelemetryService - Core service for processing iRacing telemetry data
 *
 * Responsibilities:
 * - Connect to iRacing SDK via node-irsdk (Windows only)
 * - Process telemetry at 60Hz
 * - Emit events for real-time data streaming
 * - Track opponent positions and lap times
 * - Detect pit stops and track events
 *
 * Note: On non-Windows platforms, this service will operate in mock mode
 */
export class TelemetryService extends EventEmitter {
  private isConnected: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private mockMode: boolean = !isIrsdkAvailable;

  constructor() {
    super();
    if (this.mockMode) {
      logger.info('TelemetryService initialized in MOCK mode (development)');
    }
  }

  /**
   * Initialize connection to iRacing SDK (or mock data source)
   */
  async connect(): Promise<void> {
    try {
      if (this.mockMode) {
        logger.info('Connecting to MOCK telemetry source...');
        this.isConnected = true;
        this.startProcessing();
        logger.info('Connected to MOCK telemetry successfully');
      } else {
        // TODO: Initialize node-irsdk connection
        logger.info('Connecting to iRacing SDK...');
        // const iracing = irsdk.init();
        // Wait for iRacing to be running
        this.isConnected = true;
        this.startProcessing();
        logger.info('Connected to iRacing SDK successfully');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to connect to telemetry source');
      throw error;
    }
  }

  /**
   * Disconnect from iRacing SDK
   */
  async disconnect(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isConnected = false;
    logger.info('Disconnected from iRacing SDK');
  }

  /**
   * Start processing telemetry data at configured rate
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
   * Process current telemetry frame
   */
  private async processTelemetry(): Promise<void> {
    if (this.mockMode) {
      // Generate mock telemetry data
      const { mockTelemetryGenerator } = await import('./mock-data.js');
      const telemetryData = mockTelemetryGenerator.generateFrame();

      // Emit telemetry event for WebSocket broadcasting
      this.emit('telemetry', telemetryData);
    } else {
      // TODO: Implement real iRacing SDK telemetry processing
      // 1. Read current data from iRacing SDK
      // 2. Parse and validate data
      // 3. Calculate deltas and track changes
      // 4. Emit events for subscribers
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean } {
    return { connected: this.isConnected };
  }
}

export const telemetryService = new TelemetryService();
