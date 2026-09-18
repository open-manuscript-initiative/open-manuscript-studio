import { Router } from 'express';
import { z } from 'zod';

import { requireSession } from '../middleware/requireSession.js';
import {
  MAX_JATS_VALIDATION_BYTES,
  validateJats14ArticleAuthoring,
} from '../services/jatsValidator.js';

export const publicationValidationRouter = Router();

const requestSchema = z.object({
  xml: z
    .string()
    .min(1)
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= MAX_JATS_VALIDATION_BYTES,
      'JATS XML is too large.',
    ),
});

publicationValidationRouter.post(
  '/validate/jats',
  requireSession,
  async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');

    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_JATS_VALIDATION_REQUEST',
          message: 'Provide JATS XML within the validation size limit.',
        },
      });
      return;
    }

    try {
      response.status(200).json(
        await validateJats14ArticleAuthoring(parsed.data.xml),
      );
    } catch (error) {
      console.error('JATS schema validation failed:', error);
      response.status(503).json({
        error: {
          code: 'JATS_VALIDATOR_UNAVAILABLE',
          message: 'The JATS schema validator is temporarily unavailable.',
        },
      });
    }
  },
);
