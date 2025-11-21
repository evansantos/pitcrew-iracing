/**
 * Remote Telemetry Relay Client
 * Connects to a remote Windows machine running iRacing via WebSocket
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

export interface RelayConfig {
  host: string; // Windows machine IP/hostname
  port: number; // WebSocket port
  reconnectInterval?: number;
  timeout?: number;
}

export class RemoteTelemetryClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: RelayConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private shouldReconnect: boolean = true;

  constructor(config: RelayConfig) {
    super();
    this.config = {
      reconnectInterval: 5000, // 5 seconds
      timeout: 10000, // 10 seconds
      ...config,
    };
  }

  /**
   * Connect to remote telemetry relay
   */
  async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      logger.warn('Already connected or connecting to remote telemetry');
      return;
    }

    this.isConnecting = true;
    const url = `ws://${this.config.host}:${this.config.port}`;

    logger.info({ url }, 'Connecting to remote telemetry relay...');

    try {
      this.ws = new WebSocket(url, {
        handshakeTimeout: this.config.timeout,
      });

      this.ws.on('open', () => {
        logger.info('Connected to remote telemetry relay');
        this.isConnecting = false;
        this.emit('connected');

        // Send initial handshake
        this.send({ type: 'handshake', version: '1.0' });
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          logger.error({ error }, 'Failed to parse telemetry message');
        }
      });

      this.ws.on('error', (error) => {
        logger.error({ error }, 'Remote telemetry WebSocket error');
        this.isConnecting = false;
      });

      this.ws.on('close', (code, reason) => {
        logger.warn({ code, reason: reason.toString() }, 'Remote telemetry connection closed');
        this.isConnecting = false;
        this.ws = null;

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }

        this.emit('disconnected');
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create WebSocket connection');
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from remote telemetry relay
   */
  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    logger.info('Disconnected from remote telemetry relay');
  }

  /**
   * Handle incoming message from relay
   */
  private handleMessage(message: any): void {
    switch (message.type) {
      case 'handshake_ack':
        logger.info('Handshake acknowledged by relay');
        // Request telemetry stream
        this.send({ type: 'subscribe', channels: ['telemetry'] });
        break;

      case 'telemetry':
        // Emit telemetry data to listeners
        this.emit('telemetry', message.data);
        break;

      case 'session':
        // Session state changed
        this.emit('session', message.data);
        break;

      case 'error':
        logger.error({ error: message.error }, 'Remote telemetry error');
        this.emit('error', message.error);
        break;

      default:
        logger.debug({ type: message.type }, 'Unknown message type');
    }
  }

  /**
   * Send message to relay
   */
  private send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      logger.warn('Cannot send message, WebSocket not connected');
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    logger.info(
      { interval: this.config.reconnectInterval },
      'Scheduling reconnection to remote telemetry'
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.config.reconnectInterval);
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
