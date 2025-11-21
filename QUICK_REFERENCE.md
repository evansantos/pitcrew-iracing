# Quick Reference Guide

## 🚀 Essential Commands

### Start Development
```bash
pnpm dev                                          # Start everything
pnpm --filter @iracing-race-engineer/api dev      # API only
pnpm --filter @iracing-race-engineer/web dev      # Web only
```

### Building
```bash
pnpm build                                        # Build all
pnpm --filter @iracing-race-engineer/shared build # Build shared first
```

### Testing
```bash
pnpm test                                         # All tests
pnpm test -- --watch                              # Watch mode
```

### Code Quality
```bash
pnpm lint                                         # Lint code
pnpm format                                       # Format code
pnpm type-check                                   # Check types
```

## 📁 Key File Locations

| Purpose | Location |
|---------|----------|
| API Entry Point | `apps/api/src/index.ts` |
| API Config | `apps/api/src/config/index.ts` |
| Telemetry Service | `apps/api/src/modules/telemetry/service.ts` |
| Web Entry Point | `apps/web/app/page.tsx` |
| WebSocket Hook | `apps/web/hooks/use-websocket.ts` |
| Shared Types | `packages/shared/src/types/*.ts` |
| Validation Schemas | `packages/shared/src/schemas/index.ts` |
| Environment Config | `.env.local` |

## 🔌 Ports

| Service | Port | URL |
|---------|------|-----|
| API | 3000 | http://localhost:3000 |
| WebSocket | 3001 | ws://localhost:3001 |
| Web | 3002 | http://localhost:3002 |
| PostgreSQL | 5432 | postgresql://localhost:5432 |
| Redis | 6379 | redis://localhost:6379 |

## 📦 Package Filters

```bash
# Backend API
pnpm --filter @iracing-race-engineer/api <command>

# Frontend Web
pnpm --filter @iracing-race-engineer/web <command>

# Shared Package
pnpm --filter @iracing-race-engineer/shared <command>
```

## 🐳 Docker Commands

```bash
# Start databases
docker-compose up -d postgres redis

# View logs
docker-compose logs -f <service>

# Stop services
docker-compose down

# Rebuild containers
docker-compose build
```

## 🌐 API Endpoints

### Health Check
```
GET http://localhost:3000/health
```

### Telemetry
```
GET http://localhost:3000/api/telemetry
GET http://localhost:3000/api/telemetry/history
GET http://localhost:3000/api/telemetry/opponents
```

### Session
```
GET http://localhost:3000/api/session
GET http://localhost:3000/api/session/history
```

## 🔄 WebSocket Events

### Client → Server
- `subscribe:telemetry` - Subscribe to telemetry updates
- `unsubscribe:telemetry` - Unsubscribe from telemetry

### Server → Client
- `telemetry:update` - Real-time telemetry data
- `session:update` - Session state changes
- `pit:event` - Pit stop events
- `strategy:update` - Strategy recommendations

## 📊 Type Definitions

### Key Types
```typescript
import type {
  ProcessedTelemetry,
  OpponentData,
  StrategyRecommendation,
  RaceSession,
  PitStopData,
} from '@iracing-race-engineer/shared';
```

### Validation
```typescript
import {
  TelemetryUpdateSchema,
  OpponentDataSchema,
  SessionInfoSchema,
} from '@iracing-race-engineer/shared';
```

## 🛠️ Troubleshooting

### Clear Everything
```bash
pnpm clean
rm -rf node_modules
rm -rf .turbo
pnpm install
```

### Rebuild TypeScript
```bash
pnpm --filter @iracing-race-engineer/shared build
pnpm build
```

### Reset Database
```bash
docker-compose down -v
docker-compose up -d postgres
```

### Check Process on Port
```bash
lsof -i :3000
kill -9 <PID>
```

## 📝 Environment Variables

### Required
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### Optional
```env
API_PORT=3000
SOCKET_PORT=3001
TELEMETRY_RATE=60
ENABLE_VOICE_ALERTS=true
NODE_ENV=development
```

## 🎨 Frontend Components

### Import Pattern
```typescript
// UI Components
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { TelemetryStatus } from '@/components/telemetry/telemetry-status';

// Hooks
import { useWebSocket } from '@/hooks/use-websocket';

// Utils
import { cn } from '@/lib/utils';
```

## 🧪 Testing Pattern

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature', () => {
  it('should work correctly', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = feature(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

## 🔒 Best Practices

1. **Always** use types from shared package
2. **Never** commit `.env.local`
3. **Run** `pnpm type-check` before committing
4. **Write** tests for new features
5. **Use** conventional commits
6. **Document** complex logic
7. **Profile** performance-critical code
8. **Validate** all inputs with Zod

## 🎯 Next Implementation Steps

1. Install `node-irsdk` in API package
2. Implement telemetry reading at 60Hz
3. Create database schema with Drizzle
4. Build real-time dashboard components
5. Add strategy calculation engine
6. Implement opponent tracking
7. Create track map visualization
8. Add voice alert system

## 📚 Documentation Links

- [Main README](./README.md)
- [Architecture](./ARCHITECTURE.md)
- [Contributing](./CONTRIBUTING.md)
- [Project Status](./PROJECT_STATUS.md)
- [Getting Started](./GETTING_STARTED.md)

---

Keep this handy for quick reference during development! 🏎️
