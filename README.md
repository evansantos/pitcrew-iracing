# iRacing Race Engineer

Real-time racing engineer application that connects to iRacing telemetry during live races. Provides strategic analysis, opponent tracking, pit stop monitoring, and race strategy calculations.

## Features

- **Real-time Telemetry Processing** - 60Hz telemetry data from iRacing SDK
- **Strategic Analysis Engine** - Optimal pit windows, fuel calculations, tire management
- **AI Race Engineer Assistant** - Natural language race advice powered by local LLM (Ollama)
- **Opponent Tracking** - Live position tracking for all drivers
- **Pit Stop Analysis** - Real-time pit stop detection and strategy
- **Voice Alerts** - Text-to-speech race engineer notifications
- **Multi-class Support** - Filter and analyze by car class

## Architecture

This is a monorepo built with:

- **Backend**: Fastify 5.x + Socket.io for real-time telemetry streaming
- **Frontend**: Next.js 15 + React 19 RC with App Router
- **Database**: PostgreSQL 16 with Drizzle ORM
- **Cache**: Redis 7.x for session management
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
├── packages/
│   └── shared/                 # Shared TypeScript types and schemas
│       └── src/
│           ├── types/          # Core type definitions
│           └── schemas/        # Zod validation schemas
│
└── docker/                     # Docker configurations
```

## Prerequisites

- **Node.js** 22.x or higher
- **pnpm** 9.x or higher
- **Docker** & Docker Compose (optional, for databases)
- **iRacing** subscription and SDK access (Windows only for live telemetry)

> **Platform Note**: The iRacing SDK (`node-irsdk`) only works on **Windows** as it requires access to iRacing's memory-mapped files. On macOS/Linux, the application runs in **mock mode** for development, which is perfect for building UI and testing features without needing Windows.

## Quick Start

### 1. Install Dependencies

```bash
# Install pnpm globally if you haven't
npm install -g pnpm

# Install all dependencies
pnpm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your settings
```

Required environment variables:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/race_engineer

# Redis
REDIS_URL=redis://localhost:6379

# API Configuration
API_PORT=3000
SOCKET_PORT=3001

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# iRacing SDK (Windows only)
IRSDK_PATH=/path/to/iracing
```

### 3. Start Infrastructure

**Option A: Docker (Recommended)**

Start all infrastructure services including AI:

```bash
# Start all services (Postgres, Redis, Ollama)
docker-compose up -d postgres redis ollama

# Or start everything including the app
docker-compose up -d
```

The Ollama container will automatically pull the default model (`llama3.1:8b`) on first startup.

**Option B: Local Installation**

```bash
# macOS
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis

# Ubuntu/Debian
sudo apt install postgresql-16 redis-server
```

### 4. AI Race Engineer Setup (Optional)

The app includes an AI-powered race engineer assistant that runs locally using Ollama. This is **optional** - the app works fine without it.

**Option A: Docker (Easiest)**

If you started infrastructure with Docker (step 3), Ollama is already running! The container automatically pulls the default model on first startup.

To use a different model:
```bash
# Set the model in your environment
export OLLAMA_MODEL=phi3:mini  # or llama3.1:70b, etc.

# Restart Ollama services
docker-compose restart ollama ollama-setup
```

**Option B: Local Installation - Automated Setup**
```bash
# Run the automated setup script
pnpm setup-ai
```

This script will:
- Install Ollama (if not already installed)
- Start the Ollama service
- Let you choose which AI model to download
- Verify everything is working

**Option C: Local Installation - Manual Setup**
```bash
# Install Ollama
brew install ollama  # macOS
curl https://ollama.ai/install.sh | sh  # Linux

# Pull a model
ollama pull llama3.1:8b  # Recommended (4GB RAM)
ollama pull phi3:mini    # Lite version (2GB RAM)

# Start Ollama
ollama serve
```

**Check AI status anytime:**
```bash
pnpm --filter @iracing-race-engineer/api ai:status
```

> **Note**: Ollama runs on the backend server, not in the browser. The AI processing happens server-side for better performance and privacy.

### 5. Run Development Servers

```bash
# Start all applications in development mode
pnpm dev

# Or start individually
pnpm --filter @iracing-race-engineer/api dev
pnpm --filter @iracing-race-engineer/web dev
```

The application will be available at:
- **Frontend**: http://localhost:3002
- **API**: http://localhost:3000
- **WebSocket**: ws://localhost:3001

When you start the backend, you'll see a status message about AI availability:
- ✅ `AI Race Engineer ready with 1 model(s)` - AI is working
- ⚠️  `AI Race Engineer unavailable` - Ollama not running (app still works, just without AI)

## Development

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @iracing-race-engineer/api build
pnpm --filter @iracing-race-engineer/web build
```

### Type Checking

```bash
# Check all packages
pnpm type-check

# Watch mode for development
pnpm --filter @iracing-race-engineer/shared dev
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @iracing-race-engineer/api test
```

### Linting & Formatting

```bash
# Lint all packages
pnpm lint

# Format code
pnpm format
```

## Docker Deployment

### Full Stack Deployment

```bash
# Build and start all services (including AI)
docker-compose up -d

# View logs
docker-compose logs -f

# View AI-specific logs
docker-compose logs -f ollama

# Stop services
docker-compose down
```

### GPU Support for AI (Optional)

If you have an NVIDIA GPU and want to accelerate AI inference:

1. Install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)

2. Uncomment the GPU configuration in `docker-compose.yml`:
```yaml
ollama:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

3. Restart the Ollama service:
```bash
docker-compose up -d ollama
```

### Customizing AI Model

Change the default model by setting an environment variable:

```bash
# Use a lighter model
OLLAMA_MODEL=phi3:mini docker-compose up -d

# Or use a more powerful model (requires more RAM)
OLLAMA_MODEL=llama3.1:70b docker-compose up -d
```

### Production Build

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production stack
docker-compose -f docker-compose.prod.yml up -d
```

## API Endpoints

### Health Check
```
GET /health
```

### Telemetry
```
GET /api/telemetry          # Current telemetry snapshot
GET /api/telemetry/history  # Historical telemetry data
GET /api/telemetry/opponents # Opponent tracking data
```

### Session
```
GET /api/session            # Current session info
GET /api/session/history    # Session history
```

### AI Race Engineer
```
POST /api/race-engineer/advice  # Get race engineering advice
GET  /api/race-engineer/status  # Check AI availability
POST /api/race-engineer/reset   # Clear conversation history
```

### WebSocket Events

Client to Server:
- `subscribe:telemetry` - Subscribe to telemetry updates
- `unsubscribe:telemetry` - Unsubscribe from telemetry

Server to Client:
- `telemetry:update` - Real-time telemetry data
- `session:update` - Session state changes
- `pit:event` - Pit stop events
- `strategy:update` - Strategy recommendations

## Technology Stack

### Backend
- Fastify 5.x - High-performance HTTP server
- Socket.io 4.x - Real-time WebSocket communication
- Drizzle ORM - Type-safe database queries
- PostgreSQL 16 - Primary database
- Redis 7.x - Caching and session store
- BullMQ - Background job processing
- node-irsdk - iRacing SDK wrapper
- Ollama - Local LLM inference for AI race engineer
- Zod - Runtime type validation

### Frontend
- Next.js 15 - React framework with App Router
- React 19 RC - UI library with Server Components
- Zustand 5.x - State management
- TanStack Query v5 - Data fetching and caching
- Tailwind CSS 4.0 alpha - Styling
- Recharts 2.x - Charts and visualization
- D3.js - Track map visualization
- Framer Motion 11.x - Animations
- Socket.io-client - WebSocket client

### Development
- Turborepo - Monorepo build system
- TypeScript 5.6 - Type safety
- Vitest - Testing framework
- ESLint 9.x - Code linting
- Prettier - Code formatting
- Biome - Fast linter alternative

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
- [ ] Database schema and migrations
- [ ] Redis caching layer
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

## Support

- **Issues**: https://github.com/yourusername/iracing-race-engineer/issues
- **Discord**: Coming soon
- **Documentation**: Coming soon

## Acknowledgments

- iRacing for the incredible simulation platform
- node-irsdk maintainers for the SDK wrapper
- The open-source community
