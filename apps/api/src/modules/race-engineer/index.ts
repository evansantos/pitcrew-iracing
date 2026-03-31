import { FastifyPluginAsync } from 'fastify';
import { RaceEngineerLLM } from '../../services/ai/race-engineer-llm.js';
import type { AdviceRequest } from './types.js';

// Initialize the LLM service
const raceEngineer = new RaceEngineerLLM();

export const raceEngineerRoutes: FastifyPluginAsync = async (fastify) => {
  // Get race engineering advice
  fastify.post('/advice', async (request, reply) => {
    try {
      const { question, telemetry, strategy } = request.body as AdviceRequest;

      // Validate required fields
      if (!telemetry) {
        return reply.code(400).send({
          error: 'Missing required field: telemetry is required',
        });
      }

      // Build context for the LLM
      const context = {
        telemetry,
        strategy,
        lapNumber: telemetry.player.lap || 0,
        sessionType: telemetry.session.type || 'Race',
      };

      // Get advice from the LLM
      const advice = await raceEngineer.getAdvice(context, question);

      return {
        advice,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      fastify.log.error({ error }, 'Error getting race engineer advice');
      return reply.code(500).send({
        error: 'Failed to get race engineer advice',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Check if AI service is available
  fastify.get('/status', async (request, reply) => {
    try {
      const isAvailable = await raceEngineer.isAvailable();
      const models = isAvailable ? await raceEngineer.listModels() : [];

      return {
        available: isAvailable,
        models,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      fastify.log.error({ error }, 'Error checking AI status');
      return {
        available: false,
        models: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  });

  // Reset conversation history
  fastify.post('/reset', async (request, reply) => {
    try {
      raceEngineer.resetConversation();
      return {
        success: true,
        message: 'Conversation history reset',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      fastify.log.error({ error }, 'Error resetting conversation');
      return reply.code(500).send({
        error: 'Failed to reset conversation',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};
