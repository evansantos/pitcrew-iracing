# Wave 1: Polish & Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up partially-built features, add REST endpoints, polish the dashboard, and backfill test coverage to make the platform production-ready.

**Architecture:** 6 specs implemented in dependency order: tests first (confidence), then REST endpoints (data layer), then features that consume those endpoints (replay, analysis, sharing), and finally visual polish (independent). Each spec is 1-3 tasks.

**Tech Stack:** TypeScript, Fastify, Socket.IO, Vitest, Next.js 15, React 19, Zustand, Recharts, Canvas API

---

## Spec 022: Test Coverage Hardening

### Task 1: Unit tests for transformTelemetry

**Files:**
- Create: `tools/relay/src/__tests__/iracing-client.test.ts`
- Reference: `tools/relay/src/iracing-client.ts` (the `transformTelemetry` function, lines 23-100)

- [ ] **Step 1: Write the test file with all 10 tests**

```typescript
import { describe, it, expect } from 'vitest';
import { transformTelemetry } from '../iracing-client.js';
import type { IRacingRawTelemetry } from '../types.js';

describe('transformTelemetry', () => {
  it('converts speed from m/s to km/h', () => {
    const raw: IRacingRawTelemetry = { Speed: 50 }; // 50 m/s = 180 km/h
    const result = transformTelemetry(raw);
    expect(result.player.speed).toBeCloseTo(180, 0);
  });

  it('returns 0 speed when Speed is null', () => {
    const result = transformTelemetry({});
    expect(result.player.speed).toBe(0);
  });

  it('returns 0 speed when Speed is undefined', () => {
    const result = transformTelemetry({ Speed: undefined });
    expect(result.player.speed).toBe(0);
  });

  it('scales FuelLevelPct from 0-1 to 0-100', () => {
    const result = transformTelemetry({ FuelLevelPct: 0.75 });
    expect(result.fuel.levelPct).toBeCloseTo(75, 0);
  });

  it('scales RelativeHumidity from 0-1 to 0-100', () => {
    const result = transformTelemetry({ RelativeHumidity: 0.55 });
    expect(result.track.humidity).toBeCloseTo(55, 0);
  });

  it('estimates fuel laps remaining correctly', () => {
    // FuelUsePerHour=3.6, LapLastLapTime=100s => fuelPerLap = (3.6/3600)*100 = 0.1
    // FuelLevel=1.0 => lapsRemaining = 1.0 / 0.1 = 10
    const result = transformTelemetry({
      FuelLevel: 1.0,
      FuelUsePerHour: 3.6,
      LapLastLapTime: 100,
    });
    expect(result.fuel.lapsRemaining).toBe(10);
  });

  it('returns 0 fuel laps remaining when lastLapTime is 0', () => {
    const result = transformTelemetry({
      FuelLevel: 10,
      FuelUsePerHour: 3.6,
      LapLastLapTime: 0,
    });
    expect(result.fuel.lapsRemaining).toBe(0);
  });

  it('returns 0 fuel laps remaining when FuelUsePerHour is 0', () => {
    const result = transformTelemetry({
      FuelLevel: 10,
      FuelUsePerHour: 0,
      LapLastLapTime: 90,
    });
    expect(result.fuel.lapsRemaining).toBe(0);
  });

  it('passes through gear, lap, position values', () => {
    const result = transformTelemetry({ Gear: 4, Lap: 7, Position: 3 });
    expect(result.player.gear).toBe(4);
    expect(result.player.lap).toBe(7);
    expect(result.player.position).toBe(3);
  });

  it('defaults all fields safely when given empty input', () => {
    const result = transformTelemetry({});
    expect(result.player.speed).toBe(0);
    expect(result.player.rpm).toBe(0);
    expect(result.player.gear).toBe(0);
    expect(result.fuel.level).toBe(0);
    expect(result.fuel.lapsRemaining).toBe(0);
    expect(result.tires.lf.temp).toBe(0);
    expect(result.track.temperature).toBe(20); // default
    expect(result.track.humidity).toBe(50); // default (null * 100 fallback)
    expect(result.session.state).toBe(0);
    expect(result.timestamp).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd tools/relay && npx vitest run src/__tests__/iracing-client.test.ts --reporter=verbose`
Expected: 10 tests PASS (these test existing working code)

- [ ] **Step 3: Commit**

```bash
git add tools/relay/src/__tests__/iracing-client.test.ts
git commit -m "test: add transformTelemetry unit tests (10 tests)"
```

---

### Task 2: Unit tests for lap-analyzer

**Files:**
- Create: `apps/api/src/services/ai/__tests__/lap-analyzer.test.ts`
- Reference: `apps/api/src/services/ai/lap-analyzer.ts` (the `analyzeLap` function)

- [ ] **Step 1: Write the test file with all 8 tests**

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeLap } from '../lap-analyzer.js';
import type { StoredFrame, ProcessedTelemetry } from '@iracing-race-engineer/shared';

function makeFrame(dist: number, overrides: Partial<{ speed: number; throttle: number; brake: number }>): StoredFrame {
  return {
    seq: 0,
    lap: 1,
    lapDistPct: dist,
    telemetry: {
      sessionTime: dist * 90,
      player: {
        speed: overrides.speed ?? 150,
        rpm: 6000,
        gear: 4,
        throttle: overrides.throttle ?? 0.8,
        brake: overrides.brake ?? 0,
        lap: 1,
        lapDistPct: dist,
        currentLapTime: dist * 90,
        lastLapTime: 90,
        bestLapTime: 89,
        position: 1,
        classPosition: 1,
      },
      fuel: { level: 40, levelPct: 50, usePerHour: 3, lapsRemaining: 20, tankCapacity: 80 },
      tires: {
        lf: { tempL: 80, tempM: 85, tempR: 80, wearL: 0.9, wearM: 0.9, wearR: 0.9, avgTemp: 82, avgWear: 0.9 },
        rf: { tempL: 80, tempM: 85, tempR: 80, wearL: 0.9, wearM: 0.9, wearR: 0.9, avgTemp: 82, avgWear: 0.9 },
        lr: { tempL: 80, tempM: 85, tempR: 80, wearL: 0.9, wearM: 0.9, wearR: 0.9, avgTemp: 82, avgWear: 0.9 },
        rr: { tempL: 80, tempM: 85, tempR: 80, wearL: 0.9, wearM: 0.9, wearR: 0.9, avgTemp: 82, avgWear: 0.9 },
      },
      track: { name: 'Monza', temperature: 30, airTemp: 25, windSpeed: 2, windDirection: 1, humidity: 50 },
      session: { state: 4, flags: 0, timeRemaining: 3600, lapsRemaining: 30 },
    } as ProcessedTelemetry,
  };
}

function makeLap(count: number, overrides?: (dist: number) => Partial<{ speed: number; throttle: number; brake: number }>): StoredFrame[] {
  return Array.from({ length: count }, (_, i) => {
    const dist = i / count;
    return makeFrame(dist, overrides?.(dist) ?? {});
  });
}

describe('analyzeLap', () => {
  it('returns empty array when current lap has fewer than 10 frames', () => {
    const current = makeLap(5);
    const reference = makeLap(20);
    expect(analyzeLap(current, reference)).toEqual([]);
  });

  it('returns empty array when reference lap has fewer than 10 frames', () => {
    const current = makeLap(20);
    const reference = makeLap(5);
    expect(analyzeLap(current, reference)).toEqual([]);
  });

  it('returns empty array when laps are identical', () => {
    const lap = makeLap(30);
    expect(analyzeLap(lap, lap)).toEqual([]);
  });

  it('detects heavy braking areas', () => {
    const current = makeLap(30, (dist) => dist > 0.4 && dist < 0.6 ? { brake: 0.8 } : {});
    const reference = makeLap(30, () => ({ brake: 0 }));
    const areas = analyzeLap(current, reference);
    expect(areas.some(a => a.type === 'braking')).toBe(true);
  });

  it('detects late throttle application', () => {
    const current = makeLap(30, (dist) => dist > 0.4 && dist < 0.6 ? { throttle: 0.3 } : {});
    const reference = makeLap(30, () => ({ throttle: 0.8 }));
    const areas = analyzeLap(current, reference);
    expect(areas.some(a => a.type === 'throttle')).toBe(true);
  });

  it('detects slow cornering speed', () => {
    const current = makeLap(30, (dist) => dist > 0.2 && dist < 0.4 ? { speed: 80 } : {});
    const reference = makeLap(30, () => ({ speed: 150 }));
    const areas = analyzeLap(current, reference);
    expect(areas.some(a => a.type === 'cornering')).toBe(true);
  });

  it('limits results to maxAreas (default 3)', () => {
    // Create lots of deficits across the whole lap
    const current = makeLap(30, () => ({ brake: 0.8, throttle: 0.1, speed: 50 }));
    const reference = makeLap(30, () => ({ brake: 0, throttle: 0.8, speed: 150 }));
    const areas = analyzeLap(current, reference);
    expect(areas.length).toBeLessThanOrEqual(3);
  });

  it('sorts results by severity descending', () => {
    const current = makeLap(30, () => ({ brake: 0.8, throttle: 0.1, speed: 50 }));
    const reference = makeLap(30, () => ({ brake: 0, throttle: 0.8, speed: 150 }));
    const areas = analyzeLap(current, reference);
    for (let i = 1; i < areas.length; i++) {
      expect(areas[i].severity).toBeLessThanOrEqual(areas[i - 1].severity);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/services/ai/__tests__/lap-analyzer.test.ts --reporter=verbose`
Expected: 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/ai/__tests__/lap-analyzer.test.ts
git commit -m "test: add lap-analyzer unit tests (8 tests)"
```

---

### Task 3: Integration tests for ws-server

**Files:**
- Create: `tools/relay/src/__tests__/ws-server.test.ts`
- Reference: `tools/relay/src/ws-server.ts`

- [ ] **Step 1: Write the test file with 12 integration tests**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { RelayWebSocketServer } from '../ws-server.js';

let server: RelayWebSocketServer;
const TEST_PORT = 9876;

function connectClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(JSON.parse(data.toString())));
  });
}

afterEach(async () => {
  if (server) {
    await server.close();
  }
});

describe('RelayWebSocketServer', () => {
  it('accepts connections and tracks client count', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    const ws = await connectClient();
    expect(server.clientCount).toBe(1);
    ws.close();
  });

  it('handles v1 handshake and returns ack', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    const ws = await connectClient();
    const msgPromise = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'handshake', version: '1.0' }));
    const ack = await msgPromise as Record<string, unknown>;
    expect(ack.type).toBe('handshake_ack');
    ws.close();
  });

  it('handles v2 handshake and negotiates version', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    const ws = await connectClient();
    const msgPromise = waitForMessage(ws);
    ws.send(JSON.stringify({
      type: 'handshake',
      version: '2.0',
      payload: { requestedVersion: '2.0', encoding: ['json'] },
      timestamp: Date.now(),
    }));
    const ack = await msgPromise as Record<string, unknown>;
    expect(ack.type).toBe('handshake_ack');
    expect(ack.version).toBe('2.0');
    const payload = ack.payload as Record<string, unknown>;
    expect(payload.negotiatedVersion).toBe('2.0');
    ws.close();
  });

  it('responds to v2 ping with pong containing matching seq', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    const ws = await connectClient();
    // First do v2 handshake
    ws.send(JSON.stringify({
      type: 'handshake', version: '2.0',
      payload: { requestedVersion: '2.0' }, timestamp: Date.now(),
    }));
    await waitForMessage(ws); // consume ack

    const pongPromise = waitForMessage(ws);
    ws.send(JSON.stringify({
      type: 'ping', version: '2.0',
      payload: { seq: 42 }, timestamp: Date.now(),
    }));
    const pong = await pongPromise as Record<string, unknown>;
    expect(pong.type).toBe('pong');
    const payload = pong.payload as Record<string, unknown>;
    expect(payload.seq).toBe(42);
    ws.close();
  });

  it('broadcasts telemetry to v1 clients in legacy format', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    const ws = await connectClient();
    // v1 handshake
    ws.send(JSON.stringify({ type: 'handshake', version: '1.0' }));
    await waitForMessage(ws); // consume ack

    const msgPromise = waitForMessage(ws);
    server.broadcastTelemetry({ timestamp: 123 });
    const msg = await msgPromise as Record<string, unknown>;
    expect(msg.type).toBe('telemetry');
    expect(msg).toHaveProperty('data');
    ws.close();
  });

  it('broadcasts telemetry to v2 clients in envelope format', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    const ws = await connectClient();
    // v2 handshake
    ws.send(JSON.stringify({
      type: 'handshake', version: '2.0',
      payload: { requestedVersion: '2.0' }, timestamp: Date.now(),
    }));
    await waitForMessage(ws); // consume ack

    const msgPromise = waitForMessage(ws);
    server.broadcastTelemetry({ timestamp: 123 });
    const msg = await msgPromise as Record<string, unknown>;
    expect(msg.type).toBe('telemetry');
    expect(msg.version).toBe('2.0');
    expect(msg).toHaveProperty('payload');
    ws.close();
  });

  it('removes client from map on disconnect', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    const ws = await connectClient();
    expect(server.clientCount).toBe(1);
    ws.close();
    // Wait for close event to propagate
    await new Promise((r) => setTimeout(r, 100));
    expect(server.clientCount).toBe(0);
  });

  it('does not crash on malformed JSON', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    const ws = await connectClient();
    ws.send('not json at all!!!');
    // Give time for error handling
    await new Promise((r) => setTimeout(r, 100));
    // Server should still be accepting connections
    const ws2 = await connectClient();
    expect(server.clientCount).toBe(2);
    ws.close();
    ws2.close();
  });

  it('returns latency stats of zero with no clients', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    const stats = server.getLatencyStats();
    expect(stats).toEqual({ min: 0, avg: 0, max: 0 });
  });

  it('returns broadcast stats with byte count and client count', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    const ws = await connectClient();
    ws.send(JSON.stringify({ type: 'handshake', version: '1.0' }));
    await waitForMessage(ws);

    const stats = server.broadcastTelemetry({ timestamp: 123 });
    expect(stats.clientCount).toBe(1);
    expect(stats.bytesSent).toBeGreaterThan(0);
    ws.close();
  });

  it('gracefully shuts down and notifies clients', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    const ws = await connectClient();
    const closePromise = new Promise<void>((resolve) => {
      ws.on('close', () => resolve());
    });
    await server.close();
    await closePromise;
    // Server is closed, creating new server on same port should work
    server = new RelayWebSocketServer(TEST_PORT);
    const ws2 = await connectClient();
    expect(server.clientCount).toBe(1);
    ws2.close();
  });

  it('reports correct port', async () => {
    server = new RelayWebSocketServer(TEST_PORT);
    expect(server.port).toBe(TEST_PORT);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd tools/relay && npx vitest run src/__tests__/ws-server.test.ts --reporter=verbose`
Expected: 12 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tools/relay/src/__tests__/ws-server.test.ts
git commit -m "test: add ws-server integration tests (12 tests)"
```

---

## Spec 021: REST API Endpoints

### Task 4: Session REST endpoints (FileStore wrappers)

**Files:**
- Create: `apps/api/src/modules/sessions/index.ts`
- Modify: `apps/api/src/index.ts` (register new route)
- Reference: `apps/api/src/services/file-store/index.ts` (FileStore class)

- [ ] **Step 1: Create the sessions route module**

```typescript
import { FastifyPluginAsync } from 'fastify';
import type { FileStore } from '../../services/file-store/index.js';

export function createSessionRoutes(fileStore: FileStore): FastifyPluginAsync {
  return async (fastify) => {
    // List all stored sessions
    fastify.get('/', async () => {
      const sessions = fileStore.listSessions();
      return sessions.sort((a, b) => b.startTime - a.startTime);
    });

    // Get session index by ID
    fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
      const index = fileStore.getSessionIndex(request.params.id);
      if (!index) {
        return reply.code(404).send({ error: 'Session not found' });
      }
      return index;
    });

    // Get session frames with query filters
    fastify.get<{
      Params: { id: string };
      Querystring: { laps?: string; timeStart?: string; timeEnd?: string; downsample?: string; limit?: string };
    }>('/:id/frames', async (request, reply) => {
      const { id } = request.params;
      const index = fileStore.getSessionIndex(id);
      if (!index) {
        return reply.code(404).send({ error: 'Session not found' });
      }

      const query: import('@iracing-race-engineer/shared').FrameQuery = { sessionId: id };

      if (request.query.laps) {
        query.laps = request.query.laps.split(',').map(Number).filter(n => !isNaN(n));
      }
      if (request.query.timeStart && request.query.timeEnd) {
        query.timeRange = {
          start: Number(request.query.timeStart),
          end: Number(request.query.timeEnd),
        };
      }
      if (request.query.downsample) {
        query.downsample = Math.max(1, Number(request.query.downsample));
      }
      if (request.query.limit) {
        query.limit = Math.max(1, Math.min(10000, Number(request.query.limit)));
      } else {
        query.limit = 10000;
      }

      return fileStore.getFrames(query);
    });

    // Get session laps
    fastify.get<{ Params: { id: string } }>('/:id/laps', async (request, reply) => {
      const index = fileStore.getSessionIndex(request.params.id);
      if (!index) {
        return reply.code(404).send({ error: 'Session not found' });
      }
      return index.laps;
    });

    // Delete a session
    fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
      const index = fileStore.getSessionIndex(request.params.id);
      if (!index) {
        return reply.code(404).send({ error: 'Session not found' });
      }
      fileStore.endSession(request.params.id);
      // Remove session directory from disk
      const fs = await import('fs');
      const path = await import('path');
      const sessionDir = path.join(fileStore['dataDir'], request.params.id);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true });
      }
      return { success: true, message: `Session ${request.params.id} deleted` };
    });
  };
}
```

- [ ] **Step 2: Register the route in index.ts**

Add import at top of `apps/api/src/index.ts`:
```typescript
import { createSessionRoutes } from './modules/sessions/index.js';
```

Add after the existing route registrations (after line ~88):
```typescript
await fastify.register(createSessionRoutes(fileStore), { prefix: '/api/sessions' });
```

- [ ] **Step 3: Verify compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/sessions/index.ts apps/api/src/index.ts
git commit -m "feat: add REST endpoints for sessions (list, get, frames, laps, delete)"
```

---

### Task 5: Live telemetry REST endpoints

**Files:**
- Modify: `apps/api/src/modules/telemetry/index.ts` (replace 501s)
- Modify: `apps/api/src/modules/telemetry/socket-handlers.ts` (expose state getters)
- Modify: `apps/api/src/index.ts` (pass state to routes)

- [ ] **Step 1: Add state getter functions to socket-handlers.ts**

Add at the end of `apps/api/src/modules/telemetry/socket-handlers.ts`, before the `buildRacerList` helper:

```typescript
/** Get the latest telemetry for a racer (stored during relay:telemetry events) */
export function getLatestTelemetry(state: SocketHandlerState, racerName: string): ProcessedTelemetry | null {
  const socketId = state.racerRelays.get(racerName);
  if (!socketId) return null;
  // Return from lastTelemetry map
  return state.lastTelemetry?.get(racerName) ?? null;
}

/** Get the latest strategy for a racer */
export function getLatestStrategy(state: SocketHandlerState, racerName: string): InlineStrategy | null {
  return state.strategyCache.get(racerName)?.lastStrategy ?? null;
}

/** Get list of connected racers */
export function getConnectedRacers(state: SocketHandlerState): { name: string; mock: boolean }[] {
  return buildRacerList(state);
}
```

Also add a `lastTelemetry` map to `SocketHandlerState`:
```typescript
export interface SocketHandlerState {
  relayConnections: Map<string, RelayInfo>;
  racerRelays: Map<string, string>;
  strategyCache: Map<string, StrategyCache>;
  lastTelemetry: Map<string, ProcessedTelemetry>;
}
```

Update `createSocketState()` to include the new map:
```typescript
export function createSocketState(): SocketHandlerState {
  return {
    relayConnections: new Map(),
    racerRelays: new Map(),
    strategyCache: new Map(),
    lastTelemetry: new Map(),
  };
}
```

Store last telemetry in `handleRelayTelemetry` — add this line after the `io.to('telemetry').emit(...)` call:
```typescript
state.lastTelemetry.set(data.racerName, data.telemetry);
```

- [ ] **Step 2: Replace telemetry route 501s**

Replace the entire content of `apps/api/src/modules/telemetry/index.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import type { SocketHandlerState } from './socket-handlers.js';
import { getConnectedRacers, getLatestTelemetry, getLatestStrategy } from './socket-handlers.js';

export function createTelemetryRoutes(socketState: SocketHandlerState): FastifyPluginAsync {
  return async (fastify) => {
    // List connected racers
    fastify.get('/live', async () => {
      return getConnectedRacers(socketState);
    });

    // Get latest telemetry snapshot for a racer
    fastify.get<{ Params: { racerName: string } }>('/live/:racerName', async (request, reply) => {
      const telemetry = getLatestTelemetry(socketState, request.params.racerName);
      if (!telemetry) {
        return reply.code(404).send({ error: 'Racer not connected' });
      }
      return telemetry;
    });
  };
}

export function createStrategyRoutes(socketState: SocketHandlerState): FastifyPluginAsync {
  return async (fastify) => {
    // Get latest strategy snapshot for a racer
    fastify.get<{ Params: { racerName: string } }>('/live/:racerName', async (request, reply) => {
      const strategy = getLatestStrategy(socketState, request.params.racerName);
      if (!strategy) {
        return reply.code(404).send({ error: 'No strategy data for racer' });
      }
      return strategy;
    });
  };
}
```

- [ ] **Step 3: Update index.ts to use new route factories**

Replace the old telemetry route registration in `apps/api/src/index.ts`:

Old:
```typescript
import { telemetryRoutes } from './modules/telemetry/index.js';
```
New:
```typescript
import { createTelemetryRoutes, createStrategyRoutes } from './modules/telemetry/index.js';
```

Old:
```typescript
await fastify.register(telemetryRoutes, { prefix: '/api/telemetry' });
```
New:
```typescript
await fastify.register(createTelemetryRoutes(socketState), { prefix: '/api/telemetry' });
await fastify.register(createStrategyRoutes(socketState), { prefix: '/api/strategy' });
```

Note: `socketState` is already created earlier in the file. Move the `const socketState = createSocketState();` line before the route registrations if needed.

- [ ] **Step 4: Verify compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/telemetry/index.ts apps/api/src/modules/telemetry/socket-handlers.ts apps/api/src/index.ts
git commit -m "feat: replace 501 telemetry endpoints with live data routes"
```

---

## Spec 018: End-to-End Session Replay

### Task 6: Session browser page

**Files:**
- Create: `apps/web/app/replay/page.tsx`
- Modify: `apps/web/components/dashboard/dashboard-shell.tsx` (add nav item)

- [ ] **Step 1: Add Replay and Analysis to nav**

In `apps/web/components/dashboard/dashboard-shell.tsx`, update the `navItems` array:

```typescript
const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/analysis', label: 'Analysis' },
  { href: '/replay', label: 'Replay' },
  { href: '/tools/ibt-import', label: 'Import .IBT' },
  { href: '/tools/setup-compare', label: 'Setup Compare' },
];
```

- [ ] **Step 2: Create the session browser page**

```typescript
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

interface SessionSummary {
  sessionId: string;
  racerName: string;
  trackName: string;
  carName: string;
  sessionType: string;
  startTime: number;
  endTime: number | null;
  totalFrames: number;
  totalLaps: number;
  source: 'live' | 'import';
}

export default function ReplayBrowserPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    fetch(`${apiUrl}/api/sessions`)
      .then((res) => res.json())
      .then((data) => setSessions(data))
      .catch((err) => console.error('Failed to load sessions:', err))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (ts: number) => new Date(ts).toLocaleString();
  const formatDuration = (start: number, end: number | null) => {
    if (!end) return 'In progress';
    const secs = Math.round((end - start) / 1000);
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins}m ${remainSecs}s`;
  };

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Session Replay</h1>

        {loading && <p className="text-muted-foreground">Loading sessions...</p>}

        {!loading && sessions.length === 0 && (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">No recorded sessions found.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Sessions are automatically recorded when a relay connects.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <Link
              key={s.sessionId}
              href={`/replay/${s.sessionId}`}
              className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{s.trackName}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs">{s.sessionType}</span>
              </div>
              <p className="text-sm text-muted-foreground">{s.carName}</p>
              <p className="text-sm text-muted-foreground">{s.racerName}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDate(s.startTime)}</span>
                <span>{s.totalLaps} laps</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDuration(s.startTime, s.endTime)}</span>
                <span>{s.totalFrames.toLocaleString()} frames</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/replay/page.tsx apps/web/components/dashboard/dashboard-shell.tsx
git commit -m "feat: session browser page with nav links"
```

---

### Task 7: Wire replay page to PlaybackEngine + dashboard

**Files:**
- Modify: `apps/web/app/replay/[sessionId]/page.tsx`
- Reference: `apps/api/src/services/replay/playback-engine.ts`

- [ ] **Step 1: Rewrite the replay page to fetch data, drive PlaybackEngine, and render dashboard components**

Replace the entire content of `apps/web/app/replay/[sessionId]/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { LiveGauges } from '@/components/telemetry/live-gauges';
import { SessionInfo } from '@/components/telemetry/session-info';
import { FuelManagement } from '@/components/telemetry/fuel-management';
import { TireStrategy } from '@/components/telemetry/tire-strategy';

interface StoredFrame {
  seq: number;
  lap: number;
  lapDistPct: number;
  telemetry: Record<string, unknown>;
}

interface SessionIndex {
  sessionId: string;
  racerName: string;
  trackName: string;
  carName: string;
  sessionType: string;
  startTime: number;
  endTime: number | null;
  totalFrames: number;
  laps: Array<{ lap: number; startSeq: number; endSeq: number; lapTime: number | null }>;
}

const SPEED_OPTIONS = [0.5, 1, 2, 4];

export default function ReplayPage() {
  const params = useParams<{ sessionId: string }>();
  const updateTelemetry = useTelemetryStore((s) => s.updateTelemetry);

  const [sessionIndex, setSessionIndex] = useState<SessionIndex | null>(null);
  const [frames, setFrames] = useState<StoredFrame[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorRef = useRef(0);
  cursorRef.current = cursor;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Fetch session data
  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/api/sessions/${params.sessionId}`).then((r) => r.ok ? r.json() : Promise.reject('Session not found')),
      fetch(`${apiUrl}/api/sessions/${params.sessionId}/frames`).then((r) => r.ok ? r.json() : Promise.reject('Frames not found')),
    ])
      .then(([index, framesData]) => {
        setSessionIndex(index);
        setFrames(framesData);
        if (framesData.length > 0) {
          updateTelemetry(index.racerName, framesData[0].telemetry);
        }
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [params.sessionId, apiUrl, updateTelemetry]);

  // Push current frame to telemetry store
  const emitFrame = useCallback((idx: number) => {
    const frame = frames[idx];
    if (frame && sessionIndex) {
      updateTelemetry(sessionIndex.racerName, frame.telemetry as never);
    }
  }, [frames, sessionIndex, updateTelemetry]);

  // Play/pause logic
  useEffect(() => {
    if (playing && frames.length > 0) {
      const baseInterval = frames.length >= 2
        ? Math.abs(((frames[1].telemetry as { sessionTime?: number }).sessionTime ?? 0) -
                    ((frames[0].telemetry as { sessionTime?: number }).sessionTime ?? 0)) * 1000
        : 16;
      const interval = Math.max(1, baseInterval / speed);

      playTimerRef.current = setInterval(() => {
        const next = cursorRef.current + 1;
        if (next >= frames.length) {
          setPlaying(false);
          return;
        }
        setCursor(next);
        emitFrame(next);
      }, interval);
    }

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [playing, speed, frames, emitFrame]);

  const handleSeek = (frame: number) => {
    setCursor(frame);
    emitFrame(frame);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      setPlaying((p) => !p);
    } else if (e.code === 'ArrowRight') {
      const next = Math.min(cursorRef.current + 1, frames.length - 1);
      setCursor(next);
      emitFrame(next);
    } else if (e.code === 'ArrowLeft') {
      const prev = Math.max(cursorRef.current - 1, 0);
      setCursor(prev);
      emitFrame(prev);
    }
  }, [frames.length, emitFrame]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) return <DashboardShell><p className="text-muted-foreground">Loading session...</p></DashboardShell>;
  if (error) return <DashboardShell><p className="text-red-400">Error: {error}</p></DashboardShell>;

  // Find lap markers for scrubber
  const lapMarkers = sessionIndex?.laps.map((l) => ({
    lap: l.lap,
    position: frames.length > 0 ? l.startSeq / frames.length : 0,
  })) ?? [];

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4">
        {/* Replay header */}
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">REPLAY</span>
          <span className="text-sm text-muted-foreground">
            {sessionIndex?.trackName} — {sessionIndex?.carName} — {sessionIndex?.racerName}
          </span>
        </div>

        {/* Scrubber bar */}
        <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
          <button
            onClick={() => setPlaying(!playing)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {playing ? 'Pause' : 'Play'}
          </button>

          <div className="relative flex-1">
            <input
              type="range"
              min={0}
              max={Math.max(frames.length - 1, 0)}
              value={cursor}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full"
            />
            {/* Lap markers */}
            <div className="absolute top-0 left-0 h-full w-full pointer-events-none">
              {lapMarkers.map((m) => (
                <div
                  key={m.lap}
                  className="absolute top-0 h-full w-px bg-amber-500/40"
                  style={{ left: `${m.position * 100}%` }}
                  title={`Lap ${m.lap}`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Frame {cursor} / {frames.length}</span>
              <span>Lap {frames[cursor]?.lap ?? '-'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-2 py-1 text-xs ${
                  speed === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard components — same as live */}
        <div className="grid gap-4 lg:grid-cols-2">
          <LiveGauges />
          <SessionInfo />
          <FuelManagement />
          <TireStrategy />
        </div>
      </div>
    </DashboardShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/replay/[sessionId]/page.tsx
git commit -m "feat: wire replay page to PlaybackEngine with scrubber and dashboard components"
```

---

## Spec 019: Live Session Sharing

### Task 8: Server-side sharing via Socket.IO rooms

**Files:**
- Modify: `apps/api/src/modules/telemetry/socket-handlers.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add sharing logic to socket-handlers.ts**

Import SessionRegistry at the top:
```typescript
import { SessionRegistry } from '../../services/sharing/session-registry.js';
```

Add `registry` and `sharingCodes` to `SocketHandlerState`:
```typescript
export interface SocketHandlerState {
  relayConnections: Map<string, RelayInfo>;
  racerRelays: Map<string, string>;
  strategyCache: Map<string, StrategyCache>;
  lastTelemetry: Map<string, ProcessedTelemetry>;
  registry: SessionRegistry;
  sharingCodes: Map<string, string>; // racerName → code
}
```

Update `createSocketState()`:
```typescript
export function createSocketState(): SocketHandlerState {
  return {
    relayConnections: new Map(),
    racerRelays: new Map(),
    strategyCache: new Map(),
    lastTelemetry: new Map(),
    registry: new SessionRegistry(),
    sharingCodes: new Map(),
  };
}
```

In `handleIdentify`, after the relay is connected and ack is sent (after the `socket.emit('identify:ack', ...)` line), create a sharing session:
```typescript
// Create sharing session
const { code } = state.registry.createSession(racerName);
state.sharingCodes.set(racerName, code);
socket.emit('sharing:code', { code, racerName });
```

In `handleRelayTelemetry`, after broadcasting to `webapp` and `telemetry`, also broadcast to the sharing room:
```typescript
// Broadcast to sharing viewers
const shareCode = state.sharingCodes.get(data.racerName);
if (shareCode) {
  io.to(`share:${shareCode}`).emit('telemetry:update', {
    racerName: data.racerName,
    telemetry: data.telemetry,
  });
}
```

Also broadcast strategy updates to the sharing room — after `io.to('webapp').emit('strategy:update', strategy)`:
```typescript
if (shareCode) {
  io.to(`share:${shareCode}`).emit('strategy:update', strategy);
}
```

In `handleDisconnect`, when a relay disconnects, end the sharing session:
```typescript
// End sharing session
const shareCode = state.sharingCodes.get(racerName);
if (shareCode) {
  state.registry.endSession(shareCode);
  io.to(`share:${shareCode}`).emit('sharing:ended', { code: shareCode });
  state.sharingCodes.delete(racerName);
}
```

Add a new handler for viewer joins in `registerSocketHandlers`:
```typescript
handleViewerJoin(io, socket, state);
```

Add the handler function:
```typescript
function handleViewerJoin(io: Server, socket: Socket, state: SocketHandlerState): void {
  socket.on('join:share', (data: { code: string; viewerId?: string }) => {
    const session = state.registry.getSession(data.code);
    if (!session) {
      socket.emit('sharing:error', { error: 'Session not found or expired' });
      return;
    }

    const viewerId = data.viewerId || socket.id;
    const added = state.registry.addViewer(data.code, viewerId);
    if (!added) {
      socket.emit('sharing:error', { error: 'Session full (max 10 viewers)' });
      return;
    }

    socket.join(`share:${data.code}`);
    socket.emit('sharing:joined', {
      code: data.code,
      racerName: session.racerName,
      viewerCount: session.viewers.size,
    });

    // Notify driver of viewer count change
    const driverSocketId = state.racerRelays.get(session.racerName);
    if (driverSocketId) {
      io.to(driverSocketId).emit('sharing:viewers', {
        code: data.code,
        viewerCount: session.viewers.size,
      });
    }

    // Clean up on viewer disconnect
    socket.on('disconnect', () => {
      state.registry.removeViewer(data.code, viewerId);
      if (driverSocketId) {
        const updatedSession = state.registry.getSession(data.code);
        if (updatedSession) {
          io.to(driverSocketId).emit('sharing:viewers', {
            code: data.code,
            viewerCount: updatedSession.viewers.size,
          });
        }
      }
    });
  });
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/telemetry/socket-handlers.ts
git commit -m "feat: wire session sharing via Socket.IO rooms"
```

---

### Task 9: Viewer page frontend

**Files:**
- Modify: `apps/web/app/view/[code]/page.tsx`

- [ ] **Step 1: Rewrite the viewer page to connect via Socket.IO and render dashboard**

Replace the entire content of `apps/web/app/view/[code]/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { LiveGauges } from '@/components/telemetry/live-gauges';
import { SessionInfo } from '@/components/telemetry/session-info';
import { FuelManagement } from '@/components/telemetry/fuel-management';
import { TireStrategy } from '@/components/telemetry/tire-strategy';
import type { ProcessedTelemetry } from '@iracing-race-engineer/shared';

export default function ViewerPage() {
  const params = useParams<{ code: string }>();
  const updateTelemetry = useTelemetryStore((s) => s.updateTelemetry);
  const updateStrategy = useTelemetryStore((s) => s.updateStrategy);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'ended'>('connecting');
  const [racerName, setRacerName] = useState<string>('');
  const [viewerCount, setViewerCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
    const socket: Socket = io(wsUrl, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      socket.emit('join:share', { code: params.code });
    });

    socket.on('sharing:joined', (data: { racerName: string; viewerCount: number }) => {
      setStatus('connected');
      setRacerName(data.racerName);
      setViewerCount(data.viewerCount);
    });

    socket.on('sharing:error', (data: { error: string }) => {
      setStatus('error');
      setErrorMsg(data.error);
    });

    socket.on('sharing:ended', () => {
      setStatus('ended');
    });

    socket.on('sharing:viewers', (data: { viewerCount: number }) => {
      setViewerCount(data.viewerCount);
    });

    socket.on('telemetry:update', (data: { racerName: string; telemetry: ProcessedTelemetry }) => {
      updateTelemetry(data.racerName, data.telemetry);
    });

    socket.on('strategy:update', (data: unknown) => {
      updateStrategy(data as never);
    });

    return () => {
      socket.close();
    };
  }, [params.code, updateTelemetry, updateStrategy]);

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4">
        {/* Viewer header */}
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <span className="rounded bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">VIEWER</span>
          {status === 'connected' && (
            <>
              <span className="text-sm">Watching {racerName}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {viewerCount} viewer{viewerCount !== 1 ? 's' : ''} | Code: {params.code}
              </span>
            </>
          )}
          {status === 'connecting' && <span className="text-sm text-muted-foreground">Connecting...</span>}
          {status === 'error' && <span className="text-sm text-red-400">{errorMsg}</span>}
          {status === 'ended' && <span className="text-sm text-amber-400">Session ended</span>}
        </div>

        {/* Dashboard — read-only, same components as driver */}
        {status === 'connected' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <LiveGauges />
            <SessionInfo />
            <FuelManagement />
            <TireStrategy />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/view/[code]/page.tsx
git commit -m "feat: wire viewer page to Socket.IO sharing rooms"
```

---

## Spec 017: Lap Comparison & Telemetry Traces

### Task 10: Analysis page

**Files:**
- Create: `apps/web/app/analysis/page.tsx`

- [ ] **Step 1: Create the analysis page wiring LapComparison and TelemetryTraces to REST data**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { LapComparison } from '@/components/analysis/lap-comparison';
import { TelemetryTraces } from '@/components/analysis/telemetry-traces';

interface SessionSummary {
  sessionId: string;
  racerName: string;
  trackName: string;
  carName: string;
  startTime: number;
  totalLaps: number;
}

interface LapBoundary {
  lap: number;
  startSeq: number;
  endSeq: number;
  lapTime: number | null;
}

interface DeltaPoint {
  dist: number;
  delta: number;
}

interface TracePoint {
  x: number;
  speed: number;
  throttle: number;
  brake: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function AnalysisPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [laps, setLaps] = useState<LapBoundary[]>([]);
  const [traceData, setTraceData] = useState<TracePoint[]>([]);
  const [selectedTraceLap, setSelectedTraceLap] = useState<number | null>(null);

  // Load sessions
  useEffect(() => {
    fetch(`${API_URL}/api/sessions`)
      .then((r) => r.json())
      .then(setSessions)
      .catch(console.error);
  }, []);

  // Load laps when session selected
  useEffect(() => {
    if (!selectedSession) return;
    fetch(`${API_URL}/api/sessions/${selectedSession}/laps`)
      .then((r) => r.json())
      .then((data: LapBoundary[]) => {
        setLaps(data);
        setSelectedTraceLap(null);
        setTraceData([]);
      })
      .catch(console.error);
  }, [selectedSession]);

  // Load trace data for selected lap
  useEffect(() => {
    if (!selectedSession || selectedTraceLap === null) return;
    fetch(`${API_URL}/api/sessions/${selectedSession}/frames?laps=${selectedTraceLap}`)
      .then((r) => r.json())
      .then((frames: Array<{ lapDistPct: number; telemetry: { player: { speed: number; throttle: number; brake: number } } }>) => {
        setTraceData(frames.map((f) => ({
          x: f.lapDistPct,
          speed: f.telemetry.player.speed,
          throttle: f.telemetry.player.throttle,
          brake: f.telemetry.player.brake,
        })));
      })
      .catch(console.error);
  }, [selectedSession, selectedTraceLap]);

  const handleCompareLaps = async (lap1: number, lap2: number): Promise<DeltaPoint[]> => {
    if (!selectedSession) return [];

    const [frames1, frames2] = await Promise.all([
      fetch(`${API_URL}/api/sessions/${selectedSession}/frames?laps=${lap1}`).then((r) => r.json()),
      fetch(`${API_URL}/api/sessions/${selectedSession}/frames?laps=${lap2}`).then((r) => r.json()),
    ]);

    // Simple client-side delta calculation (time difference at each track position)
    const grid = 100;
    const delta: DeltaPoint[] = [];
    for (let i = 0; i <= grid; i++) {
      const dist = i / grid;
      const f1 = findNearest(frames1, dist);
      const f2 = findNearest(frames2, dist);
      if (f1 && f2) {
        const t1 = f1.telemetry.sessionTime ?? 0;
        const t2 = f2.telemetry.sessionTime ?? 0;
        // Normalize to lap-relative time
        const lapStart1 = frames1[0]?.telemetry.sessionTime ?? 0;
        const lapStart2 = frames2[0]?.telemetry.sessionTime ?? 0;
        delta.push({ dist, delta: (t1 - lapStart1) - (t2 - lapStart2) });
      }
    }
    return delta;
  };

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Lap Analysis</h1>

        {/* Session selector */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Session</label>
          <select
            className="rounded-md border bg-secondary px-3 py-1.5 text-sm"
            value={selectedSession ?? ''}
            onChange={(e) => setSelectedSession(e.target.value || null)}
          >
            <option value="">Select session...</option>
            {sessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.trackName} — {s.carName} — {new Date(s.startTime).toLocaleDateString()} ({s.totalLaps} laps)
              </option>
            ))}
          </select>
        </div>

        {/* Lap comparison */}
        {selectedSession && (
          <LapComparison
            laps={laps.map((l) => ({ lap: l.lap, lapTime: l.lapTime }))}
            onCompareLaps={handleCompareLaps}
          />
        )}

        {/* Telemetry traces with lap selector */}
        {selectedSession && laps.length > 0 && (
          <div>
            <div className="mb-2">
              <label className="mb-1 block text-xs text-muted-foreground">Trace Lap</label>
              <select
                className="rounded-md border bg-secondary px-3 py-1.5 text-sm"
                value={selectedTraceLap ?? ''}
                onChange={(e) => setSelectedTraceLap(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Select lap for traces...</option>
                {laps.map((l) => (
                  <option key={l.lap} value={l.lap}>
                    Lap {l.lap} {l.lapTime ? `— ${(l.lapTime).toFixed(3)}s` : ''}
                  </option>
                ))}
              </select>
            </div>
            {traceData.length > 0 && <TelemetryTraces data={traceData} />}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function findNearest(
  frames: Array<{ lapDistPct: number; telemetry: { sessionTime?: number } }>,
  dist: number,
): { telemetry: { sessionTime?: number } } | null {
  if (frames.length === 0) return null;
  let closest = frames[0];
  let minDist = Math.abs(frames[0].lapDistPct - dist);
  for (const f of frames) {
    const d = Math.abs(f.lapDistPct - dist);
    if (d < minDist) {
      minDist = d;
      closest = f;
    }
  }
  return closest;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/analysis/page.tsx
git commit -m "feat: analysis page with lap comparison and telemetry traces"
```

---

## Spec 020: Dashboard Visual Polish

### Task 11: Arc gauge needle physics + shift lights

**Files:**
- Modify: `apps/web/components/gauges/arc-gauge.tsx`
- Create: `apps/web/components/gauges/shift-lights.tsx`

- [ ] **Step 1: Add spring-damper needle physics to arc-gauge.tsx**

Replace the smooth value interpolation `useEffect` (lines 57-69) with a spring-damper model:

```typescript
// Spring-damper needle physics
useEffect(() => {
  let raf: number;
  let velocity = 0;
  const spring = 0.15;
  const damping = 0.85;

  const animate = () => {
    setSmoothValue((prev) => {
      const target = targetRef.current;
      const diff = target - prev;
      velocity = (velocity + diff * spring) * damping;
      if (Math.abs(diff) < 0.1 && Math.abs(velocity) < 0.01) return target;
      return prev + velocity;
    });
    raf = requestAnimationFrame(animate);
  };
  raf = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(raf);
}, []);
```

Also add a redline glow effect in the canvas rendering. After drawing the active arc (after line ~127), add:

```typescript
// Redline glow when in last zone
const lastZone = zones[zones.length - 1];
if (lastZone && pctHundred >= lastZone.start) {
  ctx.shadowColor = lastZone.color;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  const redlineStart = START_ANGLE + (lastZone.start / 100) * SWEEP;
  ctx.arc(cx, cy, outerRadius - arcWidth / 2, redlineStart, activeEnd);
  ctx.strokeStyle = lastZone.color;
  ctx.lineWidth = arcWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.shadowBlur = 0;
}
```

- [ ] **Step 2: Create shift-lights.tsx**

```typescript
'use client';

import { useRef, useEffect } from 'react';

interface ShiftLightsProps {
  rpm: number;
  maxRpm: number;
  /** RPM threshold to start lighting LEDs (default: 70% of max) */
  threshold?: number;
  width?: number;
  height?: number;
}

const LED_COUNT = 12;
const LED_COLORS = [
  '#22c55e', '#22c55e', '#22c55e', '#22c55e', // green
  '#eab308', '#eab308', '#eab308', '#eab308', // yellow
  '#ef4444', '#ef4444',                         // red
  '#3b82f6', '#3b82f6',                         // blue (flash)
];

export function ShiftLights({ rpm, maxRpm, threshold, width = 200, height = 16 }: ShiftLightsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef(false);
  const startThreshold = threshold ?? maxRpm * 0.7;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const ledW = (width - (LED_COUNT - 1) * 3) / LED_COUNT;
    const rpmRange = maxRpm - startThreshold;
    const activeLeds = rpmRange > 0
      ? Math.round(((rpm - startThreshold) / rpmRange) * LED_COUNT)
      : 0;
    const clampedActive = Math.max(0, Math.min(LED_COUNT, activeLeds));

    // Flash all blue when at max
    const isFlashing = clampedActive >= LED_COUNT;
    if (isFlashing) {
      flashRef.current = !flashRef.current;
    }

    for (let i = 0; i < LED_COUNT; i++) {
      const x = i * (ledW + 3);
      const isActive = i < clampedActive;
      const isFlashOff = isFlashing && flashRef.current;

      ctx.beginPath();
      ctx.roundRect(x, 2, ledW, height - 4, 3);

      if (isActive && !isFlashOff) {
        ctx.fillStyle = LED_COLORS[i];
        ctx.shadowColor = LED_COLORS[i];
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = '#1f2937';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [rpm, maxRpm, startThreshold, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block"
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/gauges/arc-gauge.tsx apps/web/components/gauges/shift-lights.tsx
git commit -m "feat: spring-damper needle physics, redline glow, shift lights"
```

---

### Task 12: Color-coded alert system

**Files:**
- Create: `apps/web/hooks/use-alerts.ts`

- [ ] **Step 1: Create the useAlerts hook**

```typescript
import { useMemo } from 'react';
import { useTelemetryStore } from '@/stores/telemetry-store';

export type AlertLevel = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  level: AlertLevel;
  message: string;
  color: string;
  pulse: boolean;
  /** Which dashboard panels this alert applies to */
  panels: string[];
}

export function useAlerts(): Alert[] {
  const data = useTelemetryStore((s) => s.data);

  return useMemo(() => {
    if (!data) return [];

    const alerts: Alert[] = [];
    const fuel = data.fuel;
    const tires = data.tires;
    const session = data.session;

    // Fuel alerts
    if (fuel?.lapsRemaining !== undefined) {
      if (fuel.lapsRemaining < 3 && fuel.lapsRemaining > 0) {
        alerts.push({
          id: 'fuel-critical',
          level: 'critical',
          message: `FUEL CRITICAL: ${fuel.lapsRemaining.toFixed(1)} laps`,
          color: '#ef4444',
          pulse: true,
          panels: ['fuel', 'strategy'],
        });
      } else if (fuel.lapsRemaining < 5 && fuel.lapsRemaining > 0) {
        alerts.push({
          id: 'fuel-low',
          level: 'warning',
          message: `Low fuel: ${fuel.lapsRemaining.toFixed(1)} laps`,
          color: '#f59e0b',
          pulse: false,
          panels: ['fuel'],
        });
      }
    }

    // Tire alerts
    if (tires) {
      const avgWear = ((tires.lf?.avgWear ?? tires.lf?.wear ?? 1) +
                       (tires.rf?.avgWear ?? tires.rf?.wear ?? 1) +
                       (tires.lr?.avgWear ?? tires.lr?.wear ?? 1) +
                       (tires.rr?.avgWear ?? tires.rr?.wear ?? 1)) / 4;
      const wearPct = avgWear * 100;

      if (wearPct < 20) {
        alerts.push({
          id: 'tire-critical',
          level: 'critical',
          message: `TIRES CRITICAL: ${wearPct.toFixed(0)}%`,
          color: '#ef4444',
          pulse: true,
          panels: ['tires', 'strategy'],
        });
      } else if (wearPct < 30) {
        alerts.push({
          id: 'tire-warning',
          level: 'warning',
          message: `Tire wear: ${wearPct.toFixed(0)}%`,
          color: '#f59e0b',
          pulse: false,
          panels: ['tires'],
        });
      }
    }

    // Flag alerts
    if (session?.flags) {
      const flags = session.flags;
      if (flags & 0x00000008) { // Yellow
        alerts.push({ id: 'flag-yellow', level: 'warning', message: 'YELLOW FLAG', color: '#eab308', pulse: false, panels: ['session'] });
      }
      if (flags & 0x00000010) { // Red
        alerts.push({ id: 'flag-red', level: 'critical', message: 'RED FLAG', color: '#ef4444', pulse: true, panels: ['session'] });
      }
      if (flags & 0x00000020) { // Blue
        alerts.push({ id: 'flag-blue', level: 'info', message: 'BLUE FLAG', color: '#3b82f6', pulse: true, panels: ['session'] });
      }
    }

    return alerts;
  }, [data]);
}

/** Get the highest-priority alert color for a panel */
export function useAlertColor(panelId: string): { color: string; pulse: boolean } | null {
  const alerts = useAlerts();
  const match = alerts.find((a) => a.panels.includes(panelId));
  if (!match) return null;
  return { color: match.color, pulse: match.pulse };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/use-alerts.ts
git commit -m "feat: color-coded alert system with useAlerts hook"
```

---

### Task 13: Run full test suite and verify

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript check**

Run: `cd apps/api && npx tsc --noEmit && cd ../../tools/relay && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Final commit if any fixes needed**

---

## Summary

| Task | Spec | What | New Tests |
|------|------|------|-----------|
| 1 | 022 | transformTelemetry unit tests | 10 |
| 2 | 022 | lap-analyzer unit tests | 8 |
| 3 | 022 | ws-server integration tests | 12 |
| 4 | 021 | Session REST endpoints | — |
| 5 | 021 | Live telemetry + strategy REST endpoints | — |
| 6 | 018 | Session browser page | — |
| 7 | 018 | Replay page with PlaybackEngine | — |
| 8 | 019 | Server-side session sharing | — |
| 9 | 019 | Viewer page frontend | — |
| 10 | 017 | Analysis page (lap comparison + traces) | — |
| 11 | 020 | Gauge needle physics + shift lights | — |
| 12 | 020 | Alert system hook | — |
| 13 | — | Full test suite verification | — |
