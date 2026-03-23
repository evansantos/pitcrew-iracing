#!/usr/bin/env node
/**
 * iRacing Telemetry Relay Server — TypeScript rewrite
 *
 * Usage:
 *   npx ts-node src/index.ts [options]
 *   node dist/index.js [options]
 *
 * Options:
 *   --port <n>      WebSocket port (default: 3002)
 *   --rate <n>      Telemetry rate in Hz (default: 60)
 *   --compress      Enable per-message deflate compression
 *   --mock          Run with fake telemetry (no iRacing needed)
 */

import { networkInterfaces } from 'node:os';
import { parseArgs } from 'node:util';

import { createIRacingClient } from './iracing-client.js';
import { RelayWebSocketServer } from './ws-server.js';
import { DeltaEncoder } from './encoder.js';
import { DashboardRenderer } from './display.js';
import type { RelayConfig, DisplayState, IRacingSessionInfo } from './types.js';

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseConfig(): RelayConfig {
  const { values } = parseArgs({
    options: {
      port:     { type: 'string',  default: '3002' },
      rate:     { type: 'string',  default: '60'   },
      compress: { type: 'boolean', default: false   },
      mock:     { type: 'boolean', default: false   },
    },
    strict: false,
  });

  return {
    port:     parseInt(values.port     as string, 10),
    rate:     parseInt(values.rate     as string, 10),
    compress: Boolean(values.compress),
    mock:     Boolean(values.mock),
  };
}

// ─── Local IP helper ──────────────────────────────────────────────────────────

function getLocalIP(): string {
  const nets = networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = parseConfig();

  console.log('');
  console.log('  iRacing Relay Server (TypeScript)');
  console.log('  ══════════════════════════════════');
  if (config.mock) {
    console.log('  ⚠  Running in MOCK mode (fake telemetry)');
  }
  console.log(`  Port : ${config.port}`);
  console.log(`  Rate : ${config.rate} Hz`);
  console.log('');

  // Subsystems
  const wsServer  = new RelayWebSocketServer(config.port, config.mock);
  const encoder   = new DeltaEncoder();
  const renderer  = new DashboardRenderer();
  const iracing   = createIRacingClient(config.mock, config.rate);

  // Mutable dashboard state
  const state: DisplayState = {
    connected:   false,
    mockMode:    config.mock,
    clientCount: 0,
    bytesSent:   0,
    frameCount:  0,
    track:       '',
    car:         '',
    telemetry:   null,
  };

  // ── iRacing events ──────────────────────────────────────────────────────────

  iracing.on('connected', () => {
    state.connected = true;
    wsServer.broadcast({ type: 'session', data: { state: 'connected' } });
    console.log('[iRacing] Connected');
  });

  iracing.on('disconnected', () => {
    state.connected = false;
    wsServer.broadcast({ type: 'session', data: { state: 'disconnected' } });
    console.log('[iRacing] Disconnected');
  });

  iracing.on('sessionInfo', (info: IRacingSessionInfo) => {
    state.track = info.WeekendInfo?.TrackName ?? '';
    const drivers = info.DriverInfo?.Drivers ?? [];
    state.car   = drivers[0]?.CarScreenName ?? '';
    wsServer.broadcast({ type: 'session', data: { state: 'running', sessionInfo: info } });
  });

  iracing.on('telemetry', (frame) => {
    state.telemetry   = frame;
    state.frameCount += 1;

    const delta = encoder.next(frame);
    const stats = wsServer.broadcastTelemetry(delta);
    state.bytesSent  += stats.bytesSent;
    state.clientCount = stats.clientCount;
  });

  iracing.on('error', (err) => {
    console.error('[iRacing] Error:', err.message);
  });

  // ── Dashboard refresh (4 Hz independent of telemetry) ──────────────────────

  const dashTimer = setInterval(() => {
    state.clientCount = wsServer.clientCount;
    renderer.render(state);
  }, 250);

  // ── Graceful shutdown ───────────────────────────────────────────────────────

  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    process.stdout.write('\n');
    console.log(`[Relay] Received ${signal}. Shutting down…`);

    clearInterval(dashTimer);
    iracing.stop();
    await wsServer.close();
    process.exit(0);
  }

  process.on('SIGINT',  () => { void shutdown('SIGINT');  });
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

  // ── Start ───────────────────────────────────────────────────────────────────

  iracing.start();

  const ip = getLocalIP();
  console.log(`[Relay] WebSocket listening on ws://${ip}:${config.port}`);
  console.log('[Relay] Press Ctrl+C to stop\n');
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
