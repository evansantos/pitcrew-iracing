/**
 * WebSocket server — client management, broadcasting, handshake.
 * Supports Protocol v2 (typed envelopes, heartbeat, latency) with v1 backward compat.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { DeltaFrame, OutboundMessage, InboundMessage } from './types.js';

// ─── Protocol v2 types (inline to avoid shared package dependency in relay) ──

const PROTOCOL_V1 = '1.0';
const PROTOCOL_V2 = '2.0';

interface ProtocolEnvelope {
  type: string;
  version: string;
  payload: unknown;
  timestamp: number;
  sessionId?: string;
}

function createEnvelope(type: string, payload: unknown, sessionId?: string): ProtocolEnvelope {
  const envelope: ProtocolEnvelope = { type, version: PROTOCOL_V2, payload, timestamp: Date.now() };
  if (sessionId !== undefined) {
    envelope.sessionId = sessionId;
  }
  return envelope;
}

function isV2Message(msg: unknown): msg is ProtocolEnvelope {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'version' in msg &&
    'payload' in msg &&
    'type' in msg
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClientRecord {
  ws: WebSocket;
  ip: string;
  connectedAt: number;
  protocolVersion: string;
  lastPingSent: number;
  lastPongReceived: number;
  latencyMs: number;
  pingSeq: number;
}

export interface BroadcastStats {
  bytesSent: number;
  clientCount: number;
}

export interface LatencyStats {
  min: number;
  avg: number;
  max: number;
}

// ─── Server ─────────────────────────────────────────────────────────────────

export class RelayWebSocketServer {
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<WebSocket, ClientRecord>();
  private readonly mockMode: boolean;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private frameSeq = 0;

  constructor(port: number, mockMode: boolean = false) {
    this.mockMode = mockMode;
    this.wss = new WebSocketServer({ port, maxPayload: 1024 * 1024 });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
    this.wss.on('error', (err) => {
      console.error('[WSServer] Server error:', err);
    });

    // Start heartbeat every 10 seconds
    this.heartbeatTimer = setInterval(() => this.sendHeartbeats(), 10000);
  }

  get clientCount(): number {
    return this.clients.size;
  }

  /** Get latency statistics across all connected clients */
  getLatencyStats(): LatencyStats {
    if (this.clients.size === 0) {
      return { min: 0, avg: 0, max: 0 };
    }

    let min = Infinity;
    let max = 0;
    let sum = 0;
    let count = 0;

    for (const client of this.clients.values()) {
      if (client.latencyMs > 0) {
        min = Math.min(min, client.latencyMs);
        max = Math.max(max, client.latencyMs);
        sum += client.latencyMs;
        count++;
      }
    }

    if (count === 0) return { min: 0, avg: 0, max: 0 };
    return { min, avg: Math.round(sum / count), max };
  }

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    const ip = req.socket.remoteAddress ?? 'unknown';
    console.log(`[WSServer] Client connected from ${ip}`);

    this.clients.set(ws, {
      ws,
      ip,
      connectedAt: Date.now(),
      protocolVersion: PROTOCOL_V1, // assume v1 until handshake
      lastPingSent: 0,
      lastPongReceived: 0,
      latencyMs: 0,
      pingSeq: 0,
    });

    ws.on('message', (data) => {
      let msg: unknown;
      try {
        msg = JSON.parse(data.toString());
      } catch (err) {
        console.error(`[WSServer] Failed to parse message from ${ip}:`, err);
        return;
      }
      try {
        this.handleMessage(ws, ip, msg);
      } catch (err) {
        console.error(`[WSServer] Error handling message from ${ip}:`, err);
      }
    });

    ws.on('close', () => {
      console.log(`[WSServer] Client disconnected from ${ip}`);
      this.clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error(`[WSServer] Error from ${ip}:`, err.message);
    });
  }

  private handleMessage(ws: WebSocket, ip: string, msg: unknown): void {
    const client = this.clients.get(ws);
    if (!client) return;

    // v2 message (has version + payload)
    if (isV2Message(msg)) {
      this.handleV2Message(ws, ip, client, msg);
      return;
    }

    // v1 message (legacy)
    const v1Msg = msg as InboundMessage;
    this.handleV1Message(ws, ip, client, v1Msg);
  }

  private handleV2Message(ws: WebSocket, ip: string, client: ClientRecord, msg: ProtocolEnvelope): void {
    switch (msg.type) {
      case 'handshake': {
        const payload = msg.payload as { requestedVersion?: string; encoding?: string[] };
        const requestedVersion = payload.requestedVersion || PROTOCOL_V2;

        // Negotiate version — we support v1 and v2
        const negotiated = requestedVersion === PROTOCOL_V2 ? PROTOCOL_V2 : PROTOCOL_V1;
        client.protocolVersion = negotiated;

        console.log(`[WSServer] v2 Handshake from ${ip}, requested: ${requestedVersion}, negotiated: ${negotiated}`);

        const ack = createEnvelope('handshake_ack', {
          negotiatedVersion: negotiated,
          mockMode: this.mockMode,
          encoding: 'json',
          serverUptime: process.uptime(),
        });
        this.sendRaw(ws, JSON.stringify(ack));
        break;
      }

      case 'subscribe': {
        const payload = msg.payload as { channels?: string[] };
        console.log(`[WSServer] v2 Subscribe from ${ip}: ${payload.channels?.join(', ')}`);
        break;
      }

      case 'ping': {
        const payload = msg.payload as { seq: number };
        const pong = createEnvelope('pong', {
          seq: payload.seq,
          serverTime: Date.now(),
        });
        this.sendRaw(ws, JSON.stringify(pong));
        break;
      }

      case 'pong': {
        const payload = msg.payload as { seq: number };
        if (payload.seq === client.pingSeq) {
          client.lastPongReceived = Date.now();
          client.latencyMs = client.lastPongReceived - client.lastPingSent;
        }
        break;
      }

      default:
        console.log(`[WSServer] Unknown v2 message type from ${ip}: ${msg.type}`);
    }
  }

  private handleV1Message(ws: WebSocket, ip: string, client: ClientRecord, msg: InboundMessage): void {
    client.protocolVersion = PROTOCOL_V1;

    switch (msg.type) {
      case 'handshake': {
        console.log(`[WSServer] v1 Handshake from ${ip}, version: ${msg.version}`);
        const ack: OutboundMessage = {
          type: 'handshake_ack',
          version: '2.0',
          mockMode: this.mockMode,
        };
        this.sendRaw(ws, JSON.stringify(ack));
        break;
      }

      case 'subscribe':
        console.log(`[WSServer] v1 Subscribe from ${ip}: ${msg.channels.join(', ')}`);
        break;

      default:
        console.log(`[WSServer] Unknown v1 message type from ${ip}`);
    }
  }

  private sendRaw(ws: WebSocket, payload: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }

  private sendHeartbeats(): void {
    for (const [ws, client] of this.clients) {
      if (client.protocolVersion === PROTOCOL_V2 && ws.readyState === WebSocket.OPEN) {
        client.pingSeq++;
        client.lastPingSent = Date.now();
        const ping = createEnvelope('ping', { seq: client.pingSeq });
        this.sendRaw(ws, JSON.stringify(ping));
      }
    }
  }

  /**
   * Broadcast a telemetry delta to all connected clients.
   * v2 clients get an envelope, v1 clients get legacy format.
   */
  broadcastTelemetry(delta: DeltaFrame): BroadcastStats {
    this.frameSeq++;
    let totalBytes = 0;

    // Pre-serialize both formats
    const v1Payload = JSON.stringify({ type: 'telemetry', data: delta });
    const v2Payload = JSON.stringify(createEnvelope('telemetry', {
      data: delta,
      frameSeq: this.frameSeq,
      isKeyFrame: false,
    }));

    for (const [ws, client] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        const payload = client.protocolVersion === PROTOCOL_V2 ? v2Payload : v1Payload;
        try {
          ws.send(payload);
          totalBytes += Buffer.byteLength(payload, 'utf8');
        } catch {
          // Client errored mid-send — skip, will be cleaned up on close
        }
      }
    }

    return { bytesSent: totalBytes, clientCount: this.clients.size };
  }

  /** Broadcast an arbitrary outbound message (v1 format for backward compat). */
  broadcast(msg: OutboundMessage): void {
    const payload = JSON.stringify(msg);
    for (const { ws } of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /** Broadcast a v2 envelope to v2 clients only. */
  broadcastV2(type: string, msgPayload: unknown): void {
    const payload = JSON.stringify(createEnvelope(type, msgPayload));
    for (const [ws, client] of this.clients) {
      if (client.protocolVersion === PROTOCOL_V2 && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /** Graceful shutdown — notifies clients then closes the server. */
  close(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('[WSServer] Close timed out, forcing shutdown');
        resolve();
      }, 5000);

      try {
        this.broadcast({ type: 'session', data: { state: 'server_shutdown' } });
      } catch { /* best-effort notification */ }

      for (const { ws } of this.clients.values()) {
        try { ws.close(); } catch { /* best-effort */ }
      }

      this.wss.close(() => {
        clearTimeout(timeout);
        console.log('[WSServer] Server closed');
        resolve();
      });
    });
  }

  /** Port the server is listening on. */
  get port(): number {
    const addr = this.wss.address();
    if (addr && typeof addr === 'object' && 'port' in addr) {
      return addr.port as number;
    }
    return 0;
  }
}
