import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { publicPrivacyNoticeSchema, privacyErrorSchema, type PrivacyError, type PublicPrivacyNotice, type AccountOverview } from '../contracts/privacyContract.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';

type Dependencies = {
  notice: PublicPrivacyNotice;
  exportAccountOverview: (userId: string) => Promise<AccountOverview | null>;
  onLegacyRequest?: (route: '/privacy' | '/account/data') => void;
};
function fail(response: Response, status: number, code: PrivacyError['error']['code'], message: string) {
  response.status(status).json(privacyErrorSchema.parse({ error: { code, message } }));
}
/** Both mounts share handlers and ONE limiter, so aliases cannot bypass quotas. */
export function createPrivacyRouter(dependencies: Dependencies) {
  const router = Router();
  const notice = publicPrivacyNoticeSchema.parse(dependencies.notice);
  router.use(['/privacy', '/account/data'], (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Request-Id', randomUUID());
    next();
  });
  // Route-specific middleware avoids marking unrelated /api routes as deprecated.
  const legacy = (route: '/privacy' | '/account/data') => Router().use((request, response, next) => {
    if (request.baseUrl === '/api') {
      response.setHeader('Deprecation', '@1794096000'); // 2026-11-08 UTC; no removal date promised.
      response.setHeader('Link', `</api/v1${route}>; rel="successor-version"`);
      dependencies.onLegacyRequest?.(route); // Only fixed route names; no identity, query or payload.
    }
    next();
  });
  router.get('/privacy', legacy('/privacy'), (_request, response) => { response.json(notice); });
  router.get('/account/data', legacy('/account/data'), async (request: AuthenticatedRequest, response, next) => {
    try { await requireSession(request, response, next); }
    catch { fail(response, 503, 'IDENTITY_UNAVAILABLE', 'Account authentication is temporarily unavailable.'); }
  }, rateLimit({ windowMs: 15 * 60 * 1000, limit: 10,
    handler: (_request, response) => { fail(response, 429, 'RATE_LIMITED', 'Too many account data requests. Try again later.'); },
  }), async (request: AuthenticatedRequest, response) => {
    try {
      const overview = await dependencies.exportAccountOverview(request.authUserId!);
      if (!overview) { fail(response, 404, 'ACCOUNT_NOT_FOUND', 'The account could not be found.'); return; }
      response.setHeader('Content-Disposition', 'attachment; filename="omi-account-data.json"');
      response.json(overview);
    } catch {
      fail(response, 500, 'ACCOUNT_EXPORT_FAILED', 'The account data copy could not be prepared.');
    }
  });
  return router;
}
