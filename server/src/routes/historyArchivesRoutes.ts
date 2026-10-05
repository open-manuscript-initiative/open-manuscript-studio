import { Router } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import { searchEuropeana } from '../integrations/europeana/europeanaSearch.js';
import { searchNaraCatalog } from '../integrations/nara/naraCatalogSearch.js';

export const historyArchivesRouter = Router();

const querySchema = z.string().trim().min(2).max(300);
const cursorSchema = z.string().trim().min(1).max(4096).optional();
const pageSchema = z.coerce.number().int().min(1).max(100_000).optional();

historyArchivesRouter.get(
  '/modules/history-archives/europeana/search',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const apiKey = env.EUROPEANA_API_KEY;
    if (!apiKey) {
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
        apiKey,
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

historyArchivesRouter.get(
  '/modules/history-archives/nara/search',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const apiKey = env.NARA_CATALOG_API_KEY;
    if (!apiKey) {
      response.status(503).json({
        error: {
          code: 'NARA_NOT_CONFIGURED',
          message: 'National Archives Catalog search is not configured on this Studio server.',
        },
      });
      return;
    }

    const query = querySchema.safeParse(request.query.q);
    const page = pageSchema.safeParse(request.query.page);
    if (!query.success || !page.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_NARA_SEARCH',
          message: 'Enter a search term of 2 to 300 characters and a valid page number.',
        },
      });
      return;
    }

    try {
      const result = await searchNaraCatalog({
        query: query.data,
        apiKey,
        ...(page.data ? { page: page.data } : {}),
      });
      response.setHeader('Cache-Control', 'private, max-age=30');
      response.status(200).json(result);
    } catch {
      response.status(502).json({
        error: {
          code: 'NARA_SEARCH_FAILED',
          message: 'The National Archives Catalog could not complete the search.',
        },
      });
    }
  },
);
