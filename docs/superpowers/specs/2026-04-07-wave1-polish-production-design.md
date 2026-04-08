# Wave 1: Polish & Production — Design Spec

**Goal:** Fill gaps in the current implementation — wire up partially-built features, add missing REST endpoints, polish the dashboard, and backfill test coverage. This wave makes the platform production-ready and provides the foundation for Waves 2-4.

**Wave Scope:** 6 specs (017-022)

**Prerequisites:** All 16 previous specs merged to main.

---

## Spec 017 — Lap Comparison & Telemetry Traces

### Overview
Wire the existing `lap-comparison.tsx` and `telemetry-traces.tsx` components to real data. Add a standalone analysis page and a real-time delta widget on the live dashboard.

### Architecture

**Analysis Page (`/analysis`)**
- Lap picker: select session → select 2 laps to compare
- Delta graph: time delta vs track position (X = lapDistPct 0-1, Y = delta seconds)
- Telemetry overlay: speed/throttle/brake traces for both laps, color-coded
- Data from FileStore via REST endpoints (spec 021)

**Dashboard Widget**
- Compact inline graph: current lap delta vs best lap
- Updates in real-time as `lapDistPct` advances
- Shows cumulative time gained/lost with color (green = faster, red = slower)
- Collapses to a single number (e.g., "+0.3s") when space is tight

**Data Flow**
```
FileStore → GET /api/sessions/:id/frames?laps=X,Y → lap-delta.ts (calculateLapDelta) → Recharts
```

For the live widget:
```
Socket.IO telemetry:update → accumulate current lap frames in memory → compare vs stored best lap → render delta
```

### Components
- `apps/web/app/analysis/page.tsx` — new route, analysis page
- `apps/web/components/analysis/lap-comparison.tsx` — modify existing, wire to real data
- `apps/web/components/analysis/telemetry-traces.tsx` — modify existing, wire to Recharts
- `apps/web/components/analysis/live-delta-widget.tsx` — new, compact dashboard widget
- `apps/api/src/services/analysis/lap-delta.ts` — existing, no changes needed

### Acceptance Criteria
- User can select any 2 laps from a session and see delta + trace overlay
- Live delta widget updates at 60Hz during active session
- Delta graph handles laps of different lengths (interpolation via `interpolateToGrid`)
- Empty state when no laps recorded yet

---

## Spec 018 — End-to-End Session Replay

### Overview
Wire the existing `PlaybackEngine` to feed frames into the same telemetry store the live dashboard uses. Add a scrubber bar. Reuse the entire live dashboard layout.

### Architecture

**Replay Flow**
```
/replay/[sessionId] page loads
  → fetch session index (GET /api/sessions/:id)
  → fetch all frames (GET /api/sessions/:id/frames)
  → initialize PlaybackEngine with frames
  → PlaybackEngine.onFrame → telemetryStore.setState()
  → dashboard components render (same as live)
```

**Scrubber Bar**
- Timeline with lap markers (colored ticks at lap boundaries)
- Draggable playhead for seeking
- Current time / total time display
- Speed selector: 0.5x, 1x, 2x, 4x buttons
- Play/pause toggle
- Keyboard shortcuts: Space (play/pause), Left/Right arrows (step), +/- (speed)

**Session Browser**
- `/replay` route: list all stored sessions from `GET /api/sessions`
- Cards showing: track, car, racer, date, lap count, duration
- Click to open replay

### Components
- `apps/web/app/replay/page.tsx` — new, session browser/list
- `apps/web/app/replay/[sessionId]/page.tsx` — modify existing, wire to PlaybackEngine
- `apps/web/components/replay/scrubber-bar.tsx` — new, timeline + controls
- `apps/web/components/replay/session-card.tsx` — new, session list item
- `apps/api/src/services/replay/playback-engine.ts` — existing, add `onFrame` callback

### Acceptance Criteria
- User can browse stored sessions and click to replay
- Full dashboard renders with replayed data (gauges, track map, strategy, opponents)
- Scrubber shows lap boundaries, allows seeking to any point
- Speed controls work (0.5x-4x)
- Keyboard shortcuts functional
- Play/pause toggles cleanly without frame skips

---

## Spec 019 — Live Session Sharing

### Overview
Wire Socket.IO rooms so viewers at `/view/[code]` receive the same telemetry stream as the driver's dashboard.

### Architecture

**Driver Side**
1. Driver connects via relay → `identify` event → server creates sharing session via `SessionRegistry`
2. Server emits `sharing:code` event to driver with 6-char code
3. All `telemetry:update` and `strategy:update` events for this racer are also emitted to room `share:{code}`
4. Driver's dashboard shows sharing code + viewer count badge

**Viewer Side**
1. Viewer navigates to `/view/{code}`
2. Frontend connects Socket.IO, sends `join:share` with code
3. Server validates code via SessionRegistry, calls `addViewer`, joins socket to room `share:{code}`
4. Viewer receives `telemetry:update` and `strategy:update` events
5. Dashboard renders in read-only mode (no AI chat input, no settings)

**Lifecycle**
- Code created on relay identify, active while driver connected
- On driver disconnect: session marked inactive, 5-min grace period
- If driver reconnects within grace: same code reactivated
- After expiry: code deleted, viewers get `sharing:ended` event
- Max 10 viewers per code (enforced by SessionRegistry)

### Components
- `apps/api/src/modules/telemetry/socket-handlers.ts` — modify, add room broadcasting + sharing events
- `apps/web/app/view/[code]/page.tsx` — modify existing, wire Socket.IO join + full dashboard
- `apps/web/components/sharing/share-badge.tsx` — new, shows code + viewer count on driver dashboard
- `apps/web/components/sharing/viewer-banner.tsx` — new, "Viewing {racer}'s session" header for viewers

### Acceptance Criteria
- Driver sees a sharing code on their dashboard when connected
- Viewer enters code at `/view/{code}` and sees live telemetry (< 500ms lag)
- Viewer count updates in real-time on driver's dashboard
- Viewer gets `sharing:ended` event when session expires
- Max 10 viewers enforced (11th gets rejection)
- Read-only mode: no AI chat input, no settings panels

---

## Spec 020 — Dashboard Visual Polish

### Overview
Three visual improvements: refined arc gauges with needle physics, customizable panel layout, and color-coded alert system.

### 020a — Arc Gauge Refinement

**Needle Physics**
- Spring-damper model: `velocity += (target - current) * spring - velocity * damping`
- Configurable spring (default 0.15) and damping (default 0.85)
- Renders at 60fps via `useAnimationFrame` hook (already exists)

**Redline Indicator**
- Red arc segment on RPM gauge above configurable threshold
- Pulsing glow effect when RPM enters redline zone

**Shift Light Bar**
- Row of LEDs above RPM gauge: green → yellow → red → blue (flash)
- Thresholds configurable per car (stored in localStorage)

**Canvas Rendering**
- All gauge rendering stays on `<canvas>` for performance
- No DOM elements inside the gauge (avoid layout thrashing at 60Hz)

### 020b — Customizable Layout

**Grid System**
- CSS Grid with named areas
- Panels: gauges, track-map, strategy, opponents, lap-times, tire-monitor, fuel, ai-chat, delta-widget
- Default layout provided, user can customize

**Drag-and-Drop**
- Pointer events for drag (no external DnD library)
- Visual feedback: ghost panel + drop zone highlight
- Snap to grid cells

**Persistence**
- Layouts saved to localStorage keyed by `layout:{car}_{track}` (or `layout:default`)
- Reset to default button
- Import/export layout as JSON (for sharing between setups)

### 020c — Color-Coded Alerts

**Alert Levels**
| Condition | Color | Animation |
|-----------|-------|-----------|
| Critical fuel (< 3 laps) | Red | Pulsing border, 1Hz |
| Low fuel (< 5 laps) | Amber | Solid border |
| Tire wear critical (< 20%) | Red | Pulsing border, 1Hz |
| Tire wear warning (< 30%) | Amber | Solid border |
| Optimal pit window | Green | Gentle pulse, 0.5Hz |
| Yellow flag | Yellow | Solid overlay |
| Red flag | Red | Solid overlay |
| Blue flag | Blue | Flash, 2Hz |

**Implementation**
- Alert state derived from telemetry + strategy in the store
- CSS custom properties for alert colors (themeable)
- `useAlerts()` hook computes active alerts from telemetry store
- Panel border color changes based on highest-priority alert affecting that panel

### Components
- `apps/web/components/gauges/arc-gauge.tsx` — modify, add needle physics + redline + shift lights
- `apps/web/components/gauges/shift-lights.tsx` — new, LED bar component
- `apps/web/components/dashboard/dashboard-shell.tsx` — modify, add grid customization
- `apps/web/components/dashboard/panel-wrapper.tsx` — new, draggable panel with alert borders
- `apps/web/components/dashboard/layout-manager.tsx` — new, save/load/reset controls
- `apps/web/hooks/use-alerts.ts` — new, derives alert state from telemetry
- `apps/web/hooks/use-layout.ts` — new, layout persistence + DnD state

### Acceptance Criteria
- Gauges animate smoothly at 60fps with spring-damper needle
- Shift lights activate progressively as RPM rises
- User can drag panels to rearrange the dashboard
- Layout persists across page reloads
- Alert borders pulse/glow based on current conditions
- No performance regression (maintain 60fps with all features active)

---

## Spec 021 — REST API Endpoints

### Overview
Replace 501 stubs with real endpoints. REST for queries/historical data, Socket.IO stays for real-time.

### Endpoints

**Session Endpoints**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List all stored sessions (from FileStore) |
| GET | `/api/sessions/:id` | Session index (metadata, lap boundaries) |
| GET | `/api/sessions/:id/frames` | Query frames with filters |
| GET | `/api/sessions/:id/laps` | Lap times and boundaries |
| DELETE | `/api/sessions/:id` | Delete a stored session |

**Live Telemetry Endpoints**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/telemetry/live` | List active racers |
| GET | `/api/telemetry/live/:racerName` | Latest telemetry snapshot |
| GET | `/api/strategy/live/:racerName` | Latest strategy snapshot |

**Query Parameters for `/api/sessions/:id/frames`**
- `laps` — comma-separated lap numbers (e.g., `?laps=3,5`)
- `timeStart`, `timeEnd` — session time range in seconds
- `downsample` — take every Nth frame (e.g., `?downsample=10`)
- `limit` — max frames returned (default 10000)

### Implementation
- New route files: `apps/api/src/modules/session/index.ts` (extend), `apps/api/src/modules/telemetry/index.ts` (extend)
- FileStore already has `listSessions()`, `getSessionIndex()`, `getFrames()` — endpoints are thin wrappers
- Live telemetry snapshots read from socket handler state (last known telemetry per racer)
- Strategy snapshots read from strategy cache in socket handler state

### Acceptance Criteria
- All endpoints return proper JSON with correct HTTP status codes
- Query parameters filter correctly (tested)
- `GET /api/sessions` returns paginated list sorted by startTime desc
- `GET /api/telemetry/live/:racerName` returns 404 if racer not connected
- `DELETE /api/sessions/:id` removes session data from disk
- No 501 responses remain

---

## Spec 022 — Test Coverage Hardening

### Overview
Backfill tests for the 4 untested source files identified in PR review. Hybrid approach: unit tests for pure functions, integration tests for WebSocket protocol.

### Test Plan

**Unit Tests: `transformTelemetry`** (~10 tests)
- File: `tools/relay/src/__tests__/iracing-client.test.ts`
- Speed conversion (m/s → km/h): zero, normal, null
- Fuel estimation: normal, zero lap time, zero fuel use
- FuelLevelPct scaling (0-1 → 0-100)
- Humidity scaling (0-1 → 0-100)
- All null/undefined inputs → safe defaults
- Gear, lap, position passthrough

**Unit Tests: `lap-analyzer`** (~8 tests)
- File: `apps/api/src/services/ai/__tests__/lap-analyzer.test.ts`
- Braking zone detection (high brake + deceleration)
- Throttle application detection (low throttle in acceleration zone)
- Cornering detection (lateral force indicators)
- Empty frames input
- Single frame input
- Frames with no improvement areas

**Unit Tests: socket-handlers strategy calc** (~8 tests)
- File: `apps/api/src/modules/telemetry/__tests__/socket-handlers.test.ts`
- Tire health with avgWear field (shared TireData)
- Tire health with wear field (relay TireCorner)
- Tire health with no tire data (defaults to 1.0)
- Fuel urgency in unlimited session (practice)
- Fuel urgency in race session
- Pit window calculation (fuel + tires combined)
- Strategy throttling (same lap = no recalculation)

**Integration Tests: `ws-server`** (~12 tests)
- File: `tools/relay/src/__tests__/ws-server.test.ts`
- Server starts and accepts connections
- v1 handshake → receives handshake_ack with version
- v2 handshake → negotiates version, receives ack
- v2 subscribe → acknowledged
- v2 ping → receives pong with matching seq
- Heartbeat sends ping to v2 clients only
- broadcastTelemetry → v1 clients get legacy format
- broadcastTelemetry → v2 clients get envelope format
- Client disconnect → removed from clients map
- Malformed JSON → logged as parse error, does not crash
- handleMessage error → logged separately from parse error
- Graceful shutdown → clients notified, server closes

### Acceptance Criteria
- ~38 new tests across 4 test files
- All new tests pass
- No existing tests broken
- Integration tests use real WebSocket connections (not mocks)
- Tests run in < 5 seconds total

---

## Roadmap Context

This is Wave 1 of 4:

| Wave | Theme | Specs |
|------|-------|-------|
| **1 (this)** | Polish & Production | 017-022 |
| 2 | Competitive Edge | 023-028 |
| 3 | Social & Multi-user | 029-034 |
| 4 | Mobile & Accessibility | 035-040 |

**Implementation order within Wave 1:**
1. **022** (tests) — builds confidence for refactoring
2. **021** (REST endpoints) — required by 017 and 018
3. **019** (session sharing) — independent
4. **017** (lap comparison) — depends on 021
5. **018** (replay) — depends on 021
6. **020** (visual polish) — independent, can parallel with 017-019

Wave 2 builds on the REST endpoints (spec 021) for data access and the test coverage (spec 022) for confidence. Wave 3 builds on session sharing (spec 019). Wave 4 builds on the REST API for mobile data access.
