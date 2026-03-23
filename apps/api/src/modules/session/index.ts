import { FastifyPluginAsync } from 'fastify';
import { sessionManager } from './session-manager.js';

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // Get current session info
  fastify.get('/', async (request, reply) => {
    const session = sessionManager.getCurrentSession();
    return {
      session,
      isActive: sessionManager.isSessionActive(),
      timestamp: new Date().toISOString(),
    };
  });

  // Get session history
  fastify.get('/history', async (request, reply) => {
    return {
      message: 'Session history - to be implemented',
    };
  });

  // Clean up old sessions
  fastify.post('/cleanup', async (request, reply) => {
    const { days } = request.body as { days?: number };
    const olderThanDays = days || 7;

    const result = await sessionManager.cleanupOldData(olderThanDays);

    return {
      success: true,
      ...result,
      message: `Cleaned up sessions older than ${olderThanDays} days`,
    };
  });

  // Clean up ALL data (dangerous!)
  fastify.post('/cleanup/all', async (request, reply) => {
    if (sessionManager.isSessionActive()) {
      return reply.code(400).send({
        error: 'Cannot cleanup while session is active. End session first.',
      });
    }

    await sessionManager.cleanupAllData();

    return {
      success: true,
      message: 'All database data has been cleaned up',
    };
  });
};
