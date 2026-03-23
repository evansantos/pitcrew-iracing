import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { telemetryRoutes } from './modules/telemetry/index.js';
import { sessionRoutes } from './modules/session/index.js';
import { raceEngineerRoutes } from './modules/race-engineer/index.js';
import { redisService } from './services/cache/index.js';
import { testConnection, closeDatabase } from './db/index.js';
import { RaceEngineerLLM } from './services/ai/race-engineer-llm.js';
import { StrategyEngine } from './services/strategy/strategy-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize strategy engine
const strategyEngine = new StrategyEngine();

async function start() {
  // Initialize Redis
  try {
    logger.info('Connecting to Redis...');
    await redisService.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to Redis');
    logger.warn('Continuing without Redis - caching will be disabled');
  }

  // Test database connection
  try {
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();
    if (dbConnected) {
      logger.info('Database connected successfully');
    } else {
      logger.error('Database connection failed');
      process.exit(1);
    }
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    process.exit(1);
  }

  // Check Ollama availability for AI Race Engineer
  try {
    logger.info('Checking Ollama AI service...');
    const raceEngineer = new RaceEngineerLLM();
    const isAvailable = await raceEngineer.isAvailable();

    if (isAvailable) {
      const models = await raceEngineer.listModels();
      logger.info(`✅ AI Race Engineer ready with ${models.length} model(s): ${models.join(', ')}`);
    } else {
      logger.warn('⚠️  AI Race Engineer unavailable - Ollama not running');
      logger.warn('   To enable AI features:');
      logger.warn(
        '   1. Install Ollama: brew install ollama (or curl https://ollama.ai/install.sh | sh)'
      );
      logger.warn('   2. Pull a model: ollama pull llama3.1:8b');
      logger.warn('   3. Start Ollama: ollama serve');
      logger.warn('   4. Restart this backend server');
      logger.warn(
        '   The app will work without AI, but the Race Engineer assistant will be disabled'
      );
    }
  } catch (error) {
    logger.warn({ error }, '⚠️  Could not connect to Ollama - AI Race Engineer will be disabled');
    logger.warn('   The app will continue without AI features');
  }
  // Initialize Fastify
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
    requestIdHeader: 'x-request-id',
    disableRequestLogging: false,
  });

  // Register plugins
  await fastify.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Register API routes
  await fastify.register(telemetryRoutes, { prefix: '/api/telemetry' });
  await fastify.register(sessionRoutes, { prefix: '/api/session' });
  await fastify.register(raceEngineerRoutes, { prefix: '/api/race-engineer' });

  // Serve Next.js static export in production
  if (process.env.NODE_ENV === 'production') {
    const webAppExportPath = join(__dirname, '../../web/out');

    try {
      const fs = await import('fs');
      if (fs.existsSync(webAppExportPath)) {
        // Serve the exported Next.js site
        await fastify.register(fastifyStatic, {
          root: webAppExportPath,
          prefix: '/',
        });

        // Fallback route for client-side routing
        const indexPath = join(webAppExportPath, 'index.html');
        fastify.setNotFoundHandler(async (request, reply) => {
          // If it's an API route, return 404
          if (request.url.startsWith('/api/') || request.url.startsWith('/socket.io/')) {
            return reply.code(404).send({ error: 'Not found' });
          }
          // Otherwise serve index.html for client-side routing
          const indexContent = fs.readFileSync(indexPath, 'utf-8');
          return reply.type('text/html').send(indexContent);
        });

        logger.info('✅ Serving Next.js webapp from API server');
      } else {
        logger.warn('⚠️  Webapp build directory not found - API-only mode');
      }
    } catch (error) {
      logger.warn('⚠️  Could not serve webapp files - they may not be built yet');
      logger.warn('   This is OK for API-only deployment');
    }
  }

  // Start HTTP server
  try {
    await fastify.listen({ port: config.api.port, host: config.api.host });
    logger.info(`API server running on http://${config.api.host}:${config.api.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Initialize Socket.IO for real-time communication
  // Attach to Fastify's HTTP server instead of creating a separate one
  const io = new Server(fastify.server, {
    cors: {
      origin: '*', // Allow connections from Python relay on different machines
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Track relay connections by racer name
  interface RelayInfo {
    socketId: string;
    racerName: string;
    version: string;
    mock: boolean;
    connectedAt: Date;
  }

  const relayConnections = new Map<string, RelayInfo>(); // Map of socketId to relay info
  const racerRelays = new Map<string, string>(); // Map of racerName to socketId

  // Track last strategy emission per racer to prevent flickering
  interface StrategyCache {
    lastLap: number;
    lastStrategy: any;
  }
  const strategyCache = new Map<string, StrategyCache>(); // Map of racerName to last strategy

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Handle client identification (relay vs webapp)
    socket.on(
      'identify',
      (data: {
        type: 'relay' | 'webapp';
        version?: string;
        racerName?: string;
        mock?: boolean;
      }) => {
        if (data.type === 'relay') {
          const racerName = data.racerName || 'Default Racer';
          const relayInfo: RelayInfo = {
            socketId: socket.id,
            racerName,
            version: data.version || 'unknown',
            mock: data.mock || false,
            connectedAt: new Date(),
          };

          relayConnections.set(socket.id, relayInfo);
          racerRelays.set(racerName, socket.id);
          socket.join('relay');
          socket.join(`relay:${racerName}`); // Join racer-specific room

          logger.info(
            `✅ Python relay connected: ${socket.id}, racer: ${racerName}, version: ${data.version || 'unknown'}, mock: ${data.mock}`
          );

          // Acknowledge relay connection
          socket.emit('identify:ack', {
            status: 'connected',
            racerName,
            message: 'Relay identified and ready to send telemetry',
          });

          // Notify all webapp clients about available racers
          const availableRacers = Array.from(racerRelays.keys()).map((name) => ({
            name,
            mock: relayConnections.get(racerRelays.get(name)!)?.mock || false,
          }));
          logger.info(
            `🏁 Racer "${racerName}" connected${data.mock ? ' (MOCK MODE)' : ''} | ` +
            `Total racers: ${availableRacers.length} | ` +
            `Active: ${availableRacers.map(r => r.name).join(', ')}`
          );
          io.to('webapp').emit('racers:list', availableRacers);
          io.to('webapp').emit('relay:status', { connected: true, racerName });
        } else if (data.type === 'webapp') {
          socket.join('webapp');

          // Send available racers to new webapp client
          const availableRacers = Array.from(racerRelays.keys()).map((name) => ({
            name,
            mock: relayConnections.get(racerRelays.get(name)!)?.mock || false,
          }));
          logger.info(
            `🌐 Webapp connected | ` +
            `Available racers: ${availableRacers.length > 0 ? availableRacers.map(r => r.name).join(', ') : 'None'}`
          );
          socket.emit('racers:list', availableRacers);
          socket.emit('relay:status', { connected: relayConnections.size > 0 });
        }
      }
    );

    // Handle telemetry data from Python relay
    socket.on('relay:telemetry', (data: { racerName: string; telemetry: any }) => {
      const player = data.telemetry?.player;
      const session = data.telemetry?.session;
      const fuel = data.telemetry?.fuel;
      const tires = data.telemetry?.tires;

      logger.info(
        `📊 [${data.racerName}] Lap ${player?.lap || 0} | ` +
        `Speed: ${Math.round(player?.speed || 0)} km/h | ` +
        `Gear: ${player?.gear || 0} | ` +
        `Fuel: ${fuel?.level?.toFixed(1) || 0}L | ` +
        `Position: ${player?.position || 'N/A'}`
      );

      // Broadcast telemetry to all webapp clients with racer info
      io.to('webapp').emit('telemetry:update', {
        racerName: data.racerName,
        telemetry: data.telemetry,
      });
      io.to('telemetry').emit('telemetry:update', {
        racerName: data.racerName,
        telemetry: data.telemetry,
      });

      // Calculate and broadcast strategy (throttled to once per lap to prevent flickering)
      try {
        const currentLap = player?.lap || 0;
        const cachedStrategy = strategyCache.get(data.racerName);

        // Only calculate strategy once per lap (when lap changes) or on first telemetry
        if (!cachedStrategy || cachedStrategy.lastLap !== currentLap) {
          // Calculate basic strategy from telemetry data
          const fuelLapsRemaining = fuel?.lapsRemaining || 0;
          const raceLapsRemaining = session?.lapsRemaining || 0;

          // Skip strategy calculation if we don't have valid fuel data
          // This prevents sending bad data (0 laps) that overrides relay calculations
          if (!fuel?.lapsRemaining || fuel.lapsRemaining <= 0) {
            logger.debug(`📈 [${data.racerName}] Skipping strategy - no valid fuel data yet`);
            return;
          }

          // Handle unlimited sessions (practice/qualify)
          const isUnlimitedSession = raceLapsRemaining > 10000;
          const MIN_FUEL_LAPS_THRESHOLD = 10; // Pit if fuel < 10 laps in unlimited sessions

          // Calculate tire health (average of all tires)
          const avgTireHealth = tires ? (
            ((tires.lf?.avgWear || 0) + (tires.rf?.avgWear || 0) +
             (tires.lr?.avgWear || 0) + (tires.rr?.avgWear || 0)) / 4
          ) : 1.0;

          const tireHealthPct = avgTireHealth * 100;

          // Determine if pit is needed
          // For unlimited sessions: check if fuel < threshold
          // For races: check if fuel insufficient to finish
          const needsFuel = isUnlimitedSession
            ? fuelLapsRemaining < MIN_FUEL_LAPS_THRESHOLD
            : fuelLapsRemaining < raceLapsRemaining;
          const needsTires = tireHealthPct < 30;
          const needsPit = needsFuel || needsTires;

          // Calculate optimal pit lap
          let optimalPitLap = 0;
          if (needsFuel && needsTires) {
            const fuelUrgency = Math.max(0, fuelLapsRemaining - 2);
            const tireUrgency = tireHealthPct < 20 ? 1 : 3;
            optimalPitLap = currentLap + Math.min(fuelUrgency, tireUrgency);
          } else if (needsFuel) {
            optimalPitLap = currentLap + Math.max(0, fuelLapsRemaining - 2);
          } else if (needsTires) {
            optimalPitLap = currentLap + (tireHealthPct < 20 ? 1 : 3);
          }

          const strategy = {
            fuelStrategy: {
              currentFuel: fuel?.level || 0,
              lapsUntilEmpty: fuelLapsRemaining,
              averageConsumption: fuel?.avgPerLap || 0,
              canFinish: !needsFuel,
              refuelRequired: needsFuel,
            },
            tireStrategy: {
              currentWear: avgTireHealth,
              healthPercentage: tireHealthPct,
              canFinish: !needsTires,
              changeRequired: needsTires,
            },
            pitWindow: needsPit ? {
              optimalLap: optimalPitLap,
              windowStart: Math.max(currentLap + 1, optimalPitLap - 2),
              windowEnd: Math.min(raceLapsRemaining, optimalPitLap + 2),
              reason: needsFuel && needsTires ? 'fuel + tires' : needsFuel ? 'fuel' : 'tires',
            } : null,
            recommendations: [],
            lastUpdated: new Date().toISOString(),
          };

          // Cache the strategy
          strategyCache.set(data.racerName, {
            lastLap: currentLap,
            lastStrategy: strategy,
          });

          // Broadcast strategy to webapp clients (only once per lap)
          io.to('webapp').emit('strategy:update', strategy);

          logger.debug(`📈 [${data.racerName}] Strategy calculated on lap ${currentLap} - Fuel: ${fuelLapsRemaining} laps, Tires: ${tireHealthPct.toFixed(0)}%`);
        }
      } catch (error) {
        logger.error({ error }, 'Failed to calculate strategy');
      }
    });

    // Handle session data from Python relay
    socket.on('relay:session', (sessionData: any) => {
      io.to('webapp').emit('session:update', sessionData);
      logger.info({ state: sessionData.state }, 'Session state update from relay');
    });

    // Webapp subscriptions (backward compatibility)
    socket.on('subscribe:telemetry', () => {
      socket.join('telemetry');
      socket.join('webapp');
      logger.info(`Client ${socket.id} subscribed to telemetry`);

      // Send relay connection status
      socket.emit('relay:status', { connected: relayConnections.size > 0 });
    });

    socket.on('subscribe:strategy', () => {
      socket.join('telemetry');
      socket.join('webapp');
      logger.info(`Client ${socket.id} subscribed to strategy`);
    });

    socket.on('unsubscribe:telemetry', () => {
      socket.leave('telemetry');
      logger.info(`Client ${socket.id} unsubscribed from telemetry`);
    });

    socket.on('disconnect', () => {
      // Check if disconnecting client is a relay
      const relayInfo = relayConnections.get(socket.id);
      if (relayInfo) {
        const racerName = relayInfo.racerName;
        relayConnections.delete(socket.id);
        racerRelays.delete(racerName);
        strategyCache.delete(racerName); // Clear strategy cache for disconnected racer

        // Notify all webapp clients about updated racer list
        const availableRacers = Array.from(racerRelays.keys()).map((name) => ({
          name,
          mock: relayConnections.get(racerRelays.get(name)!)?.mock || false,
        }));
        logger.warn(
          `👋 Racer "${racerName}" disconnected | ` +
          `Remaining: ${availableRacers.length > 0 ? availableRacers.map(r => r.name).join(', ') : 'None'}`
        );
        io.to('webapp').emit('racers:list', availableRacers);
        io.to('webapp').emit('relay:status', {
          connected: relayConnections.size > 0,
          racerName,
          disconnected: true,
        });
      } else {
        logger.info(`Client disconnected: ${socket.id}`);
      }
    });
  });

  // Socket.IO is now attached to Fastify's server (port 3000)
  // No need for separate httpServer.listen()
  logger.info(`Socket.IO attached to Fastify server on port ${config.api.port}`);

  // Mock telemetry service completely removed
  // All telemetry data now comes exclusively from Socket.IO relay
  logger.info('✅ Using Socket.IO relay for all telemetry data (mock service removed)');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');

    // Close Redis connection
    if (redisService.isReady()) {
      await redisService.disconnect();
    }

    // Close database connection
    await closeDatabase();

    // Close server (this also closes Socket.IO)
    await fastify.close();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start();
