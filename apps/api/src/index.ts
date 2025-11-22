import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { telemetryRoutes } from './modules/telemetry/routes.js';
import { sessionRoutes } from './modules/session/routes.js';
import { raceEngineerRoutes } from './modules/race-engineer/routes.js';
import { redisService } from './services/cache/index.js';
import { testConnection, closeDatabase } from './db/index.js';
import { RaceEngineerLLM } from './services/ai/race-engineer-llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
      logger.warn('   1. Install Ollama: brew install ollama (or curl https://ollama.ai/install.sh | sh)');
      logger.warn('   2. Pull a model: ollama pull llama3.1:8b');
      logger.warn('   3. Start Ollama: ollama serve');
      logger.warn('   4. Restart this backend server');
      logger.warn('   The app will work without AI, but the Race Engineer assistant will be disabled');
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

  // Track relay connection status
  let relayConnected = false;
  let relaySocketId: string | null = null;

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Handle client identification (relay vs webapp)
    socket.on('identify', (data: { type: 'relay' | 'webapp'; version?: string }) => {
      if (data.type === 'relay') {
        relayConnected = true;
        relaySocketId = socket.id;
        socket.join('relay');
        logger.info(`✅ Python relay connected: ${socket.id}, version: ${data.version || 'unknown'}`);

        // Acknowledge relay connection
        socket.emit('identify:ack', {
          status: 'connected',
          message: 'Relay identified and ready to send telemetry'
        });

        // Notify all webapp clients that relay is connected
        io.to('webapp').emit('relay:status', { connected: true });
      } else if (data.type === 'webapp') {
        socket.join('webapp');
        logger.info(`Webapp client connected: ${socket.id}`);

        // Send current relay status to new webapp client
        socket.emit('relay:status', { connected: relayConnected });
      }
    });

    // Handle telemetry data from Python relay
    socket.on('relay:telemetry', (telemetryData: any) => {
      // Broadcast telemetry to all webapp clients
      io.to('webapp').emit('telemetry:update', telemetryData);
      io.to('telemetry').emit('telemetry:update', telemetryData);
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
      socket.emit('relay:status', { connected: relayConnected });
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
      // Check if disconnecting client is the relay
      if (socket.id === relaySocketId) {
        relayConnected = false;
        relaySocketId = null;
        logger.warn(`⚠️  Python relay disconnected: ${socket.id}`);

        // Notify all webapp clients that relay is disconnected
        io.to('webapp').emit('relay:status', { connected: false });
      } else {
        logger.info(`Client disconnected: ${socket.id}`);
      }
    });
  });

  // Socket.IO is now attached to Fastify's server (port 3000)
  // No need for separate httpServer.listen()
  logger.info(`Socket.IO attached to Fastify server on port ${config.api.port}`);

  // Initialize and start enhanced telemetry service
  // In production, data comes from Socket.IO relay, so we don't need the enhanced service
  // Only start it in development or when explicitly configured
  let enhancedTelemetryService: any = null;

  if (config.env === 'development' || (config.iracing.mode === 'local' && config.iracing.relayHost)) {
    const { enhancedTelemetryService: service } = await import('./modules/telemetry/enhanced-service.js');
    enhancedTelemetryService = service;

    // Listen for telemetry data and broadcast to connected clients
    enhancedTelemetryService.on('telemetry', (data: any) => {
      io.to('telemetry').emit('telemetry:update', data);
    });

    // Listen for strategy updates and broadcast to connected clients
    enhancedTelemetryService.on('strategy', (strategyState: any) => {
      io.to('telemetry').emit('strategy:update', strategyState);
    });

    // Start telemetry processing
    try {
      await enhancedTelemetryService.connect();
      logger.info('Enhanced telemetry service started with strategy engine');
    } catch (error) {
      logger.warn({ error }, 'Failed to start enhanced telemetry service - continuing without it');
      enhancedTelemetryService = null;
    }
  } else {
    logger.info('Enhanced telemetry service disabled - using Socket.IO relay for telemetry data');
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');

    // Disconnect telemetry service if it was started
    if (enhancedTelemetryService) {
      await enhancedTelemetryService.disconnect();
    }

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
