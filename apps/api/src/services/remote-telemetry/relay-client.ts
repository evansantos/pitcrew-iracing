/**
 * Remote Telemetry Relay Client
 * Connects to a remote Windows machine running iRacing via WebSocket.
 * Supports Protocol v2 with heartbeat and exponential backoff reconnection.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

export interface RelayConfig {
  host: string;
  port: number;
  /** Initial reconnect delay in ms (default 1000) */
  reconnectBaseMs?: number;
  /** Max reconnect delay in ms (default 30000) */
  reconnectMaxMs?: number;
  /** Connection timeout in ms (default 10000) */
  timeout?: number;
}

export class RemoteTelemetryClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<RelayConfig>;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private shouldReconnect: boolean = true;
  private reconnectAttempt: number = 0;
  private negotiatedVersion: string = '1.0';

  constructor(config: RelayConfig) {
    super();
    this.config = {
      reconnectBaseMs: 1000,
      reconnectMaxMs: 30000,
      timeout: 10000,
      ...config,
    };
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      logger.warn('Already connected or connecting to remote telemetry');
      return;
    }

    this.isConnecting = true;
    const url = `ws://${this.config.host}:${this.config.port}`;

    logger.info({ url, attempt: this.reconnectAttempt }, 'Connecting to remote telemetry relay...');

    try {
      this.ws = new WebSocket(url, {
        handshakeTimeout: this.config.timeout,
      });

      this.ws.on('open', () => {
        logger.info('Connected to remote telemetry relay');
        this.isConnecting = false;
        this.reconnectAttempt = 0; // reset on successful connect
        this.emit('connected');

        // Send v2 handshake
        this.send({
          type: 'handshake',
          version: '2.0',
          payload: {
            requestedVersion: '2.0',
            encoding: ['json'],
          },
          timestamp: Date.now(),
        });
      });

      this.ws.on('message', (data: Buffer) => {
        let message: Record<string, unknown>;
        try {
          message = JSON.parse(data.toString());
        } catch (error) {
          logger.error({ error }, 'Failed to parse relay message');
          return;
        }
        try {
          this.handleMessage(message);
        } catch (error) {
          logger.error({ error }, 'Error handling relay message');
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

  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }

    logger.info('Disconnected from remote telemetry relay');
  }

  private handleMessage(message: Record<string, unknown>): void {
    // v2 envelope (has version + payload)
    if ('version' in message && 'payload' in message) {
      this.handleV2Message(message);
      return;
    }

    // v1 fallback
    this.handleV1Message(message);
  }

  private handleV2Message(message: Record<string, unknown>): void {
    const payload = message.payload as Record<string, unknown>;

    switch (message.type) {
      case 'handshake_ack': {
        this.negotiatedVersion = (payload.negotiatedVersion as string) || '2.0';
        logger.info({ negotiatedVersion: this.negotiatedVersion }, 'v2 handshake acknowledged');
        this.send({
          type: 'subscribe',
          version: '2.0',
          payload: { channels: ['telemetry'] },
          timestamp: Date.now(),
        });
        break;
      }

      case 'telemetry':
        this.emit('telemetry', payload.data);
        break;

      case 'session':
        this.emit('session', payload);
        break;

      case 'ping': {
        // Respond to server ping with pong
        const seq = (payload as { seq: number }).seq;
        this.send({
          type: 'pong',
          version: '2.0',
          payload: { seq, serverTime: Date.now() },
          timestamp: Date.now(),
        });
        break;
      }

      case 'pong':
        // latency measurement response — we could track this
        break;

      case 'error':
        logger.error({ error: payload }, 'Remote telemetry v2 error');
        this.emit('error', payload);
        break;

      default:
        logger.debug({ type: message.type }, 'Unknown v2 message type');
    }
  }

  private handleV1Message(message: Record<string, unknown>): void {
    switch (message.type) {
      case 'handshake_ack':
        logger.info('v1 handshake acknowledged by relay');
        this.send({ type: 'subscribe', channels: ['telemetry'] });
        break;

      case 'telemetry':
        this.emit('telemetry', message.data);
        break;

      case 'session':
        this.emit('session', message.data);
        break;

      case 'error':
        logger.error({ error: message.error }, 'Remote telemetry error');
        this.emit('error', message.error);
        break;

      default:
        logger.debug({ type: message.type }, 'Unknown v1 message type');
    }
  }

  private send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      logger.warn('Cannot send message, WebSocket not connected');
    }
  }

  /**
   * Exponential backoff with jitter:
   * delay = min(base * 2^attempt + random jitter, maxDelay)
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const base = this.config.reconnectBaseMs;
    const max = this.config.reconnectMaxMs;
    const exponential = base * Math.pow(2, this.reconnectAttempt);
    const jitter = Math.random() * base;
    const delay = Math.min(exponential + jitter, max);

    this.reconnectAttempt++;

    logger.info(
      { delay: Math.round(delay), attempt: this.reconnectAttempt },
      'Scheduling reconnection with exponential backoff'
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
