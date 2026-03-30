# iRacing Race Engineer

Real-time racing engineer application that connects to iRacing telemetry during live races. Provides strategic analysis, opponent tracking, pit stop monitoring, and race strategy calculations.

## Features

- **Real-time Telemetry Processing** — 60Hz telemetry data from iRacing SDK
- **Strategic Analysis Engine** — Optimal pit windows, fuel calculations, tire management
- **AI Race Engineer Assistant** — Natural language race advice powered by local LLM (Ollama)
- **Opponent Tracking** — Live position tracking for all drivers
- **Pit Stop Analysis** — Real-time pit stop detection and strategy
- **Voice Alerts** — Text-to-speech race engineer notifications
- **Multi-class Support** — Filter and analyze by car class

## Architecture

This is a monorepo built with:

- **Backend**: Fastify 5.x + Socket.io for real-time telemetry streaming
- **Frontend**: Next.js 15 + React 19 RC with App Router
- **Monorepo**: Turborepo with pnpm workspaces

### Project Structure

```
iracing-race-engineer/
├── apps/
│   ├── api/                    # Fastify backend API
│   │   └── src/
│   │       ├── config/         # Configuration management
│   │       ├── modules/        # Feature modules (telemetry, session)
│   │       └── utils/          # Utilities (logger, etc)
│   │
│   └── web/                    # Next.js 15 frontend
│       ├── app/                # App Router pages
│       ├── components/         # React components
│       └── hooks/              # Custom hooks (WebSocket, etc)
│
└── packages/
    └── shared/                 # Shared TypeScript types and schemas
        └── src/
            ├── types/          # Core type definitions
            └── schemas/        # Zod validation schemas
```

## Prerequisites

- **Node.js** 22.x or higher
- **pnpm** 9.x or higher
- **iRacing** subscription and SDK access (Windows only for live telemetry)

> **Platform Note**: The iRacing SDK (`node-irsdk`) only works on **Windows** as it requires access to iRacing's memory-mapped files. On macOS/Linux, the application runs in **mock mode** for development, which is perfect for building UI and testing features without needing Windows.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure (optional)
cp .env.example .env
# Edit .env — set IRACING_RELAY_HOST if using a remote Windows machine

# 3. Run
pnpm dev
```

The application will be available at:
- **Frontend**: http://localhost:3003
- **API**: http://localhost:3000

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```env
# iRacing Mode: 'local' | 'remote' | 'mock'
IRACING_MODE=mock

# For remote mode — Windows machine running iRacing SDK relay
IRACING_RELAY_HOST=192.168.1.100
IRACING_RELAY_PORT=3002

# API port
API_PORT=3000

# AI (optional — requires Ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

## AI Race Engineer (Optional)

The app includes an AI-powered race engineer assistant that runs locally using [Ollama](https://ollama.ai). This is **optional** — the app works fine without it.

```bash
# Automated setup
pnpm setup-ai

# Or manual setup
brew install ollama       # macOS
ollama pull llama3.1:8b
ollama serve
```

When the backend starts you'll see:
- ✅ `AI Race Engineer ready with 1 model(s)` — AI is working
- ⚠️ `AI Race Engineer unavailable` — Ollama not running (app still works without AI)

## Development

### Building

```bash
pnpm build

# Build specific package
pnpm --filter @iracing-race-engineer/api build
pnpm --filter @iracing-race-engineer/web build
```

### Type Checking

```bash
pnpm type-check
```

### Testing

```bash
pnpm test
```

### Linting & Formatting

```bash
pnpm lint
pnpm format
```

## API Endpoints

### Health Check
```
GET /health
```

### Telemetry
```
GET /api/telemetry            # Current telemetry snapshot
GET /api/telemetry/history    # Historical telemetry data
GET /api/telemetry/opponents  # Opponent tracking data
```

### Session
```
GET /api/session              # Current session info
GET /api/session/history      # Session history
```

### AI Race Engineer
```
POST /api/race-engineer/advice  # Get race engineering advice
GET  /api/race-engineer/status  # Check AI availability
POST /api/race-engineer/reset   # Clear conversation history
```

### WebSocket Events

**Client → Server:**
- `subscribe:telemetry` — Subscribe to telemetry updates
- `unsubscribe:telemetry` — Unsubscribe from telemetry

**Server → Client:**
- `telemetry:update` — Real-time telemetry data
- `session:update` — Session state changes
- `pit:event` — Pit stop events
- `strategy:update` — Strategy recommendations

## Technology Stack

### Backend
- Fastify 5.x — High-performance HTTP server
- Socket.io 4.x — Real-time WebSocket communication
- node-irsdk — iRacing SDK wrapper
- Ollama — Local LLM inference for AI race engineer
- Zod — Runtime type validation

### Frontend
- Next.js 15 — React framework with App Router
- React 19 RC — UI library with Server Components
- Zustand 5.x — State management
- TanStack Query v5 — Data fetching and caching
- Tailwind CSS 4.0 — Styling
- Recharts 2.x — Charts and visualization
- D3.js — Track map visualization
- Framer Motion 11.x — Animations
- Socket.io-client — WebSocket client

### Development
- Turborepo — Monorepo build system
- TypeScript 5.6 — Type safety
- Vitest — Testing framework
- ESLint 9.x — Code linting
- Prettier — Code formatting

## Roadmap

### Phase 1: Core Telemetry (Current)
- [x] Monorepo setup
- [x] Basic API structure
- [x] WebSocket communication
- [ ] iRacing SDK integration
- [ ] Telemetry data parsing

### Phase 2: Backend Services
- [ ] Telemetry processing pipeline
- [ ] Strategy calculation engine
- [ ] Background job processing

### Phase 3: Frontend Foundation
- [x] Dashboard layout
- [x] WebSocket connection
- [ ] Real-time data visualization
- [ ] Zustand state management
- [ ] TanStack Query integration

### Phase 4: Strategic Features
- [ ] Opponent tracking system
- [ ] Pit strategy calculator
- [ ] Fuel management tools
- [ ] Pace analysis
- [ ] Undercut/overcut detection

### Phase 5: Advanced Visualization
- [ ] Interactive track map
- [ ] Position tracker
- [ ] Lap time charts
- [ ] Strategy timeline
- [ ] Customizable widgets

### Phase 6: Voice & Alerts
- [ ] Text-to-speech integration
- [ ] Customizable alerts
- [ ] Voice commands
- [ ] Event notifications

### Phase 7: Production
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Error handling
- [ ] Production deployment
- [ ] Documentation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Acknowledgments

- iRacing for the incredible simulation platform
- node-irsdk maintainers for the SDK wrapper
- The open-source community
