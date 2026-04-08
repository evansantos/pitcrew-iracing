/**
 * Integration tests for RelayWebSocketServer.
 * Uses real WebSocket connections on port 9876.
 */

import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { RelayWebSocketServer } from '../ws-server.js';
import type { DeltaFrame } from '../types.js';

const PORT = 9876;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function connectClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    ws.once('message', (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (err) {
        reject(err);
      }
    });
    ws.once('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RelayWebSocketServer', () => {
  let server: RelayWebSocketServer;

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  it('1. accepts connections and tracks client count', async () => {
    server = new RelayWebSocketServer(PORT);

    expect(server.clientCount).toBe(0);

    const ws1 = await connectClient();
    await sleep(50);
    expect(server.clientCount).toBe(1);

    const ws2 = await connectClient();
    await sleep(50);
    expect(server.clientCount).toBe(2);

    ws1.close();
    ws2.close();
  });

  it('2. v1 handshake returns ack', async () => {
    server = new RelayWebSocketServer(PORT);

    const ws = await connectClient();
    const msgPromise = waitForMessage(ws);

    ws.send(JSON.stringify({ type: 'handshake', version: '1.0' }));

    const msg = await msgPromise as Record<string, unknown>;
    expect(msg.type).toBe('handshake_ack');
    expect(typeof msg.mockMode).toBe('boolean');

    ws.close();
  });

  it('3. v2 handshake negotiates version', async () => {
    server = new RelayWebSocketServer(PORT);

    const ws = await connectClient();
    const msgPromise = waitForMessage(ws);

    ws.send(JSON.stringify({
      type: 'handshake',
      version: '2.0',
      payload: { requestedVersion: '2.0' },
      timestamp: Date.now(),
    }));

    const msg = await msgPromise as Record<string, unknown>;
    expect(msg.type).toBe('handshake_ack');
    expect(msg.version).toBe('2.0');

    const payload = msg.payload as Record<string, unknown>;
    expect(payload.negotiatedVersion).toBe('2.0');

    ws.close();
  });

  it('4. v2 ping gets pong with matching seq', async () => {
    server = new RelayWebSocketServer(PORT);

    const ws = await connectClient();

    // Do v2 handshake first so client is tracked as v2
    const handshakePromise = waitForMessage(ws);
    ws.send(JSON.stringify({
      type: 'handshake',
      version: '2.0',
      payload: { requestedVersion: '2.0' },
      timestamp: Date.now(),
    }));
    await handshakePromise;

    const pongPromise = waitForMessage(ws);
    const seq = 42;
    ws.send(JSON.stringify({
      type: 'ping',
      version: '2.0',
      payload: { seq },
      timestamp: Date.now(),
    }));

    const pong = await pongPromise as Record<string, unknown>;
    expect(pong.type).toBe('pong');
    expect(pong.version).toBe('2.0');

    const payload = pong.payload as Record<string, unknown>;
    expect(payload.seq).toBe(seq);

    ws.close();
  });

  it('5. broadcasts telemetry to v1 clients in legacy format', async () => {
    server = new RelayWebSocketServer(PORT);

    const ws = await connectClient();

    // v1 handshake — client stays v1
    const ackPromise = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'handshake', version: '1.0' }));
    await ackPromise;

    const telemetryPromise = waitForMessage(ws);
    const delta: DeltaFrame = { timestamp: Date.now(), player: { speed: 150 } };
    server.broadcastTelemetry(delta);

    const msg = await telemetryPromise as Record<string, unknown>;
    expect(msg.type).toBe('telemetry');
    // v1 format: flat object with `data` key, no `version` envelope
    expect(msg).not.toHaveProperty('version');
    expect(msg.data).toBeDefined();

    ws.close();
  });

  it('6. broadcasts telemetry to v2 clients in envelope format', async () => {
    server = new RelayWebSocketServer(PORT);

    const ws = await connectClient();

    // v2 handshake — upgrades client to v2
    const ackPromise = waitForMessage(ws);
    ws.send(JSON.stringify({
      type: 'handshake',
      version: '2.0',
      payload: { requestedVersion: '2.0' },
      timestamp: Date.now(),
    }));
    await ackPromise;

    const telemetryPromise = waitForMessage(ws);
    const delta: DeltaFrame = { timestamp: Date.now(), player: { speed: 200 } };
    server.broadcastTelemetry(delta);

    const msg = await telemetryPromise as Record<string, unknown>;
    expect(msg.type).toBe('telemetry');
    expect(msg.version).toBe('2.0');

    const payload = msg.payload as Record<string, unknown>;
    expect(payload.data).toBeDefined();
    expect(typeof payload.frameSeq).toBe('number');

    ws.close();
  });

  it('7. removes client on disconnect', async () => {
    server = new RelayWebSocketServer(PORT);

    const ws = await connectClient();
    await sleep(50);
    expect(server.clientCount).toBe(1);

    ws.close();
    await sleep(100); // wait for propagation

    expect(server.clientCount).toBe(0);
  });

  it('8. does not crash on malformed JSON', async () => {
    server = new RelayWebSocketServer(PORT);

    const ws = await connectClient();
    await sleep(50);

    // Send malformed JSON — server should silently ignore it, not crash
    ws.send('{ this is not valid json !!!');
    await sleep(100);

    // Server still alive — we can still connect
    expect(server.clientCount).toBeGreaterThanOrEqual(1);

    ws.close();
  });

  it('9. returns latency stats of zero with no clients', () => {
    server = new RelayWebSocketServer(PORT);

    const stats = server.getLatencyStats();
    expect(stats).toEqual({ min: 0, avg: 0, max: 0 });
  });

  it('10. returns broadcast stats with byte count', async () => {
    server = new RelayWebSocketServer(PORT);

    const ws = await connectClient();
    await sleep(50);

    const delta: DeltaFrame = { timestamp: Date.now(), player: { speed: 100 } };
    const stats = server.broadcastTelemetry(delta);

    expect(stats.clientCount).toBe(1);
    expect(stats.bytesSent).toBeGreaterThan(0);

    ws.close();
  });

  it('11. graceful shutdown notifies and closes clients', async () => {
    server = new RelayWebSocketServer(PORT);

    const ws = await connectClient();
    await sleep(50);

    const closePromise = new Promise<void>((resolve) => {
      ws.once('close', () => resolve());
    });

    await server.close();
    await closePromise;

    // server reference is already closed — set to null-ish to skip afterEach close
    server = null as unknown as RelayWebSocketServer;
  });

  it('12. reports correct port', () => {
    server = new RelayWebSocketServer(PORT);
    expect(server.port).toBe(PORT);
  });
});
