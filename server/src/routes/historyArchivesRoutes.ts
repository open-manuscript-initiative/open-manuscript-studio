import { Router } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import { searchEuropeana } from '../integrations/europeana/europeanaSearch.js';

export const historyArchivesRouter = Router();

const querySchema = z.string().trim().min(2).max(300);
const cursorSchema = z.string().trim().min(1).max(4096).optional();

historyArchivesRouter.get(
  '/modules/history-archives/europeana/search',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    if (!env.EUROPEANA_API_KEY) {
      response.status(503).json({
        error: {
          code: 'EUROPEANA_NOT_CONFIGURED',
          message: 'Europeana search is not configured on this Studio server.',
        },
      });
      return;
    }

    const query = querySchema.safeParse(request.query.q);
    const cursor = cursorSchema.safeParse(request.query.cursor);
    if (!query.success || !cursor.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_EUROPEANA_SEARCH',
          message: 'Enter a search term of 2 to 300 characters.',
        },
      });
      return;
    }

    try {
      const result = await searchEuropeana({
        query: query.data,
        apiKey: env.EUROPEANA_API_KEY,
        ...(cursor.data ? { cursor: cursor.data } : {}),
      });
      response.setHeader('Cache-Control', 'private, max-age=30');
      response.status(200).json(result);
    } catch {
      response.status(502).json({
        error: {
          code: 'EUROPEANA_SEARCH_FAILED',
          message: 'The Europeana search service could not complete the request.',
        },
      });
    }
  },
);
