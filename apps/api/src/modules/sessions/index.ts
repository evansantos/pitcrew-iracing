import fs from 'fs';
import { join, resolve } from 'path';
import type { FastifyPluginAsync } from 'fastify';
import type { FrameQuery } from '@iracing-race-engineer/shared';
import { FileStore } from '../../services/file-store/index.js';

/** Validate session ID is a UUID to prevent path traversal */
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function createSessionRoutes(fileStore: FileStore): FastifyPluginAsync {
  return async (fastify) => {
    // GET / — list all sessions sorted by startTime desc
    fastify.get('/', async (_request, reply) => {
      const sessions = fileStore.listSessions();
      sessions.sort((a, b) => b.startTime - a.startTime);
      return reply.send(sessions);
    });

    // GET /:id — get session index
    fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
      const index = fileStore.getSessionIndex(request.params.id);
      if (!index) {
        return reply.code(404).send({ error: 'Session not found', sessionId: request.params.id });
      }
      return reply.send(index);
    });

    // GET /:id/frames — get frames with query params
    fastify.get<{
      Params: { id: string };
      Querystring: {
        laps?: string;
        timeStart?: string;
        timeEnd?: string;
        downsample?: string;
        limit?: string;
      };
    }>('/:id/frames', async (request, reply) => {
      const { id } = request.params;
      const { laps, timeStart, timeEnd, downsample, limit } = request.query;

      const query: FrameQuery = {
        sessionId: id,
      };

      if (laps) {
        query.laps = laps.split(',').map(Number).filter(n => !isNaN(n));
      }

      if (timeStart !== undefined && timeEnd !== undefined) {
        query.timeRange = { start: Number(timeStart), end: Number(timeEnd) };
      }

      if (downsample !== undefined) {
        query.downsample = Number(downsample);
      }

      query.limit = limit !== undefined ? Number(limit) : 10000;

      const frames = fileStore.getFrames(query);
      return reply.send(frames);
    });

    // GET /:id/laps — get session laps array
    fastify.get<{ Params: { id: string } }>('/:id/laps', async (request, reply) => {
      const index = fileStore.getSessionIndex(request.params.id);
      if (!index) {
        return reply.code(404).send({ error: 'Session not found', sessionId: request.params.id });
      }
      return reply.send(index.laps);
    });

    // DELETE /:id — end session and remove directory from disk
    fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
      const { id } = request.params;

      // Validate UUID format to prevent path traversal
      if (!UUID_PATTERN.test(id)) {
        return reply.code(400).send({ error: 'Invalid session ID format' });
      }

      const index = fileStore.getSessionIndex(id);
      if (!index) {
        return reply.code(404).send({ error: 'Session not found', sessionId: id });
      }

      fileStore.endSession(id);

      const dataDir: string = fileStore['dataDir'];
      const sessionDir = resolve(dataDir, id);
      // Verify resolved path stays within dataDir
      if (!sessionDir.startsWith(resolve(dataDir))) {
        return reply.code(400).send({ error: 'Invalid session ID' });
      }
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true });
      }

      return reply.code(204).send();
    });
  };
}
