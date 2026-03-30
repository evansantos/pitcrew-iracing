# Architecture Documentation

## System Overview

The iRacing Race Engineer is a real-time telemetry analysis and race strategy application designed to process high-frequency data from the iRacing SDK and provide actionable insights to drivers during races.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        iRacing SDK                          │
│                     (Windows Process)                       │
└───────────────────────┬─────────────────────────────────────┘
                        │ Memory Mapped Files
                        │ 60Hz Telemetry Data
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Relay (Python or TypeScript)                   │
│          tools/relay/ — raw WebSocket bridge                │
│       Forwards SDK frames to the API over WebSocket         │
└───────────────────────┬─────────────────────────────────────┘
                        │ WebSocket (ws)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Fastify) — port 3000              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Telemetry Processing Pipeline             │   │
│  │  - Remote Telemetry Service (WebSocket client)      │   │
│  │  - Data Validation (Zod)                            │   │
│  │  - Strategy Calculations                            │   │
│  │  - Event Detection                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│  ┌──────────────────┐   ┌──────────────────────────────┐   │
│  │  In-Memory Cache │   │  Session Manager (in-memory) │   │
│  │  (Map-based)     │   │  Lap history, session state  │   │
│  └──────────────────┘   └──────────────────────────────┘   │
│                                                             │
│  Socket.IO server shares port 3000 with the HTTP API       │
└───────────────────────┬─────────────────────────────────────┘
                        │ WebSocket (Socket.IO on port 3000)
                        │ Real-time Events
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (Next.js 15)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Real-time Dashboard Components             │   │
│  │  - Track Map (D3.js)                                │   │
│  │  - Telemetry Displays                               │   │
│  │  - Strategy Widgets                                 │   │
│  │  - Voice Alerts (Web Speech API)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  State Management: Zustand + TanStack Query                │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Telemetry Ingestion (60Hz)

```typescript
iRacing SDK → Relay (WebSocket) → RemoteTelemetryService
    ↓
Validation (Zod schemas)
    ↓
ProcessedTelemetry
    ↓
├─→ Socket.IO (immediate broadcast on port 3000)
└─→ In-Memory Session Manager (lap history, session state)
```

### 2. Strategy Calculation Pipeline

```typescript
ProcessedTelemetry
    ↓
StrategyEngine.analyze()
    ↓
├─→ FuelCalculator      → FuelStrategy
├─→ TireAnalyzer        → TireStrategy
├─→ PitWindowCalculator → PitWindowRecommendation
├─→ OpponentTracker     → GapAnalysis
└─→ OpportunityDetector → StrategyOpportunities
    ↓
Combined StrategyRecommendation
    ↓
WebSocket Broadcast → Frontend
```

### 3. Real-time Updates

```typescript
// Backend: Emit events at different frequencies
Telemetry Updates:    60 Hz (every 16.67ms)
Strategy Updates:     1 Hz  (every 1000ms)
Opponent Updates:     10 Hz (every 100ms)
Session Events:       On change

// Frontend: Subscribe to relevant channels
WebSocket.on('telemetry:update', updateDashboard)
WebSocket.on('strategy:update', updateStrategy)
WebSocket.on('pit:event', showAlert)
```

## Backend Architecture

### Module Structure

```
apps/api/src/
├── config/
│   └── index.ts              # Environment configuration
├── modules/
│   ├── telemetry/
│   │   ├── service.ts        # TelemetryService (SDK connection)
│   │   ├── processor.ts      # Data processing logic
│   │   ├── routes.ts         # HTTP endpoints
│   │   └── events.ts         # Event emitters
│   ├── session/
│   │   ├── service.ts        # Session management
│   │   ├── routes.ts         # Session endpoints
│   │   └── store.ts          # Session state storage
│   ├── analysis/
│   │   ├── strategy.ts       # Strategy engine
│   │   ├── fuel.ts           # Fuel calculations
│   │   ├── tires.ts          # Tire analysis
│   │   └── opponents.ts      # Opponent tracking
│   └── voice/
│       ├── service.ts        # TTS service
│       └── alerts.ts         # Alert definitions
├── websocket/
│   ├── server.ts             # Socket.io server setup
│   └── handlers.ts           # Event handlers
├── services/
│   ├── strategy/             # Strategy engine + calculators
│   │   └── __tests__/        # Strategy engine test suite
│   ├── remote-telemetry/     # WebSocket client for relay
│   └── ai/                   # AI service integrations
└── utils/
    ├── logger.ts             # Pino logger
    └── validation.ts         # Validation helpers
```

### Key Services

#### TelemetryService

**Responsibilities:**
- Connect to iRacing SDK via node-irsdk
- Read telemetry at 60Hz
- Parse and validate raw data
- Emit processed telemetry events

**Performance Targets:**
- Latency: < 50ms from SDK to WebSocket
- Memory: < 100MB for telemetry buffer
- CPU: < 10% on modern hardware

#### StrategyEngine

**Responsibilities:**
- Calculate optimal pit windows
- Analyze fuel consumption trends
- Track tire degradation
- Detect undercut/overcut opportunities
- Generate recommendations

**Performance Targets:**
- Calculation time: < 100ms
- Update frequency: 1Hz for non-critical, real-time for critical events

## Frontend Architecture

### Component Hierarchy

```
App (Layout)
├── Providers (Query, State)
├── DashboardShell
│   ├── Header (Session Info, Connection Status)
│   └── Dashboard (Grid Layout)
│       ├── TelemetryPanel
│       │   ├── SpeedGauge
│       │   ├── RPMGauge
│       │   └── InputDisplay
│       ├── TrackMapPanel
│       │   ├── TrackVisualization (D3.js)
│       │   └── PositionMarkers
│       ├── OpponentsPanel
│       │   ├── OpponentList
│       │   └── GapAnalysis
│       ├── StrategyPanel
│       │   ├── PitWindowDisplay
│       │   ├── FuelCalculator
│       │   └── TireManagement
│       └── AlertsPanel
│           └── VoiceAlertsList
```

### State Management

**Zustand Stores:**

```typescript
// Telemetry Store (High-frequency updates)
useTelemetryStore: {
  data: ProcessedTelemetry | null;
  connected: boolean;
  updateTelemetry: (data: ProcessedTelemetry) => void;
}

// Session Store
useSessionStore: {
  session: RaceSession | null;
  opponents: OpponentData[];
  events: RaceEvent[];
  updateSession: (session: RaceSession) => void;
}

// Strategy Store
useStrategyStore: {
  recommendation: StrategyRecommendation | null;
  opportunities: StrategyOpportunity[];
  updateStrategy: (rec: StrategyRecommendation) => void;
}
```

**TanStack Query:**
- Historical data fetching
- Session history
- Lap time analysis
- Caching with stale-while-revalidate

### Real-time Hooks

```typescript
// useWebSocket - Main WebSocket connection
const { connected, socket } = useWebSocket();

// useTelemetry - Subscribe to telemetry updates
const { data, isLive } = useTelemetry();

// useStrategy - Strategy recommendations
const { recommendation, opportunities } = useStrategy();

// useOpponents - Opponent tracking
const { opponents, gaps } = useOpponents();
```

## Storage

### In-Memory Session Manager

All session and lap data is held in-memory via `SessionManager` (a singleton).
There is no external database — the application is stateless across restarts.

```typescript
SessionManager {
  currentSession: SessionData | null   // track, car, driver, session type
  lapHistory: Map<number, LapData>     // keyed by lap number
}
```

Key operations:
- `startSession()` / `endSession()` — lifecycle management
- `recordLap()` — append lap telemetry
- `getRecentLaps(count)` — last N laps for strategy calculations

### In-Memory Cache

Frequently accessed data (current telemetry snapshot, latest strategy
recommendation) is stored in plain JavaScript `Map` objects within each
service. No external cache (Redis or otherwise) is required.

## Performance Optimization

### Backend Optimizations

1. **Telemetry Processing**
   - Circular buffers for in-memory telemetry history
   - All state held in-memory (no database I/O overhead)
   - Separate worker threads for CPU-intensive calculations

2. **WebSocket Optimization**
   - Binary protocol for telemetry data (smaller payload)
   - Throttling/debouncing for non-critical updates
   - Room-based broadcasting for multi-user support

3. **Caching Strategy**
   - In-memory Maps for frequently accessed data
   - Session Manager holds current session and lap history
   - Stale-while-revalidate on the frontend via TanStack Query

### Frontend Optimizations

1. **Rendering Performance**
   - React.memo for expensive components
   - Virtual scrolling for opponent lists
   - Canvas-based rendering for high-frequency displays
   - RequestAnimationFrame for smooth animations

2. **Bundle Optimization**
   - Code splitting by route
   - Dynamic imports for heavy components
   - Tree shaking unused exports
   - Optimize package imports

3. **Data Handling**
   - Zustand for minimal re-renders
   - Selective subscription to state slices
   - Debouncing non-critical updates
   - Web Workers for heavy calculations

## Deployment

### Development

```
Local Machine:
- pnpm dev          → starts API (port 3000) + Next.js frontend
- Relay (optional)  → tools/relay/ on Windows for live iRacing data
- No external services required (no DB, no cache daemon)
```

### TypeScript Relay (`tools/relay/`)

A lightweight raw-WebSocket server that runs on the Windows machine where
iRacing is active. It reads SDK memory-mapped files and forwards telemetry
frames over WebSocket to the API. This is an alternative to the original
Python relay, rewritten in TypeScript for tighter integration with the
monorepo toolchain.

```
tools/relay/
├── src/
│   ├── index.ts        # Entry point + CLI (--mock flag)
│   ├── ws-server.ts    # WebSocket server on port 3002
│   ├── encoder.ts      # Binary frame encoder
│   ├── types.ts        # Shared telemetry types
│   └── __tests__/      # Encoder unit tests (Vitest)
├── package.json
└── tsconfig.json
```

## Security Considerations

1. **API Security**
   - Rate limiting on all endpoints
   - CORS configuration for production
   - Input validation with Zod

2. **WebSocket Security**
   - Authentication token verification
   - Connection rate limiting
   - Message size limits
   - Automatic disconnect on suspicious activity

3. **Data Privacy**
   - No PII stored without consent
   - Session data retention policy
   - Encryption at rest for sensitive data

## Monitoring & Observability

### Metrics

- Telemetry processing latency (P50, P95, P99)
- WebSocket message rate
- Active connections count
- API response times
- Memory/CPU usage

### Logging

```typescript
// Structured logging with Pino
logger.info({ sessionId, lap, event }, 'Pit stop detected');
logger.warn({ latency }, 'High telemetry latency');
logger.error({ error }, 'Failed to process telemetry');
```

### Alerting

- Telemetry processing > 100ms
- WebSocket disconnect rate > 10%
- Memory usage > 80%
- Error rate > 1%

## Future Enhancements

1. **Machine Learning Integration**
   - Predictive lap times
   - Tire deg prediction
   - Optimal racing line analysis

2. **Multi-user Support**
   - Team radio integration
   - Shared strategy planning
   - Spotter coordination

3. **Advanced Analytics**
   - Post-race analysis dashboard
   - Performance comparison tools
   - Setup correlation analysis

4. **Mobile Support**
   - React Native app
   - Simplified mobile UI
   - Push notifications
