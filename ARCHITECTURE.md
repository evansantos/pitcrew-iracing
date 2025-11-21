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
│                    Backend API (Fastify)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Telemetry Processing Pipeline             │   │
│  │  - node-irsdk Reader                                │   │
│  │  - Data Validation (Zod)                            │   │
│  │  - Strategy Calculations                            │   │
│  │  - Event Detection                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │  PostgreSQL  │   │    Redis     │   │   BullMQ     │   │
│  │  (History)   │   │   (Cache)    │   │  (Jobs)      │   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │ WebSocket (Socket.io)
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
iRacing SDK → node-irsdk → TelemetryService
    ↓
Validation (Zod schemas)
    ↓
ProcessedTelemetry
    ↓
├─→ WebSocket (immediate broadcast)
├─→ Redis Cache (recent data)
└─→ PostgreSQL (historical storage)
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
├── database/
│   ├── schema.ts             # Drizzle schema definitions
│   └── migrations/           # Database migrations
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

## Database Schema

### PostgreSQL Tables

```sql
-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  session_type VARCHAR(50),
  track_name VARCHAR(255),
  track_id INTEGER,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Telemetry History (Time-series data)
CREATE TABLE telemetry (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  timestamp BIGINT,
  session_time REAL,
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Race Events
CREATE TABLE race_events (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  event_type VARCHAR(50),
  timestamp BIGINT,
  session_time REAL,
  lap INTEGER,
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pit Stops
CREATE TABLE pit_stops (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  car_idx INTEGER,
  lap INTEGER,
  pit_in_time REAL,
  pit_out_time REAL,
  duration REAL,
  reason VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_telemetry_session ON telemetry(session_id, timestamp);
CREATE INDEX idx_events_session ON race_events(session_id, timestamp);
CREATE INDEX idx_pitstops_session ON pit_stops(session_id, lap);
```

### Redis Cache Structure

```
# Session data (TTL: 24h)
session:{sessionId}:info -> SessionInfo
session:{sessionId}:telemetry -> ProcessedTelemetry (latest)
session:{sessionId}:opponents -> OpponentData[]

# Real-time buffers (TTL: 1h)
telemetry:buffer:{sessionId} -> CircularBuffer<Telemetry>
strategy:current:{sessionId} -> StrategyRecommendation

# Connection tracking
connections:active -> Set<socketId>
```

## Performance Optimization

### Backend Optimizations

1. **Telemetry Processing**
   - Circular buffers for in-memory telemetry history
   - Batch database writes every 5 seconds
   - Separate worker threads for CPU-intensive calculations

2. **WebSocket Optimization**
   - Binary protocol for telemetry data (smaller payload)
   - Throttling/debouncing for non-critical updates
   - Room-based broadcasting for multi-user support

3. **Caching Strategy**
   - Redis for frequently accessed data
   - In-memory cache for current session
   - Stale-while-revalidate for historical data

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

## Deployment Architecture

### Development

```
Local Machine:
- pnpm dev (all services)
- PostgreSQL (Docker or local)
- Redis (Docker or local)
```

### Production

```
Kubernetes Cluster:
├── API Pods (3 replicas)
│   └── Horizontal Pod Autoscaler
├── Web Pods (2 replicas)
│   └── CDN (CloudFlare)
├── PostgreSQL (Managed Service)
├── Redis Cluster (Managed Service)
└── Load Balancer
```

## Security Considerations

1. **API Security**
   - Rate limiting on all endpoints
   - CORS configuration for production
   - Input validation with Zod
   - SQL injection prevention (parameterized queries)

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
- Database query performance
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
- Database connection failures
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
