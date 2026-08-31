import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import {
  apiRateLimit,
  authRateLimit,
  integrationRateLimit,
} from './middleware/rateLimits.js';
import { agentReviewRouter } from './routes/agentReviewRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { authorSignatureRouter } from './routes/authorSignatureRoutes.js';
import { centralAdminRouter } from './routes/centralAdminRoutes.js';
import { cloudOAuthRouter } from './routes/cloudOAuthRoutes.js';
import { cloudRouter } from './routes/cloudRoutes.js';
import { editorReviewOverviewRouter } from './routes/editorReviewOverviewRoutes.js';
import { federatedAuthRouter } from './routes/federatedAuthRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { institutionAdminApiRouter } from './routes/institutionAdminApiRoutes.js';
import { institutionAdminAuthRouter } from './routes/institutionAdminAuthRoutes.js';
import { institutionalProfileRouter } from './routes/institutionalProfileRoutes.js';
import { integrationExecutionRouter } from './routes/integrationExecutionRoutes.js';
import { integrationRouter } from './routes/integrationRoutes.js';
import { linkedIdentityRouter } from './routes/linkedIdentityRoutes.js';
import { ojsAssignmentRouter } from './routes/ojsAssignmentRoutes.js';
import { ojsReviewRouter } from './routes/ojsReviewRoutes.js';
import { ompReviewRouter } from './routes/ompReviewRoutes.js';
import { oidcProviderRouter } from './routes/oidcProviderRoutes.js';
import { orcidLinkStartRouter } from './routes/orcidLinkStartRoutes.js';
import { orcidOidcRouter } from './routes/orcidOidcRoutes.js';
import { pdfImportRouter } from './routes/pdfImportRoutes.js';
import { peerReviewRouter } from './routes/peerReviewRoutes.js';
import { proofreadingRouter } from './routes/proofreadingRoutes.js';
import { publishingConnectionRouter } from './routes/publishingConnectionRoutes.js';
import { reviewManuscriptRouter } from './routes/reviewManuscriptRoutes.js';
import { userIntegrationRouter } from './routes/userIntegrationRoutes.js';

export const app = express();

const allowedOrigins = new Set([
  env.FRONTEND_ORIGIN,
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
]);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));

app.get('/api', (_request, response) => {
  response.status(200).json({
    name: 'Open Manuscript Studio API',
    version: '0.1.0-alpha.1',
  });
});

app.use('/api/health', healthRouter);
app.use(apiRateLimit);
app.use('/api/auth', authRateLimit);
app.use('/integrations', integrationRateLimit);

app.use('/api/auth', orcidOidcRouter);
app.use('/api/auth', oidcProviderRouter);
app.use('/api/auth', federatedAuthRouter);
app.use('/api/auth', linkedIdentityRouter);
app.use('/api/auth', institutionAdminAuthRouter);
app.use('/api/auth', institutionalProfileRouter);
app.use('/api/auth', authRouter);
app.use('/api/central-admin', centralAdminRouter);
app.use('/api/institution-admin', institutionAdminApiRouter);
app.use('/api', orcidLinkStartRouter);
app.use('/api', authorSignatureRouter);
app.use('/api', cloudOAuthRouter);
app.use('/api', cloudRouter);
app.use('/api', userIntegrationRouter);
app.use('/api', agentReviewRouter);
app.use('/api', integrationExecutionRouter);
app.use('/api', proofreadingRouter);
app.use('/api', publishingConnectionRouter);
app.use('/api/import', pdfImportRouter);
app.use('/api/reviews', peerReviewRouter);
app.use('/api/reviews', reviewManuscriptRouter);
app.use('/api/reviews', editorReviewOverviewRouter);
app.use('/api/reviews', ojsAssignmentRouter);
app.use('/integrations/ojs/review', ojsReviewRouter);
app.use('/integrations/omp/review', ompReviewRouter);
app.use('/integrations', integrationRouter);

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API endpoint was not found.',
    },
  });
});
