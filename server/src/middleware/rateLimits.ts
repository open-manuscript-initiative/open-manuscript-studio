import { rateLimit } from 'express-rate-limit';

function limitMessage(scope: string) {
  return {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Too many ${scope} requests. Please try again later.`,
    },
  };
}

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: limitMessage('API'),
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: limitMessage('authentication'),
});

export const integrationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: limitMessage('integration'),
});
