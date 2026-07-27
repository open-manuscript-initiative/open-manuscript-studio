import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    response.status(200).json({
      status: 'ok',
      service: 'open-manuscript-studio-server',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      'Database health check failed:',
      error,
    );

    response.status(503).json({
      status: 'error',
      service: 'open-manuscript-studio-server',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});
