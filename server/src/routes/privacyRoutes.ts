import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { loadPrivacyNotice } from '../config/privacyNotice.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { exportAccountOverview } from '../services/accountDataService.js';

export const privacyRouter = Router();
const notice = loadPrivacyNotice(env.OMI_PRIVACY_CONFIG_PATH);
privacyRouter.use(['/privacy', '/account/data'], (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
privacyRouter.get('/privacy', (_request, response) => { response.json(notice); });
privacyRouter.get('/account/data', requireSession, rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }),
  async (request: AuthenticatedRequest, response) => {
    try {
      const overview = await exportAccountOverview(request.authUserId!);
      if (!overview) { response.sendStatus(404); return; }
      response.setHeader('Content-Disposition', 'attachment; filename="omi-account-data.json"');
      response.json(overview);
    } catch {
      response.status(500).json({ error: { code: 'ACCOUNT_EXPORT_FAILED', message: 'The account data copy could not be prepared.' } });
    }
  });
