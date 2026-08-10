import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { authRouter } from './routes/authRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { integrationRouter } from './routes/integrationRoutes.js';
import { peerReviewRouter } from './routes/peerReviewRoutes.js';
import { reviewManuscriptRouter } from './routes/reviewManuscriptRoutes.js';

export const app = express();

app.disable('x-powered-by');

app.use(helmet());

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: '1mb',
  }),
);

app.get('/api', (_request, response) => {
  response.status(200).json({
    name: 'Open Manuscript Studio API',
    version: '0.1.0-alpha.1',
  });
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/reviews', peerReviewRouter);
app.use('/api/reviews', reviewManuscriptRouter);
app.use('/integrations', integrationRouter);

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API endpoint was not found.',
    },
  });
});
