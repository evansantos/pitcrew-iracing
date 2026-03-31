/**
 * WebSocket server — client management, broadcasting, handshake.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { DeltaFrame, OutboundMessage, InboundMessage } from './types.js';

export interface ClientRecord {
  ws: WebSocket;
  ip: string;
  connectedAt: number;
}

export interface BroadcastStats {
  bytesSent: number;
  clientCount: number;
}

export class RelayWebSocketServer {
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<WebSocket, ClientRecord>();
  private readonly mockMode: boolean;

  constructor(port: number, mockMode: boolean = false) {
    this.mockMode = mockMode;
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
    this.wss.on('error', (err) => {
      console.error('[WSServer] Server error:', err);
    });
  }

  get clientCount(): number {
    return this.clients.size;
  }

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    const ip = req.socket.remoteAddress ?? 'unknown';
    console.log(`[WSServer] Client connected from ${ip}`);

    this.clients.set(ws, { ws, ip, connectedAt: Date.now() });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as InboundMessage;
        this.handleMessage(ws, ip, msg);
      } catch {
        console.error(`[WSServer] Failed to parse message from ${ip}`);
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

  private handleMessage(ws: WebSocket, ip: string, msg: InboundMessage): void {
    switch (msg.type) {
      case 'handshake': {
        console.log(`[WSServer] Handshake from ${ip}, version: ${msg.version}`);
        const ack: OutboundMessage = {
          type: 'handshake_ack',
          version: '2.0',
          mockMode: this.mockMode,
        };
        this.send(ws, ack);
        break;
      }

      case 'subscribe':
        console.log(`[WSServer] Subscribe from ${ip}: ${msg.channels.join(', ')}`);
        break;

      default:
        console.log(`[WSServer] Unknown message type from ${ip}`);
    }
  }

  private send(ws: WebSocket, msg: OutboundMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Broadcast a telemetry delta to all connected clients.
   * Returns total bytes written.
   */
  broadcastTelemetry(delta: DeltaFrame): BroadcastStats {
    const payload = JSON.stringify({ type: 'telemetry', data: delta });
    const bytes = Buffer.byteLength(payload, 'utf8');
    let sent = 0;

    for (const { ws } of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        sent += bytes;
      }
    }

    return { bytesSent: sent, clientCount: this.clients.size };
  }

  /** Broadcast an arbitrary outbound message. */
  broadcast(msg: OutboundMessage): void {
    const payload = JSON.stringify(msg);
    for (const { ws } of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /** Graceful shutdown — notifies clients then closes the server. */
  close(): Promise<void> {
    return new Promise((resolve) => {
      // Notify all clients
      this.broadcast({
        type: 'session',
        data: { state: 'server_shutdown' },
      });

      // Close all sockets
      for (const { ws } of this.clients.values()) {
        ws.close();
      }

      this.wss.close(() => {
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
