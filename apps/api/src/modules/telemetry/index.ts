import type { FastifyPluginAsync } from 'fastify';
import type { SocketHandlerState } from './socket-handlers.js';
import {
  getLatestTelemetry,
  getLatestStrategy,
  getConnectedRacers,
} from './socket-handlers.js';

export function createTelemetryRoutes(socketState: SocketHandlerState): FastifyPluginAsync {
  return async (fastify) => {
    // GET /live — list connected racers
    fastify.get('/live', async (_request, reply) => {
      const racers = getConnectedRacers(socketState);
      return reply.send(racers);
    });

    // GET /live/:racerName — latest telemetry snapshot
    fastify.get<{ Params: { racerName: string } }>('/live/:racerName', async (request, reply) => {
      const telemetry = getLatestTelemetry(socketState, request.params.racerName);
      if (!telemetry) {
        return reply.code(404).send({
          error: 'Racer not connected',
          racerName: request.params.racerName,
        });
      }
      return reply.send(telemetry);
    });
  };
}

export function createStrategyRoutes(socketState: SocketHandlerState): FastifyPluginAsync {
  return async (fastify) => {
    // GET /live/:racerName — latest strategy snapshot
    fastify.get<{ Params: { racerName: string } }>('/live/:racerName', async (request, reply) => {
      const strategy = getLatestStrategy(socketState, request.params.racerName);
      if (!strategy) {
        return reply.code(404).send({
          error: 'No strategy data available',
          racerName: request.params.racerName,
        });
      }
      return reply.send(strategy);
    });
  };
}
