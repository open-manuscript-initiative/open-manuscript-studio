import { Router } from 'express';
import { z } from 'zod';

import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import { searchSefaria } from '../integrations/sefaria/sefariaSearch.js';

export const religiousTextsRouter = Router();

const querySchema = z.string().trim().min(2).max(240);
const cursorSchema = z.string().trim().regex(/^\\d{1,5}$/).optional();

religiousTextsRouter.get(
  '/modules/religious-texts/sefaria/search',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const query = querySchema.safeParse(request.query.q);
    const cursor = cursorSchema.safeParse(request.query.cursor);
    if (!query.success || !cursor.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_SEFARIA_SEARCH',
          message: 'Enter a search term of 2 to 240 characters and a valid result cursor.',
        },
      });
      return;
    }

    try {
      const result = await searchSefaria({
        query: query.data,
        ...(cursor.data ? { cursor: cursor.data } : {}),
      });
      response.setHeader('Cache-Control', 'private, max-age=30');
      response.status(200).json(result);
    } catch {
      response.status(502).json({
        error: {
          code: 'SEFARIA_SEARCH_FAILED',
          message: 'The Sefaria text search could not complete the request.',
        },
      });
    }
  },
);
