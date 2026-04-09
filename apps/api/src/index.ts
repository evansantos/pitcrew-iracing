import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { createTelemetryRoutes, createStrategyRoutes } from './modules/telemetry/index.js';
import { createSessionRoutes } from './modules/sessions/index.js';
import { sessionRoutes } from './modules/session/index.js';
import { raceEngineerRoutes } from './modules/race-engineer/index.js';
import { RaceEngineerLLM } from './services/ai/race-engineer-llm.js';
import { FileStore } from './services/file-store/index.js';
import { createSocketState, registerSocketHandlers } from './modules/telemetry/socket-handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize FileStore for telemetry persistence
const fileStore = new FileStore({
  dataDir: join(__dirname, '../data/sessions'),
  autoFlushMs: 5000,
  maxFramesPerSession: 0, // unlimited by default
});

async function start() {
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

  // Initialize socket state before route registrations so routes can reference it
  const socketState = createSocketState();

  // Register API routes
  await fastify.register(createTelemetryRoutes(socketState), { prefix: '/api/telemetry' });
  await fastify.register(createStrategyRoutes(socketState), { prefix: '/api/strategy' });
  await fastify.register(createSessionRoutes(fileStore), { prefix: '/api/sessions' });
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

  // Initialize Socket.IO
  const io = new Server(fastify.server, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Track active FileStore sessions per racer
  const racerSessions = new Map<string, string>();

  // Set up Socket.IO handlers with FileStore integration
  registerSocketHandlers(io, socketState, [
    {
      onTelemetry: (racerName, telemetry) => {
        // Auto-record telemetry to FileStore
        let sessionId = racerSessions.get(racerName);
        if (!sessionId) {
          sessionId = fileStore.startSession({
            racerName,
            trackName: telemetry.track?.name || 'Unknown',
            carName: telemetry.player?.carName || 'Unknown',
            sessionType: telemetry.session?.type || 'unknown',
          });
          racerSessions.set(racerName, sessionId);
          logger.info(`📁 FileStore: recording session ${sessionId} for ${racerName}`);
        }
        fileStore.recordFrame(sessionId, telemetry);
      },
    },
  ]);

  logger.info(`Socket.IO attached to Fastify server on port ${config.api.port}`);
  logger.info('✅ Using Socket.IO relay for all telemetry data (mock service removed)');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');

    // End all active FileStore sessions
    for (const [racerName, sessionId] of racerSessions) {
      fileStore.endSession(sessionId);
      logger.info(`📁 FileStore: ended session ${sessionId} for ${racerName}`);
    }
    fileStore.close();

    await fastify.close();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start();
