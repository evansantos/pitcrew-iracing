import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { telemetryRoutes } from './modules/telemetry/routes.js';
import { sessionRoutes } from './modules/session/routes.js';
import { raceEngineerRoutes } from './modules/race-engineer/routes.js';
import { redisService } from './services/cache/index.js';
import { testConnection, closeDatabase } from './db/index.js';
import { RaceEngineerLLM } from './services/ai/race-engineer-llm.js';

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

  await fastify.register(websocket);

  // Health check endpoint
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Register routes
  await fastify.register(telemetryRoutes, { prefix: '/api/telemetry' });
  await fastify.register(sessionRoutes, { prefix: '/api/session' });
  await fastify.register(raceEngineerRoutes, { prefix: '/api/race-engineer' });

  // Start HTTP server
  try {
    await fastify.listen({ port: config.api.port, host: config.api.host });
    logger.info(`API server running on http://${config.api.host}:${config.api.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Initialize Socket.IO for real-time communication
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    socket.on('subscribe:telemetry', () => {
      socket.join('telemetry');
      logger.info(`Client ${socket.id} subscribed to telemetry`);
    });

    socket.on('subscribe:strategy', () => {
      socket.join('telemetry');
      logger.info(`Client ${socket.id} subscribed to strategy`);
    });

    socket.on('unsubscribe:telemetry', () => {
      socket.leave('telemetry');
      logger.info(`Client ${socket.id} unsubscribed from telemetry`);
    });
  });

  httpServer.listen(config.socket.port, () => {
    logger.info(`WebSocket server running on port ${config.socket.port}`);
  });

  // Initialize and start enhanced telemetry service
  const { enhancedTelemetryService } = await import('./modules/telemetry/enhanced-service.js');

  // Listen for telemetry data and broadcast to connected clients
  enhancedTelemetryService.on('telemetry', (data) => {
    io.to('telemetry').emit('telemetry:update', data);
  });

  // Listen for strategy updates and broadcast to connected clients
  enhancedTelemetryService.on('strategy', (strategyState) => {
    io.to('telemetry').emit('strategy:update', strategyState);
  });

  // Start telemetry processing
  await enhancedTelemetryService.connect();
  logger.info('Enhanced telemetry service started with strategy engine');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');

    // Disconnect telemetry service
    await enhancedTelemetryService.disconnect();

    // Close Redis connection
    if (redisService.isReady()) {
      await redisService.disconnect();
    }

    // Close database connection
    await closeDatabase();

    // Close servers
    await fastify.close();
    httpServer.close();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start();
