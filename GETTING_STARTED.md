# Getting Started with iRacing Race Engineer

Welcome! This guide will help you get up and running with the iRacing Race Engineer application.

## 📋 What We've Built

You now have a complete monorepo foundation with:

```
✅ Backend API (Fastify + Socket.io)
✅ Frontend App (Next.js 15 + React 19)
✅ Shared Type System (TypeScript)
✅ Docker Configuration
✅ Development Tools & Scripts
✅ Comprehensive Documentation
```

## 🏗️ Project Structure

```
iracing-race-engineer/
│
├── 📱 apps/
│   ├── api/                      # Backend Fastify API
│   │   ├── src/
│   │   │   ├── config/           # Environment config
│   │   │   ├── modules/          # Feature modules
│   │   │   │   ├── telemetry/    # iRacing SDK integration
│   │   │   │   └── session/      # Race session management
│   │   │   └── utils/            # Utilities (logger, etc)
│   │   └── package.json
│   │
│   └── web/                      # Next.js 15 Frontend
│       ├── app/                  # App Router pages
│       ├── components/           # React components
│       │   ├── dashboard/        # Dashboard shell
│       │   └── telemetry/        # Telemetry displays
│       ├── hooks/                # Custom hooks (WebSocket)
│       └── package.json
│
├── 📦 packages/
│   └── shared/                   # Shared TypeScript code
│       └── src/
│           ├── types/            # Type definitions
│           │   ├── telemetry.ts  # Telemetry types
│           │   ├── session.ts    # Session types
│           │   └── strategy.ts   # Strategy types
│           └── schemas/          # Zod validation schemas
│
├── 🐳 docker/
│   ├── api/Dockerfile            # API container
│   └── web/Dockerfile            # Web container
│
├── 🛠️ scripts/
│   ├── setup.sh                  # Automated setup
│   └── db-migrate.sh             # Database migrations
│
├── 📖 Documentation/
│   ├── README.md                 # Main documentation
│   ├── ARCHITECTURE.md           # Architecture details
│   ├── CONTRIBUTING.md           # Contribution guide
│   ├── PROJECT_STATUS.md         # Current status
│   └── GETTING_STARTED.md        # This file!
│
└── ⚙️ Configuration/
    ├── package.json              # Root package config
    ├── turbo.json                # Turborepo config
    ├── tsconfig.json             # TypeScript config
    ├── docker-compose.yml        # Docker services
    └── .env.example              # Environment template
```

## 🚀 Quick Start (5 Minutes)

### Step 1: Prerequisites Check

Ensure you have:
- ✅ Node.js 22.x or higher
- ✅ pnpm 9.x or higher
- ✅ Docker Desktop (optional, for databases)

```bash
node -v   # Should show v22.x.x or higher
pnpm -v   # Should show 9.x.x or higher
docker -v # Optional
```

### Step 2: Automated Setup

Run the setup script:

```bash
# Make it executable (if needed)
chmod +x scripts/setup.sh

# Run setup
./scripts/setup.sh
```

This will:
1. Check prerequisites
2. Install all dependencies
3. Create .env.local from template
4. Start PostgreSQL and Redis in Docker

### Step 3: Configure Environment

Edit `.env.local` with your settings:

```bash
# Open in your editor
code .env.local
# or
nano .env.local
```

Minimum required settings:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/race_engineer
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### Step 4: Start Development

```bash
# Start all services at once
pnpm dev
```

This starts:
- 🔧 **API**: http://localhost:3000
- 🌐 **Web**: http://localhost:3002
- 🔌 **WebSocket**: ws://localhost:3001

Or start services individually:

```bash
# Terminal 1: API
pnpm --filter @iracing-race-engineer/api dev

# Terminal 2: Web
pnpm --filter @iracing-race-engineer/web dev
```

### Step 5: Verify It Works

Open your browser to http://localhost:3002

You should see:
- ✅ Dashboard with dark theme
- ✅ Connection status indicator
- ✅ Placeholder widgets

Test the API:
```bash
curl http://localhost:3000/health
```

## 📚 What to Do Next

### For Backend Development

1. **Implement iRacing SDK Integration**
   ```bash
   # Install node-irsdk
   pnpm --filter @iracing-race-engineer/api add node-irsdk

   # Edit apps/api/src/modules/telemetry/service.ts
   ```

2. **Set Up Database Schema**
   ```bash
   # Add Drizzle kit
   pnpm --filter @iracing-race-engineer/api add -D drizzle-kit

   # Create schema in apps/api/src/database/schema.ts
   ```

3. **Test Telemetry Processing**
   ```bash
   # Create test file
   # apps/api/src/modules/telemetry/service.test.ts

   pnpm --filter @iracing-race-engineer/api test
   ```

### For Frontend Development

1. **Build Telemetry Displays**
   - Create gauges in `apps/web/components/telemetry/`
   - Use Recharts for charts
   - Connect to WebSocket with `useWebSocket` hook

2. **Create Dashboard Widgets**
   - Track map visualization (D3.js)
   - Opponent list with live positions
   - Strategy calculator interface

3. **Implement State Management**
   - Add Zustand stores in `apps/web/stores/`
   - Connect TanStack Query for data fetching

### For Testing

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @iracing-race-engineer/api test
pnpm --filter @iracing-race-engineer/web test

# Watch mode
pnpm test -- --watch
```

## 🔧 Common Commands

### Development

```bash
pnpm dev                    # Start all services
pnpm build                  # Build all packages
pnpm test                   # Run all tests
pnpm type-check            # TypeScript type checking
pnpm lint                   # Lint all code
pnpm format                 # Format with Prettier
pnpm clean                  # Clean build artifacts
```

### Docker

```bash
docker-compose up -d        # Start databases
docker-compose down         # Stop databases
docker-compose logs -f api  # View API logs
docker-compose ps           # View running services
```

### Package Management

```bash
# Add dependency to specific package
pnpm --filter @iracing-race-engineer/api add <package>
pnpm --filter @iracing-race-engineer/web add <package>

# Add dev dependency
pnpm --filter @iracing-race-engineer/api add -D <package>

# Update all dependencies
pnpm update --recursive
```

## 🐛 Troubleshooting

### Port Already in Use

If ports 3000, 3001, or 3002 are in use:

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env.local
API_PORT=3010
SOCKET_PORT=3011
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# View logs
docker-compose logs postgres
```

### Module Not Found Errors

```bash
# Clean install
pnpm clean
rm -rf node_modules
pnpm install
```

### TypeScript Errors

```bash
# Rebuild shared package
pnpm --filter @iracing-race-engineer/shared build

# Type check
pnpm type-check
```

## 📖 Key Files to Know

### Configuration Files
- `turbo.json` - Turborepo pipeline config
- `package.json` - Root dependencies
- `.env.local` - Environment variables
- `tsconfig.json` - TypeScript settings

### Backend Entry Points
- `apps/api/src/index.ts` - Main server
- `apps/api/src/config/index.ts` - Configuration
- `apps/api/src/modules/telemetry/service.ts` - Telemetry processing

### Frontend Entry Points
- `apps/web/app/layout.tsx` - Root layout
- `apps/web/app/page.tsx` - Home page
- `apps/web/hooks/use-websocket.ts` - WebSocket hook

### Shared Code
- `packages/shared/src/types/` - Type definitions
- `packages/shared/src/schemas/` - Validation schemas

## 🎓 Learning Path

### Week 1: Setup & Basics
- ✅ Complete setup (you're here!)
- 📖 Read ARCHITECTURE.md
- 🔧 Explore codebase structure
- 🧪 Run and modify examples

### Week 2: Core Development
- 🔌 Implement iRacing SDK connection
- 📊 Create telemetry parsing
- 🌐 Build basic UI components
- ✅ Write first tests

### Week 3: Features
- 🏎️ Add strategy calculations
- 📈 Build visualizations
- 🗄️ Implement data persistence
- 🎨 Polish UI/UX

### Week 4: Production
- 🧪 Comprehensive testing
- ⚡ Performance optimization
- 🚀 Deployment setup
- 📚 Documentation updates

## 💡 Tips & Best Practices

1. **Use Turborepo Effectively**
   - Run tasks in parallel when possible
   - Leverage caching for faster builds
   - Use `--filter` for specific packages

2. **Type Safety**
   - Always use types from `@iracing-race-engineer/shared`
   - Run `pnpm type-check` frequently
   - No `any` types without good reason

3. **Testing**
   - Write tests as you develop
   - Aim for >80% coverage
   - Use mock data for iRacing SDK

4. **Git Workflow**
   - Create feature branches
   - Use conventional commits
   - Keep commits focused and small

5. **Performance**
   - Profile telemetry processing
   - Optimize WebSocket messages
   - Use React.memo for expensive renders

## 🤝 Getting Help

- 📘 **Documentation**: Start with README.md
- 🏗️ **Architecture**: See ARCHITECTURE.md
- 🤝 **Contributing**: Read CONTRIBUTING.md
- 🐛 **Issues**: Check PROJECT_STATUS.md
- 💬 **Questions**: Open a GitHub Discussion

## 🎯 Your First Task

Try this to verify everything works:

1. Start the development servers (`pnpm dev`)
2. Open http://localhost:3002
3. Verify WebSocket connection status shows "Connected"
4. Check API health: http://localhost:3000/health
5. Modify `apps/web/app/page.tsx` and see hot reload

Congratulations! You're ready to build! 🏎️💨

---

**Next Steps**:
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Check [PROJECT_STATUS.md](./PROJECT_STATUS.md) for current progress
- See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines
